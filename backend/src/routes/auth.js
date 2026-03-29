import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  login,
  logout,
  getNewOAuthUrl,
  getOAuthUrl,
  oauthCallback,
} from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/oauth/new", requireAuth, getNewOAuthUrl);
router.get("/oauth/:accountIndex", requireAuth, getOAuthUrl);
router.get("/callback", oauthCallback);

export default router;
