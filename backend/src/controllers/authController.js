import { google } from "googleapis";
import DriveAccount from "../models/DriveAccount.js";
import { encryptToken, verifyPin, createAccessToken } from "../services/authService.js";
import {
  getOAuthFlow,
  getAuthUrl,
  syncFilesFromDrives,
  invalidateOAuth2Cache,
} from "../services/driveService.js";
import * as config from "../config/index.js";

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req, res) {
  const { pin } = req.body;
  // Validate input before touching bcrypt (avoids timing leak on empty input)
  if (!pin || typeof pin !== "string") {
    return res.status(401).json({ detail: "Invalid PIN" });
  }
  if (!(await verifyPin(pin))) {
    return res.status(401).json({ detail: "Invalid PIN" });
  }
  const token = createAccessToken({ sub: "dashboard" });
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400 * 1000, // 24 hours
  });
  return res.json({ ok: true });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req, res) {
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ ok: true });
}

// ── GET /api/auth/oauth/new ───────────────────────────────────────────────────
export async function getNewOAuthUrl(req, res) {
  // Remove stale email-less disconnected placeholders from previous failed attempts
  await DriveAccount.deleteMany({
    isConnected: false,
    email: null,
    refreshToken: null,
  });

  const maxAccount = await DriveAccount.findOne().sort({ accountIndex: -1 });
  const newIndex = maxAccount ? maxAccount.accountIndex + 1 : 1;

  await DriveAccount.create({ accountIndex: newIndex, isConnected: false });

  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/auth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  const authUrl = getAuthUrl(oauth2Client, newIndex);

  return res.json({ auth_url: authUrl });
}

// ── GET /api/auth/oauth/:accountIndex ─────────────────────────────────────────
export async function getOAuthUrl(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }
  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/auth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  const authUrl = getAuthUrl(oauth2Client, accountIndex);
  return res.json({ auth_url: authUrl });
}

// ── GET /api/auth/callback ────────────────────────────────────────────────────
export async function oauthCallback(req, res) {
  const { code, state, error } = req.query;

  // Google may return an error if user denied consent
  if (error) {
    console.warn("[OAuth] User denied consent or error returned:", error);
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  const accountIndex = parseInt(state, 10);
  if (isNaN(accountIndex)) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/auth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch the Google account email
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });
  const about = await driveApi.about.get({ fields: "user" });
  const email = about.data.user?.emailAddress || "";

  let account = await DriveAccount.findOne({ accountIndex });
  if (!account) {
    account = new DriveAccount({ accountIndex });
  }

  // Invalidate cached OAuth2 client so the new token is picked up immediately
  invalidateOAuth2Cache(accountIndex);

  account.email = email;
  account.isConnected = true;

  // BUG FIX: Google only sends refresh_token on first authorization.
  // On re-auth of the same account it comes back null — never overwrite with null.
  if (tokens.refresh_token) {
    account.refreshToken = encryptToken(tokens.refresh_token);
  }

  await account.save();

  // Sync in the background — don't block the redirect
  syncFilesFromDrives().catch((err) =>
    console.error("[Sync] Background sync error:", err.message)
  );

  return res.redirect(`${config.FRONTEND_URL}/dashboard/settings`);
}