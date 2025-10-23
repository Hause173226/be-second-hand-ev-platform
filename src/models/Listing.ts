// src/models/Listing.ts
import { Schema, model } from "mongoose";
import { IListing } from "../interfaces/IListing";

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    kind: { type: String, enum: ["photo", "doc"], default: "photo" },
  },
  { _id: false }
);

const listingSchema = new Schema<IListing>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: { type: String, enum: ["Car", "Battery"], required: true },

    make: { type: String },
    model: { type: String },
    year: { type: Number },

    batteryCapacityKWh: { type: Number },
    mileageKm: { type: Number },
    chargeCycles: { type: Number },

    condition: {
      type: String,
      enum: ["New", "LikeNew", "Used", "Worn"],
      default: "Used",
    },

    photos: { type: [mediaSchema], required: true, default: [] },
    documents: { type: [mediaSchema], default: [] },

    location: {
      city: { type: String },
      district: { type: String },
      address: { type: String },
      // ❌ Bỏ lat/lng theo yêu cầu
    },

    priceListed: { type: Number, required: true, min: 0 },

    // ✅ Thêm tradeMethod (phần 15)
    tradeMethod: {
      type: String,
      enum: ["meet", "ship", "consignment"],
      default: "meet",
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "PendingReview",
        "Published",
        "InTransaction",
        "Sold",
        "Expired",
        "Rejected",
      ],
      default: "Draft",
    },

    notes: { type: String },
    rejectReason: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

export default model<IListing>("Listing", listingSchema);
