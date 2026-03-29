import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log("[DB] Connected to MongoDB:", MONGO_URI);
  } catch (err) {
    console.error("[DB] Connection error:", err.message);
    process.exit(1);
  }
}

export default mongoose;
