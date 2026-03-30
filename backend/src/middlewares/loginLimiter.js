import { rateLimit } from "express-rate-limit";

// 10 login attempts per 15 minutes per IP — prevents PIN brute-force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many login attempts. Please try again in 15 minutes." },
  keyGenerator: (req) => req.ip,
});
