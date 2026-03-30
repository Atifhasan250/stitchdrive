import "dotenv/config";
import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "./db/index.js";
import { loadSecretsFromDB } from "./utils/configLoader.js";
import { syncFilesFromDrives, preWarmTokens } from "./services/driveService.js";
import { FRONTEND_URL } from "./config/index.js";

import authRoutes from "./routes/auth.js";
import accountsRoutes from "./routes/accounts.js";
import filesRoutes from "./routes/files.js";
import profileRoutes from "./routes/profile.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 8000;
const IS_PROD = process.env.NODE_ENV === "production";

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Request logger ────────────────────────────────────────────────────────────
app.use(morgan(IS_PROD ? "combined" : "dev"));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  ...new Set([
    "http://localhost:3000",
    "https://atifs-drive.vercel.app",
    FRONTEND_URL,
  ].filter(Boolean)),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/profile", profileRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/active", (req, res) => res.json({ status: "active" }));

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Background periodic sync (every 15 minutes) ───────────────────────────────
function startPeriodicSync() {
  const INTERVAL_MS = 15 * 60 * 1000;
  setInterval(() => {
    syncFilesFromDrives()
      .then((total) => console.log(`[Sync] Periodic sync complete — ${total} files indexed.`))
      .catch((err) => console.error("[Sync] Periodic sync error:", err.message));
  }, INTERVAL_MS);
  console.log("[Sync] Periodic sync scheduled every 15 minutes.");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  await loadSecretsFromDB();

  // Pre-warm OAuth2 tokens so first user request has no token exchange delay
  await preWarmTokens();

  // Startup sync (non-blocking — runs in background)
  syncFilesFromDrives()
    .then((total) => console.log(`[Sync] Startup sync complete — ${total} files indexed.`))
    .catch((err) => console.error("[Sync] Startup sync error:", err.message));

  startPeriodicSync();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Server] DrivePool API running on http://0.0.0.0:${PORT} (${IS_PROD ? "production" : "development"})`
    );
  });
}

bootstrap();