import "dotenv/config";

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
export const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/drivepool";
export const CONFIG_DIR = process.env.CONFIG_DIR || "./config";
export const JWT_ALGORITHM = "HS256";
export const JWT_EXPIRE_HOURS = 24;

// These are loaded from the DB after connection - see configLoader.js
export let DASHBOARD_PIN_HASH = null;
export let JWT_SECRET = null;
export let ENCRYPTION_KEY = null;

export function setSecrets({ dashboard_pin_hash, jwt_secret, encryption_key }) {
  DASHBOARD_PIN_HASH = dashboard_pin_hash;
  JWT_SECRET = jwt_secret;
  ENCRYPTION_KEY = encryption_key;
}
