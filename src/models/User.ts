import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/IUser";

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    citizenId: { type: String },
    dateOfBirth: { type: Date },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    gender: { type: String, enum: ["male", "female", "other"] },
    address: { type: String },
    isActive: { type: Boolean, default: true }, // Add isActive field
    otpCode: { type: String },
    otpExpires: { type: Date },
    refreshToken: { type: String }, // Added for JWT refresh token
    avatar: { type: String },
    // SSO fields
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Loại bỏ password và refreshToken khi trả về JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export const User = mongoose.model<IUser>("User", userSchema);
