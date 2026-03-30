import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import {
  getAllQuotas,
  invalidateOAuth2Cache,
  invalidateQuotaCache,
  getOAuth2Client,
} from "../services/driveService.js";

// ── GET /api/accounts ─────────────────────────────────────────────────────────
export async function listAccounts(req, res) {
  const connectedAccounts = await DriveAccount.find({ isConnected: true }).lean();
  const quotas = await getAllQuotas(connectedAccounts);
  const connectedIndices = new Set(quotas.map((q) => q.accountIndex));

  const disconnected = await DriveAccount.find({ isConnected: false }).lean();
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

  // Return snake_case keys — frontend expects this shape
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
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ accountIndex });
  if (account) {
    // If already disconnected, this is a "Remove" request
    if (!account.isConnected) {
      await account.deleteOne();
      invalidateOAuth2Cache(accountIndex);
      invalidateQuotaCache(accountIndex);
      return res.json({ ok: true, removed: true });
    }

    // Otherwise, this is a "Disconnect" request
    await File.deleteMany({ accountIndex });
    account.isConnected = false;
    account.email = null;
    account.refreshToken = null;
    account.accessToken = null;
    account.tokenExpiry = null;
    await account.save();

    invalidateOAuth2Cache(accountIndex);
    invalidateQuotaCache(accountIndex);
  }

  return res.json({ ok: true });
}

// ── GET /api/accounts/:accountIndex/token ────────────────────────────────────
export async function getAccessToken(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ accountIndex });
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