import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.js";
import {
  syncFiles,
  listFiles,
  upload,
  getDownload,
  getView,
  rename,
  moveFileRoute,
  shareFileRoute,
  unshareFileRoute,
  deleteFile,
  getThumbnail,
  downloadSharedFile,
  listSharedChildren,
  deleteSharedFile,
  listShared,
  listTrash,
  restoreTrashFile,
  deleteTrashFile,
} from "../controllers/filesController.js";

const router = Router();

// BUG FIX: added 500MB file size limit — without this a large upload buffers
// entirely in RAM and can crash the Node process
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── Static paths first (must come before /:fileId routes) ────────────────────
router.post("/sync", requireAuth, syncFiles);
router.get("/shared", requireAuth, listShared);
router.get("/trash", requireAuth, listTrash);

// ── Shared-file sub-routes ────────────────────────────────────────────────────
router.get("/shared/:accountIndex/:folderId/children", requireAuth, listSharedChildren);
router.get("/shared/:accountIndex/:driveFileId/download", requireAuth, downloadSharedFile);
router.delete("/shared/:accountIndex/:driveFileId", requireAuth, deleteSharedFile);

// ── Trash sub-routes ──────────────────────────────────────────────────────────
router.post("/trash/:accountIndex/:driveFileId/restore", requireAuth, restoreTrashFile);
router.delete("/trash/:accountIndex/:driveFileId", requireAuth, deleteTrashFile);

// ── Core file routes ──────────────────────────────────────────────────────────
router.get("/", requireAuth, listFiles);
router.post("/upload", requireAuth, memUpload.single("file"), upload);
router.get("/:fileId/download", requireAuth, getDownload);
router.get("/:fileId/view", requireAuth, getView);
router.get("/:fileId/thumbnail", requireAuth, getThumbnail);
router.patch("/:fileId/rename", requireAuth, rename);
router.patch("/:fileId/move", requireAuth, moveFileRoute);
router.post("/:fileId/share", requireAuth, shareFileRoute);
router.delete("/:fileId/share", requireAuth, unshareFileRoute);
router.delete("/:fileId", requireAuth, deleteFile);

export default router;