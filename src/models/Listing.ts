// src/models/Listing.ts
import { Schema, model } from "mongoose";
import { IListing } from "../interfaces/IListing";

/** ---- Sub-schemas ---- */
const mediaSchema = new Schema(
  {
    url: { type: String, required: true },               // Cloudinary secure_url
    kind: { type: String, enum: ["photo", "doc"], default: "photo" },
    publicId: { type: String },                          // Cloudinary public_id
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    city: { type: String },
    district: { type: String },
    address: { type: String },
    // lat/lng đã bỏ theo yêu cầu
  },
  { _id: false }
);

/** ---- Listing schema ----
 * Lưu ý: Mongoose không hiểu union TS. Ta khai báo tất cả field cần dùng ở runtime,
 * những field chỉ áp dụng cho Car/Battery để optional.
 */
const listingSchema = new Schema<IListing>(
  {
    sellerId: { type: Schema.Types.ObjectId as any, ref: "User", required: true },

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

    // Battery-only (optional trong DB, ràng buộc ở controller/UI)
    batteryCapacityKWh: { type: Number },
    chargeCycles: { type: Number },

    // Car-only (theo mẫu hợp đồng, tất cả optional)
    licensePlate: { type: String, trim: true },          // Biển số
    engineDisplacementCc: { type: Number },              // Dung tích xi lanh
    vehicleType: { type: String },                       // Loại xe
    paintColor: { type: String },                        // Màu sơn
    engineNumber: { type: String },                      // Số máy
    chassisNumber: { type: String },                     // Số khung
    otherFeatures: { type: String },                     // Đặc điểm khác

    // Chung tiếp
    mileageKm: { type: Number },

    photos: { type: [mediaSchema], required: true, default: [] },
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

/** (tuỳ chọn) Index nhẹ cho tìm kiếm/filter phổ biến */
listingSchema.index({ status: 1, publishedAt: -1 });
listingSchema.index({ make: 1, model: 1, year: -1 });
listingSchema.index({ "location.city": 1, "location.district": 1 });
listingSchema.index({ licensePlate: 1 }, { sparse: true }); // biển số có thể trùng/thiếu → sparse

export default model<IListing>("Listing", listingSchema);
