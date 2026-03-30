import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { Readable } from "stream";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { decryptToken } from "./authService.js";
import * as config from "../config/index.js";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const PROFILE_FOLDER_NAME = "_DrivePool_";

// ── Credentials file cache (read disk once, reuse forever) ────────────────────
let _cachedClientConfig = null;

function getCredentialsPath() {
  return path.join(config.CONFIG_DIR, "credentials.json");
}

function loadClientConfig() {
  if (_cachedClientConfig) return _cachedClientConfig;
  const raw = fs.readFileSync(getCredentialsPath(), "utf8");
  const parsed = JSON.parse(raw);
  _cachedClientConfig = parsed.web || parsed.installed;
  return _cachedClientConfig;
}

// ── OAuth2 client cache (one per account index, rebuilt only when needed) ─────
const _oauth2Cache = new Map(); // accountIndex → oauth2Client

function getOAuth2Client(account) {
  const cached = _oauth2Cache.get(account.accountIndex);
  if (cached) return cached;
  const clientConfig = loadClientConfig();
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    clientConfig.redirect_uris?.[0]
  );
  const refreshToken = decryptToken(account.refreshToken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  _oauth2Cache.set(account.accountIndex, oauth2Client);
  return oauth2Client;
}

export function invalidateOAuth2Cache(accountIndex) {
  _oauth2Cache.delete(accountIndex);
}

// ── Quota in-memory cache (TTL: 60s — avoids Google API call per page load) ───
const QUOTA_CACHE_TTL_MS = 60_000;
const _quotaCache = new Map(); // accountIndex → { data, expiresAt }

function getCachedQuota(accountIndex) {
  const entry = _quotaCache.get(accountIndex);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedQuota(accountIndex, data) {
  _quotaCache.set(accountIndex, { data, expiresAt: Date.now() + QUOTA_CACHE_TTL_MS });
}

export function invalidateQuotaCache(accountIndex) {
  if (accountIndex != null) _quotaCache.delete(accountIndex);
  else _quotaCache.clear();
}

// ── Rate-limit retry ──────────────────────────────────────────────────────────

async function retryOnRateLimit(fn) {
  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.code || err?.status || err?.response?.status;
      if (status === 429 && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      } else {
        throw err;
      }
    }
  }
}

// ── Build authenticated Drive service ─────────────────────────────────────────

export function buildService(account) {
  if (!account.refreshToken) {
    throw new Error(`Account ${account.accountIndex} is not connected (no refresh token)`);
  }
  const oauth2Client = getOAuth2Client(account);
  return google.drive({ version: "v3", auth: oauth2Client });
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function getOAuthFlow(redirectUri) {
  const clientConfig = loadClientConfig();
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    redirectUri
  );
  return oauth2Client;
}

export function getAuthUrl(oauth2Client, state) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    include_granted_scopes: true,
    prompt: "select_account consent",
    state: String(state),
  });
}

// ── Storage quota (cached) ────────────────────────────────────────────────────

export async function getStorageQuota(account) {
  const cached = getCachedQuota(account.accountIndex);
  if (cached) return cached;

  try {
    const drive = buildService(account);
    const result = await retryOnRateLimit(() =>
      drive.about.get({ fields: "storageQuota" })
    );
    const quota = result.data.storageQuota;
    const used = parseInt(quota.usage || "0", 10);
    const limit = parseInt(quota.limit || String(15 * 1024 ** 3), 10);
    const data = {
      accountIndex: account.accountIndex,
      email: account.email,
      isConnected: account.isConnected,
      used,
      limit,
      free: Math.max(0, limit - used),
    };
    setCachedQuota(account.accountIndex, data);
    return data;
  } catch (err) {
    const isRefreshError =
      err.message?.includes("invalid_grant") ||
      err.message?.includes("Token has been expired");
    return {
      accountIndex: account.accountIndex,
      email: account.email,
      isConnected: isRefreshError ? false : account.isConnected,
      used: 0,
      limit: 0,
      free: 0,
    };
  }
}

export async function getAllQuotas(accounts) {
  const results = await Promise.all(accounts.map((acc) => getStorageQuota(acc)));
  return results.sort((a, b) => a.accountIndex - b.accountIndex);
}

export async function pickBestAccount() {
  const accounts = await DriveAccount.find({ isConnected: true }).lean();
  const quotas = await getAllQuotas(accounts);
  const connected = quotas.filter((q) => q.isConnected && q.free > 0);
  if (!connected.length) return null;
  return connected.reduce((best, q) => (q.free > best.free ? q : best)).accountIndex;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(account, fileBuffer, filename, mimeType, parentFolderId = null) {
  const drive = buildService(account);
  const fileMetadata = { name: filename };
  if (parentFolderId) fileMetadata.parents = [parentFolderId];

  const media = {
    mimeType,
    body: Readable.from(fileBuffer),
  };

  const result = await retryOnRateLimit(() =>
    drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,size,mimeType,thumbnailLink,parents",
      supportsAllDrives: false,
    })
  );

  // Invalidate quota cache for this account after upload
  invalidateQuotaCache(account.accountIndex);

  const data = result.data;
  const parent = data.parents?.[0] || null;
  return {
    driveFileId: data.id,
    size: parseInt(data.size || "0", 10),
    mimeType: data.mimeType || mimeType,
    thumbnailLink: data.thumbnailLink || null,
    parentDriveFileId: parent,
  };
}

// ── Download / Stream ─────────────────────────────────────────────────────────

export async function downloadFile(account, driveFileId) {
  const drive = buildService(account);
  const response = await retryOnRateLimit(() =>
    drive.files.get({ fileId: driveFileId, alt: "media" }, { responseType: "arraybuffer" })
  );
  return Buffer.from(response.data);
}

export async function* streamFile(account, driveFileId) {
  const drive = buildService(account);
  const response = await retryOnRateLimit(() =>
    drive.files.get({ fileId: driveFileId, alt: "media" }, { responseType: "stream" })
  );
  for await (const chunk of response.data) {
    yield chunk;
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────

export async function renameFile(account, driveFileId, newName) {
  const drive = buildService(account);
  const result = await retryOnRateLimit(() =>
    drive.files.update({
      fileId: driveFileId,
      requestBody: { name: newName },
      fields: "id,name,thumbnailLink",
    })
  );
  return result.data;
}

// ── Move ──────────────────────────────────────────────────────────────────────

export async function moveFile(account, driveFileId, newParentId, oldParentId = null) {
  const drive = buildService(account);

  let currentParents = [];
  try {
    const meta = await drive.files.get({ fileId: driveFileId, fields: "id,parents" });
    currentParents = meta.data.parents || [];
  } catch (_) {}

  let removeParents;
  if (currentParents.length) {
    removeParents = currentParents.join(",");
  } else if (oldParentId) {
    removeParents = oldParentId;
  } else {
    try {
      const rootMeta = await drive.files.get({ fileId: "root", fields: "id" });
      removeParents = rootMeta.data.id;
    } catch (_) {
      removeParents = null;
    }
  }

  if (!removeParents) {
    throw new Error(
      "Cannot determine current parent folder — file may be shared from another account and cannot be moved"
    );
  }

  await retryOnRateLimit(() =>
    drive.files.update({
      fileId: driveFileId,
      addParents: newParentId,
      removeParents,
      fields: "id",
    })
  );
}

// ── Delete / Trash / Restore ──────────────────────────────────────────────────

export async function deleteDriveFile(account, driveFileId) {
  const drive = buildService(account);
  await retryOnRateLimit(() => drive.files.delete({ fileId: driveFileId }));
  invalidateQuotaCache(account.accountIndex);
}

export async function trashDriveFile(account, driveFileId) {
  const drive = buildService(account);
  await retryOnRateLimit(() =>
    drive.files.update({ fileId: driveFileId, requestBody: { trashed: true } })
  );
  invalidateQuotaCache(account.accountIndex);
}

export async function restoreFile(account, driveFileId) {
  const drive = buildService(account);
  await retryOnRateLimit(() =>
    drive.files.update({ fileId: driveFileId, requestBody: { trashed: false } })
  );
}

// ── Trash listing ─────────────────────────────────────────────────────────────

export async function listTrashFiles(account) {
  const drive = buildService(account);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: "'me' in owners and trashed = true",
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, trashedTime)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        trashedAt: f.trashedTime || "",
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

// ── Share / Unshare ───────────────────────────────────────────────────────────

export async function shareFile(account, driveFileId) {
  const drive = buildService(account);
  await retryOnRateLimit(() =>
    drive.permissions.create({
      fileId: driveFileId,
      requestBody: { type: "anyone", role: "reader" },
      fields: "id",
    })
  );
  const meta = await retryOnRateLimit(() =>
    drive.files.get({ fileId: driveFileId, fields: "webViewLink" })
  );
  return (
    meta.data.webViewLink ||
    `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`
  );
}

export async function unshareFile(account, driveFileId) {
  const drive = buildService(account);
  const perms = await retryOnRateLimit(() =>
    drive.permissions.list({ fileId: driveFileId, fields: "permissions(id,type)" })
  );
  const anyoneId = (perms.data.permissions || []).find((p) => p.type === "anyone")?.id;
  if (anyoneId) {
    await retryOnRateLimit(() =>
      drive.permissions.delete({ fileId: driveFileId, permissionId: anyoneId })
    );
  }
}

// ── Shared-with-me ────────────────────────────────────────────────────────────

export async function listSharedFiles(account) {
  const drive = buildService(account);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: "not 'me' in owners and trashed = false",
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, createdTime, owners)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      const owner = f.owners?.[0]?.emailAddress || null;
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        createdAt: f.createdTime || "",
        sharedBy: owner,
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

export async function listSharedFolderChildren(account, folderId) {
  const drive = buildService(account);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, createdTime, owners)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      const owner = f.owners?.[0]?.emailAddress || null;
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        createdAt: f.createdTime || "",
        sharedBy: owner,
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items.sort((a, b) => {
    const aIsFolder = a.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    const bIsFolder = b.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
    return a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase());
  });
}

export async function removeSharedFile(account, driveFileId) {
  const drive = buildService(account);

  try {
    await retryOnRateLimit(() => drive.files.delete({ fileId: driveFileId }));
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status !== 403 && status !== 404) throw err;
  }

  try {
    await retryOnRateLimit(() =>
      drive.files.update({ fileId: driveFileId, requestBody: { trashed: true } })
    );
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status !== 403) throw err;
  }

  try {
    const about = await retryOnRateLimit(() =>
      drive.about.get({ fields: "user(permissionId)" })
    );
    const userPermId = about.data.user?.permissionId;
    await retryOnRateLimit(() =>
      drive.permissions.delete({ fileId: driveFileId, permissionId: userPermId })
    );
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status === 404) {
      const e = new Error(
        "This file is shared via link — Google Drive's API does not allow removing " +
          "link-shared files from 'Shared with me'. Use the Google Drive web app to remove it."
      );
      e.isValidation = true;
      throw e;
    }
    throw err;
  }
}

// ── Profile folder ────────────────────────────────────────────────────────────

export async function getOrCreateProfileFolder(account) {
  const drive = buildService(account);
  const query = `name='${PROFILE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const result = await retryOnRateLimit(() =>
    drive.files.list({ q: query, fields: "files(id)" })
  );
  const existing = result.data.files || [];
  if (existing.length) return existing[0].id;

  const folder = await retryOnRateLimit(() =>
    drive.files.create({
      requestBody: {
        name: PROFILE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    })
  );
  return folder.data.id;
}

// ── List all owned files (for sync) ──────────────────────────────────────────

export async function listAllFiles(account) {
  const drive = buildService(account);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: "'me' in owners and trashed = false",
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, thumbnailLink, createdTime, parents)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    items.push(...(result.data.files || []));
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

// ── Sync ──────────────────────────────────────────────────────────────────────

function parseDriveTime(s) {
  if (!s) return new Date();
  return new Date(s);
}

export async function syncFilesFromDrives() {
  const accounts = await DriveAccount.find({ isConnected: true }).lean();
  let total = 0;
  for (const account of accounts) {
    try {
      const driveFiles = await listAllFiles(account);
      const driveIds = new Set(driveFiles.map((f) => f.id));

      // Remove local DB entries that no longer exist on Drive
      await File.deleteMany({
        accountIndex: account.accountIndex,
        driveFileId: { $nin: Array.from(driveIds) },
      });

      // Bulk upsert using bulkWrite for speed
      if (driveFiles.length > 0) {
        const ops = driveFiles.map((df) => ({
          updateOne: {
            filter: { driveFileId: df.id, accountIndex: account.accountIndex },
            update: {
              $set: {
                fileName: df.name || "",
                size: parseInt(df.size || "0", 10),
                mimeType: df.mimeType || null,
                thumbnailLink: df.thumbnailLink || null,
                parentDriveFileId: df.parents?.[0] || null,
              },
              $setOnInsert: {
                driveFileId: df.id,
                accountIndex: account.accountIndex,
                createdAt: parseDriveTime(df.createdTime),
              },
            },
            upsert: true,
          },
        }));
        await File.bulkWrite(ops, { ordered: false });
      }

      total += driveFiles.length;
      // Invalidate quota cache after sync so counts stay accurate
      invalidateQuotaCache(account.accountIndex);
    } catch (err) {
      console.error(`[Sync] Error syncing account ${account.accountIndex}:`, err.message);
    }
  }
  return total;
}