import mongoose, { Schema } from "mongoose";

export interface IKYCVerification {
  _id?: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  documents: IKYCDocument[];
  reviewNotes?: string;
  reviewedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKYCDocument {
  type:
    | "citizen_id_front"
    | "citizen_id_back"
    | "driver_license"
    | "passport"
    | "other";
  url: string;
  issuedAt?: Date;
  expiredAt?: Date;
}

const kycDocumentSchema = new Schema({
  type: {
    type: String,
    enum: [
      "citizen_id_front",
      "citizen_id_back",
      "driver_license",
      "passport",
      "other",
    ],
    required: true,
  },
  url: { type: String, required: true },
  issuedAt: { type: Date },
  expiredAt: { type: Date },
  // CCCD scanning fields
  scannedData: {
    idNumber: { type: String },
    fullName: { type: String },
    dateOfBirth: { type: String },
    gender: { type: String },
    nationality: { type: String },
    placeOfOrigin: { type: String },
    placeOfResidence: { type: String },
    issuedDate: { type: String },
    issuedPlace: { type: String },
    confidence: { type: Number, min: 0, max: 100 },
  },
  scanStatus: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED"],
    default: "PENDING",
  },
  scanError: { type: String },
});

const kycVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
      required: true,
    },
    documents: [kycDocumentSchema],
    reviewNotes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes
kycVerificationSchema.index({ userId: 1 });
kycVerificationSchema.index({ status: 1 });

export const KYCVerification = mongoose.model<IKYCVerification>(
  "KYCVerification",
  kycVerificationSchema
);
