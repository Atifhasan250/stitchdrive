import AppConfig from "../models/AppConfig.js";
import { setSecrets } from "../config/index.js";

export async function loadSecretsFromDB() {
  try {
    const [pinHash, jwtSecret, encryptionKey] = await Promise.all([
      AppConfig.getConfig("dashboard_pin_hash"),
      AppConfig.getConfig("jwt_secret"),
      AppConfig.getConfig("encryption_key"),
    ]);
    setSecrets({
      dashboard_pin_hash: pinHash,
      jwt_secret: jwtSecret,
      encryption_key: encryptionKey,
    });
    console.log("[Config] Secrets loaded from database.");
  } catch (err) {
    console.error("[Config] Failed to load secrets:", err.message);
    console.error("         Run: node scripts/generate_secrets.js");
    process.exit(1);
  }
}
