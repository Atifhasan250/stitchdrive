import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/loginLimiter.js";
import {
  login,
  logout,
  getNewOAuthUrl,
  getOAuthUrl,
  oauthCallback,
} from "../controllers/authController.js";

const router = Router();

// loginLimiter: 10 attempts per 15 min per IP — prevents PIN brute-force and OAuth abuse
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/oauth/new", requireAuth, loginLimiter, getNewOAuthUrl);
router.get("/oauth/:accountIndex", requireAuth, loginLimiter, getOAuthUrl);
router.get("/callback", loginLimiter, oauthCallback);

export default router;