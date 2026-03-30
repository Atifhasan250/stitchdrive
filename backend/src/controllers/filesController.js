import mongoose from "mongoose";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import {
  deleteDriveFile,
  listSharedFiles,
  listSharedFolderChildren,
  listTrashFiles,
  moveFile,
  pickBestAccount,
  removeSharedFile,
  renameFile,
  restoreFile,
  shareFile,
  streamFile,
  syncFilesFromDrives,
  trashDriveFile,
  unshareFile,
  uploadFile,
} from "../services/driveService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function fileToDict(f) {
  return {
    id: f._id.toString(),
    file_name: f.fileName,
    drive_file_id: f.driveFileId,
    account_index: f.accountIndex,
    size: f.size,
    mime_type: f.mimeType,
    has_thumbnail: f.thumbnailLink != null,
    parent_drive_file_id: f.parentDriveFileId,
    created_at: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

// ── POST /api/files/sync ──────────────────────────────────────────────────────
export async function syncFiles(req, res) {
  syncFilesFromDrives().catch((err) =>
    console.error("[Sync] Background sync error:", err.message)
  );
  return res.json({ ok: true });
}

// ── GET /api/files ────────────────────────────────────────────────────────────
export async function listFiles(req, res) {
  const connected = await DriveAccount.find({ isConnected: true }).select("accountIndex").lean();
  const connectedIndices = connected.map((a) => a.accountIndex);
  const files = await File.find({ accountIndex: { $in: connectedIndices } })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(files.map(fileToDict));
}

// ── POST /api/files/upload ────────────────────────────────────────────────────
export async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ detail: "No file provided" });
  }

  const bestIndex = await pickBestAccount();
  if (bestIndex === null) {
    return res.status(503).json({ detail: "No connected Drive accounts with available space" });
  }

  const account = await DriveAccount.findOne({ accountIndex: bestIndex });

  // BUG FIX: removed require("mime-types") which crashes in ES modules.
  // req.file.mimetype is always set by multer; fallback to octet-stream.
  const mimeType = req.file.mimetype || "application/octet-stream";
  const parentFolderId = req.body.parent_folder_id || null;

  const result = await uploadFile(
    account,
    req.file.buffer,
    req.file.originalname,
    mimeType,
    parentFolderId
  );

  const dbFile = await File.create({
    fileName: req.file.originalname,
    driveFileId: result.driveFileId,
    accountIndex: bestIndex,
    size: result.size,
    mimeType: result.mimeType,
    thumbnailLink: result.thumbnailLink || null,
    parentDriveFileId: result.parentDriveFileId || null,
  });

  return res.status(201).json(fileToDict(dbFile));
}

// ── GET /api/files/:fileId/download ──────────────────────────────────────────
export async function getDownload(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(file.fileName).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, file.driveFileId)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[DownloadStream] Error streaming file ${file.driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── GET /api/files/:fileId/view ───────────────────────────────────────────────
export async function getView(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(file.fileName).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, file.driveFileId)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[ViewStream] Error streaming file ${file.driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── PATCH /api/files/:fileId/rename ──────────────────────────────────────────
export async function rename(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }

  // BUG FIX: validate new_name before calling Drive API
  const newName = req.body.new_name?.trim();
  if (!newName) {
    return res.status(400).json({ detail: "new_name is required and cannot be empty" });
  }

  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  await renameFile(account, file.driveFileId, newName);
  file.fileName = newName;
  await file.save();

  return res.json(fileToDict(file));
}

// ── PATCH /api/files/:fileId/move ─────────────────────────────────────────────
export async function moveFileRoute(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }

  const { new_parent_drive_file_id } = req.body;
  if (!new_parent_drive_file_id) {
    return res.status(400).json({ detail: "new_parent_drive_file_id is required" });
  }

  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  try {
    await moveFile(account, file.driveFileId, new_parent_drive_file_id, file.parentDriveFileId);
  } catch (err) {
    console.error("[moveFile] Error:", err.message);
    return res.status(503).json({ detail: err.message });
  }

  file.parentDriveFileId =
    new_parent_drive_file_id === "root" ? null : new_parent_drive_file_id;
  await file.save();
  return res.json(fileToDict(file));
}

// ── POST /api/files/:fileId/share ─────────────────────────────────────────────
export async function shareFileRoute(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    const link = await shareFile(account, file.driveFileId);
    return res.json({ link });
  } catch (err) {
    console.error("[shareFile] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/:fileId/share ──────────────────────────────────────────
export async function unshareFileRoute(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await unshareFile(account, file.driveFileId);
    return res.status(204).send();
  } catch (err) {
    console.error("[unshareFile] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/:fileId ─────────────────────────────────────────────────
export async function deleteFile(req, res) {
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findById(req.params.fileId);
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ accountIndex: file.accountIndex });
  if (account && account.isConnected) {
    try {
      await trashDriveFile(account, file.driveFileId);
    } catch (_) {}
  }

  await file.deleteOne();
  return res.status(204).send();
}

// ── GET /api/files/shared/:accountIndex/:driveFileId/download ─────────────────
export async function downloadSharedFile(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;

  const account = await DriveAccount.findOne({ accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(driveFileId).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `attachment; filename="${driveFileId.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, driveFileId)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[SharedStream] Error streaming file ${driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── GET /api/files/shared/:accountIndex/:folderId/children ────────────────────
export async function listSharedChildren(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { folderId } = req.params;

  const account = await DriveAccount.findOne({ accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    const items = await listSharedFolderChildren(account, folderId);
    return res.json(
      items.map((i) => ({
        drive_file_id: i.driveFileId,
        file_name: i.fileName,
        account_index: i.accountIndex,
        size: i.size,
        mime_type: i.mimeType,
        created_at: i.createdAt,
        shared_by: i.sharedBy,
      }))
    );
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/shared/:accountIndex/:driveFileId ──────────────────────
export async function deleteSharedFile(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;

  const account = await DriveAccount.findOne({ accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await removeSharedFile(account, driveFileId);
    return res.status(204).send();
  } catch (err) {
    if (err.isValidation) {
      return res.status(422).json({ detail: err.message });
    }
    return res.status(500).json({ detail: err.message });
  }
}

// ── GET /api/files/shared ─────────────────────────────────────────────────────
// BUG FIX: fetch all accounts in parallel with Promise.allSettled
export async function listShared(req, res) {
  const accounts = await DriveAccount.find({ isConnected: true }).lean();
  const settled = await Promise.allSettled(accounts.map((acc) => listSharedFiles(acc)));
  const results = settled
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json(
    results.map((i) => ({
      drive_file_id: i.driveFileId,
      file_name: i.fileName,
      account_index: i.accountIndex,
      size: i.size,
      mime_type: i.mimeType,
      created_at: i.createdAt,
      shared_by: i.sharedBy,
    }))
  );
}

// ── GET /api/files/trash ──────────────────────────────────────────────────────
// BUG FIX: fetch all accounts in parallel with Promise.allSettled
export async function listTrash(req, res) {
  const accounts = await DriveAccount.find({ isConnected: true }).lean();
  const settled = await Promise.allSettled(accounts.map((acc) => listTrashFiles(acc)));
  const results = settled
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  results.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
  return res.json(
    results.map((i) => ({
      drive_file_id: i.driveFileId,
      file_name: i.fileName,
      account_index: i.accountIndex,
      size: i.size,
      mime_type: i.mimeType,
      trashed_at: i.trashedAt,
    }))
  );
}

// ── POST /api/files/trash/:accountIndex/:driveFileId/restore ─────────────────
export async function restoreTrashFile(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;

  const account = await DriveAccount.findOne({ accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await restoreFile(account, driveFileId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/trash/:accountIndex/:driveFileId ───────────────────────
export async function deleteTrashFile(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;

  const account = await DriveAccount.findOne({ accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await deleteDriveFile(account, driveFileId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}