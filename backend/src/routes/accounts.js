import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { listAccounts, disconnectAccount } from "../controllers/accountsController.js";

const router = Router();

router.get("/", requireAuth, listAccounts);
router.delete("/:accountIndex", requireAuth, disconnectAccount);

export default router;
