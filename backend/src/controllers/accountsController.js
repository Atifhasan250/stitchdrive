import { google } from "googleapis";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { encryptToken } from "../services/authService.js";
import {
  getAllQuotas,
  invalidateOAuth2Cache,
  invalidateQuotaCache,
  getOAuth2Client,
  getOAuthFlow,
  getAuthUrl,
  syncFilesFromDrives,
} from "../services/driveService.js";
import * as config from "../config/index.js";

// ── GET /api/accounts ─────────────────────────────────────────────────────────
export async function listAccounts(req, res) {
  const ownerId = req.ownerId;
  const connectedAccounts = await DriveAccount.find({ ownerId, isConnected: true }).lean();
  const quotas = await getAllQuotas(connectedAccounts);
  const connectedIndices = new Set(quotas.map((q) => q.accountIndex));

  const disconnected = await DriveAccount.find({ ownerId, isConnected: false }).lean();
  for (const acc of disconnected) {
    if (!connectedIndices.has(acc.accountIndex)) {
      quotas.push({
        accountIndex: acc.accountIndex,
        email: acc.email,
        isConnected: false,
        used: 0,
        limit: 0,
        free: 0,
      });
    }
  }

  quotas.sort((a, b) => a.accountIndex - b.accountIndex);

  return res.json(
    quotas.map((q) => ({
      account_index: q.accountIndex,
      email: q.email,
      is_connected: q.isConnected,
      used: q.used,
      limit: q.limit,
      free: q.free,
    }))
  );
}

// ── DELETE /api/accounts/:accountIndex ────────────────────────────────────────
export async function disconnectAccount(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (account) {
    if (!account.isConnected) {
      await account.deleteOne();
      invalidateOAuth2Cache(ownerId, accountIndex);
      invalidateQuotaCache(ownerId, accountIndex);
      return res.json({ ok: true, removed: true });
    }

    await File.deleteMany({ ownerId, accountIndex });
    account.isConnected = false;
    account.email = null;
    account.refreshToken = null;
    account.accessToken = null;
    account.tokenExpiry = null;
    await account.save();

    invalidateOAuth2Cache(ownerId, accountIndex);
    invalidateQuotaCache(ownerId, accountIndex);
  }

  return res.json({ ok: true });
}

// ── GET /api/accounts/:accountIndex/token ────────────────────────────────────
export async function getAccessToken(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(404).json({ detail: "Account not found or not connected" });
  }

  try {
    const oauth2Client = getOAuth2Client(account);
    const { token } = await oauth2Client.getAccessToken();
    return res.json({ accessToken: token });
  } catch (err) {
    console.error("[Account] Error getting token:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── GET /api/accounts/oauth/new ───────────────────────────────────────────────
export async function getNewOAuthUrl(req, res) {
  const ownerId = req.ownerId;

  // Cleanup old uncompleted accounts for this user
  await DriveAccount.deleteMany({
    ownerId,
    isConnected: false,
    email: null,
    refreshToken: null,
  });

  const maxAccount = await DriveAccount.findOne({ ownerId }).sort({ accountIndex: -1 });
  const newIndex = maxAccount ? maxAccount.accountIndex + 1 : 1;

  await DriveAccount.create({ ownerId, accountIndex: newIndex, isConnected: false });

  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  
  // Encode ownerId and accountIndex in the state
  const state = Buffer.from(JSON.stringify({ ownerId, accountIndex: newIndex })).toString("base64");
  const authUrl = getAuthUrl(oauth2Client, state);

  return res.json({ auth_url: authUrl });
}

// ── GET /api/accounts/oauth/:accountIndex ─────────────────────────────────────
export async function getOAuthUrl(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }
  
  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  
  const state = Buffer.from(JSON.stringify({ ownerId, accountIndex })).toString("base64");
  const authUrl = getAuthUrl(oauth2Client, state);
  
  return res.json({ auth_url: authUrl });
}

// ── GET /api/accounts/oauth/callback ──────────────────────────────────────────
export async function oauthCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    console.warn("[OAuth] User denied consent or error returned:", error);
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  let stateObj;
  try {
    stateObj = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
  } catch (err) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  const accountIndex = parseInt(stateObj.accountIndex, 10);
  const ownerId = stateObj.ownerId;
  
  if (isNaN(accountIndex) || !ownerId) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const driveApi = google.drive({ version: "v3", auth: oauth2Client });
  const about = await driveApi.about.get({ fields: "user" });
  const email = about.data.user?.emailAddress || "";

  let account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account) {
    account = new DriveAccount({ ownerId, accountIndex });
  }

  invalidateOAuth2Cache(ownerId, accountIndex);

  account.email = email;
  account.isConnected = true;

  if (tokens.refresh_token) {
    account.refreshToken = encryptToken(tokens.refresh_token);
  }

  await account.save();

  // Sync in the background for this user
  syncFilesFromDrives(ownerId).catch((err) =>
    console.error("[Sync] Background sync error:", err.message)
  );

  return res.redirect(`${config.FRONTEND_URL}/dashboard/settings`);
}