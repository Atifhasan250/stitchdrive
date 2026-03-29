import DriveAccount from "../models/DriveAccount.js";
import Profile from "../models/Profile.js";
import {
  downloadFile,
  getOrCreateProfileFolder,
  uploadFile,
} from "../services/driveService.js";

async function getOrCreateProfile() {
  let profile = await Profile.findOne();
  if (!profile) {
    profile = await Profile.create({});
  }
  return profile;
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
export async function getProfile(req, res) {
  const profile = await getOrCreateProfile();
  return res.json({
    display_name: profile.displayName,
    bio: profile.bio,
    has_avatar: profile.avatarDriveFileId != null,
  });
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
export async function updateProfile(req, res) {
  const profile = await getOrCreateProfile();
  const { display_name, bio } = req.body;
  if (display_name !== undefined) profile.displayName = display_name;
  if (bio !== undefined) profile.bio = bio;
  await profile.save();
  return res.json({ ok: true });
}

// ── POST /api/profile/avatar ──────────────────────────────────────────────────
export async function uploadAvatar(req, res) {
  if (!req.file) return res.status(400).json({ detail: "No file provided" });

  const account = await DriveAccount.findOne({ isConnected: true });
  if (!account) return res.status(503).json({ detail: "No connected accounts" });

  const mimeType = req.file.mimetype || "image/jpeg";
  const folderId = await getOrCreateProfileFolder(account);

  const result = await uploadFile(
    account,
    req.file.buffer,
    "_drivepool_avatar_",
    mimeType,
    folderId
  );

  const profile = await getOrCreateProfile();
  profile.avatarDriveFileId = result.driveFileId;
  profile.avatarAccountIndex = account.accountIndex;
  await profile.save();

  return res.json({ ok: true });
}

// ── GET /api/profile/avatar ───────────────────────────────────────────────────
export async function getAvatar(req, res) {
  const profile = await Profile.findOne();
  if (!profile || !profile.avatarDriveFileId) {
    return res.status(404).json({ detail: "No avatar set" });
  }

  const account = await DriveAccount.findOne({
    accountIndex: profile.avatarAccountIndex,
  });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not available" });
  }

  const content = await downloadFile(account, profile.avatarDriveFileId);
  res.setHeader("Content-Type", "image/jpeg");
  return res.send(content);
}
