import { google } from "googleapis";
import DriveAccount from "../models/DriveAccount.js";
import { encryptToken, verifyPin, createAccessToken } from "../services/authService.js";
import { getOAuthFlow, getAuthUrl, syncFilesFromDrives } from "../services/driveService.js";
import * as config from "../config/index.js";

// In-memory store for PKCE verifiers (same approach as Python)
const _pendingVerifiers = new Map();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req, res) {
  const { pin } = req.body;
  if (!pin || !(await verifyPin(pin))) {
    return res.status(401).json({ detail: "Invalid PIN" });
  }
  const token = createAccessToken({ sub: "dashboard" });
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400 * 1000,
  });
  return res.json({ ok: true });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req, res) {
  res.clearCookie("access_token");
  return res.json({ ok: true });
}

// ── GET /api/auth/oauth/new ───────────────────────────────────────────────────
export async function getNewOAuthUrl(req, res) {
  // Remove stale placeholders from previous attempts
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
  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/auth/callback";
  const oauth2Client = getOAuthFlow(redirectUri);
  const authUrl = getAuthUrl(oauth2Client, accountIndex);
  return res.json({ auth_url: authUrl });
}

// ── GET /api/auth/callback ────────────────────────────────────────────────────
export async function oauthCallback(req, res) {
  const { code, state } = req.query;
  const accountIndex = parseInt(state, 10);
  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/auth/callback";

  const oauth2Client = getOAuthFlow(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch email
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });
  const about = await driveApi.about.get({ fields: "user" });
  const email = about.data.user?.emailAddress || "";

  let account = await DriveAccount.findOne({ accountIndex });
  if (!account) {
    account = new DriveAccount({ accountIndex });
  }
  account.email = email;
  account.refreshToken = encryptToken(tokens.refresh_token);
  account.isConnected = true;
  await account.save();

  // Sync in the background
  syncFilesFromDrives().catch((err) =>
    console.error("[Sync] Background sync error:", err.message)
  );

  return res.redirect(`${config.FRONTEND_URL}/dashboard/settings`);
}
