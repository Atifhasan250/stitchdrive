import { verifyJWT } from "../services/authService.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ detail: "Not authenticated" });
  }
  try {
    req.user = verifyJWT(token);
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid or expired token" });
  }
}
