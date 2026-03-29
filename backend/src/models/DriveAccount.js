import mongoose from "mongoose";

const driveAccountSchema = new mongoose.Schema(
  {
    accountIndex: { type: Number, required: true, unique: true, index: true },
    email: { type: String, default: null },
    refreshToken: { type: String, default: null },
    accessToken: { type: String, default: null },
    tokenExpiry: { type: Date, default: null },
    isConnected: { type: Boolean, default: false, required: true },
  },
  { collection: "drive_accounts", timestamps: false }
);

const DriveAccount = mongoose.model("DriveAccount", driveAccountSchema);
export default DriveAccount;
