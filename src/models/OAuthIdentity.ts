import mongoose, { Schema } from "mongoose";

export interface IOAuthIdentity {
  _id?: string;
  userId: string;
  provider: "google" | "apple" | "facebook" | string;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
  linkedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const oauthIdentitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    scopes: [{ type: String }],
    linkedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
oauthIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
oauthIdentitySchema.index({ userId: 1 });

export const OAuthIdentity = mongoose.model<IOAuthIdentity>(
  "OAuthIdentity",
  oauthIdentitySchema
);
