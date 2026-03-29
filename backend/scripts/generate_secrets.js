#!/usr/bin/env node
/**
 * Run once to set up the dashboard PIN and generate all secrets.
 * Secrets are stored directly in MongoDB — no .env secrets required.
 *
 * Usage:
 *   node scripts/generate_secrets.js
 */

import "dotenv/config";
import readline from "readline";
import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/drivepool";

// ── Fernet key generation (32 random bytes → base64) ──────────────────────────
function generateFernetKey() {
  return crypto.randomBytes(32).toString("base64");
}

function generateJwtSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

// ── Minimal AppConfig schema (avoids importing the full app) ──────────────────
const appConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { collection: "app_config" }
);
appConfigSchema.statics.upsert = async function (key, value) {
  await this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};
const AppConfig = mongoose.model("AppConfig", appConfigSchema);

// ── Prompt helpers ────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Collect all input BEFORE touching MongoDB
  const pin = await prompt("Enter your dashboard PIN: ");
  if (!pin) {
    console.error("PIN cannot be empty.");
    process.exit(1);
  }

  console.log("\nConnecting to MongoDB...");
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  // Check whether secrets already exist
  const existing = await AppConfig.findOne({ key: "dashboard_pin_hash" });
  if (existing) {
    const overwrite = await prompt("Secrets already exist. Regenerate them? [y/N] ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted — existing secrets unchanged.");
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  console.log("Generating secrets...");
  const pinHash = await bcrypt.hash(pin, 12);
  const jwtSecret = generateJwtSecret();
  const encryptionKey = generateFernetKey();

  await AppConfig.upsert("dashboard_pin_hash", pinHash);
  await AppConfig.upsert("jwt_secret", jwtSecret);
  await AppConfig.upsert("encryption_key", encryptionKey);

  console.log(`\nSecrets saved to MongoDB (${MONGO_URI})`);
  console.log("You can now start the backend:\n");
  console.log("    npm start\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});