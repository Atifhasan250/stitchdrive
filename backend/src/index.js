import "dotenv/config";
import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { connectDB } from "./db/index.js";
import { loadSecretsFromDB } from "./utils/configLoader.js";
import { syncFilesFromDrives } from "./services/driveService.js";
import { FRONTEND_URL } from "./config/index.js";

import authRoutes from "./routes/auth.js";
import accountsRoutes from "./routes/accounts.js";
import filesRoutes from "./routes/files.js";
import profileRoutes from "./routes/profile.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 8000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/profile", profileRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/active", (req, res) => res.json({ status: "active" }));

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  await loadSecretsFromDB();

  // Sync Drive files on startup (non-blocking — same behaviour as Python lifespan)
  syncFilesFromDrives()
    .then((total) => console.log(`[Sync] Startup sync complete — ${total} files indexed.`))
    .catch((err) => console.error("[Sync] Startup sync error:", err.message));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] DrivePool API running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
