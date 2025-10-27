// src/models/Listing.ts
import { Schema, model, Types } from "mongoose";
import { IListing } from "../interfaces/IListing";

/** ---- Sub-schemas ---- */
const mediaSchema = new Schema(
  {
    url: { type: String, required: true }, // Cloudinary secure_url
    kind: { type: String, enum: ["photo", "doc"], default: "photo" },
    publicId: { type: String, required: true, index: true }, // ✅ bắt buộc & index
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
  },
  { _id: false, id: false }
);

const locationSchema = new Schema(
  {
    city: { type: String },
    district: { type: String },
    address: { type: String },
  },
  { _id: false, id: false }
);

/**
 * Lưu ý:
 * - Mongoose không hiểu union TypeScript => khai báo tất cả field có thể dùng.
 * - Các ràng buộc như "Car phải có ...", "Battery phải có ..." xử lý ở controller/UI.
 * - Số lượng ảnh tối thiểu (>=3) được kiểm tra lúc create/submit, không ép ở schema.
 */
const listingSchema = new Schema<IListing>(
  {
    sellerId: { type: Types.ObjectId, ref: "User", required: true } as any,

    type: { type: String, enum: ["Car", "Battery"], required: true },

    // Chung
    make: { type: String },
    model: { type: String },
    year: { type: Number },

    condition: {
      type: String,
      enum: ["New", "LikeNew", "Used", "Worn"],
      default: "Used",
    },

    // Battery-only
    batteryCapacityKWh: { type: Number },
    chargeCycles: { type: Number },

    // Car-only (mẫu hợp đồng)
    licensePlate: { type: String, trim: true },
    engineDisplacementCc: { type: Number },
    vehicleType: { type: String },
    paintColor: { type: String },
    engineNumber: { type: String },
    chassisNumber: { type: String },
    otherFeatures: { type: String },

    // Chung tiếp
    mileageKm: { type: Number },

    // Ảnh & tài liệu
    photos: { type: [mediaSchema], default: [] },     // ✅ KHÔNG required để edit linh hoạt
    documents: { type: [mediaSchema], default: [] },

    location: { type: locationSchema, default: undefined },

    priceListed: { type: Number, required: true, min: 0 },

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

/** ---- Indexes ---- */
listingSchema.index({ status: 1, publishedAt: -1 });
listingSchema.index({ make: 1, model: 1, year: -1 });
listingSchema.index({ "location.city": 1, "location.district": 1 });
listingSchema.index({ licensePlate: 1 }, { sparse: true });
// hữu ích khi reorder/xoá ảnh theo publicId
listingSchema.index({ "photos.publicId": 1 }, { sparse: true });

export default model<IListing>("Listing", listingSchema);
