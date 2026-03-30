import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import {
  getAllQuotas,
  invalidateOAuth2Cache,
  invalidateQuotaCache,
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
    await File.deleteMany({ accountIndex });
    account.isConnected = false;
    account.refreshToken = null;
    account.accessToken = null;
    account.tokenExpiry = null;
    await account.save();

    // BUG FIX: clear cached OAuth2 client so a re-connect to a different
    // Google account on the same index slot doesn't reuse the old token
    invalidateOAuth2Cache(accountIndex);
    invalidateQuotaCache(accountIndex);
  }

  return res.json({ ok: true });
}