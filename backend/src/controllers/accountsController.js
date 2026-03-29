import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { getAllQuotas } from "../services/driveService.js";

// ── GET /api/accounts ─────────────────────────────────────────────────────────
export async function listAccounts(req, res) {
  const allAccounts = await DriveAccount.find({ isConnected: true });
  const quotas = await getAllQuotas(allAccounts);
  const connectedIndices = new Set(quotas.map((q) => q.accountIndex));

  const disconnected = await DriveAccount.find({ isConnected: false });
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

  // Normalise keys to snake_case for frontend compatibility
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
  const account = await DriveAccount.findOne({ accountIndex });
  if (account) {
    await File.deleteMany({ accountIndex });
    account.isConnected = false;
    account.refreshToken = null;
    account.accessToken = null;
    account.tokenExpiry = null;
    await account.save();
  }
  return res.json({ ok: true });
}
