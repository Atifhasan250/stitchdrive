import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    displayName: { type: String, default: null },
    bio: { type: String, default: null },
    avatarDriveFileId: { type: String, default: null },
    avatarAccountIndex: { type: Number, default: null },
  },
  { collection: "profile", timestamps: false }
);

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
