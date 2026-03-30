import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { listAccounts, disconnectAccount, getAccessToken } from "../controllers/accountsController.js";

const router = Router();

router.get("/", requireAuth, listAccounts);
router.get("/:accountIndex/token", requireAuth, getAccessToken);
router.delete("/:accountIndex", requireAuth, disconnectAccount);

export default router;
