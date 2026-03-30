import { getAuth } from "@clerk/express";

/**
 * Clerk-first auth middleware.
 * Checks for Clerk userId (from JWT Bearer token set by frontend).
 */
export function requireAuth(req, res, next) {
  const clerkAuth = getAuth(req);
  if (clerkAuth?.userId) {
    req.user = { sub: clerkAuth.userId };
    req.ownerId = clerkAuth.userId;
    return next();
  }

  // Not authenticated via Clerk
  return res.status(401).json({ detail: "Not authenticated via Clerk" });
}
