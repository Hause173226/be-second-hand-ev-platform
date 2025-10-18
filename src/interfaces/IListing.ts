// src/interfaces/IListing.ts
import { Types } from "mongoose";

export type TradeMethod = "meet" | "ship" | "consignment";

export interface IListing {
  _id?: Types.ObjectId;
  sellerId: Types.ObjectId; // hoặc: string | Types.ObjectId
  type: "Car" | "Battery";
  make?: string;
  model?: string;
  year?: number;
  batteryCapacityKWh?: number;
  mileageKm?: number;
  chargeCycles?: number;
  condition?: "New" | "LikeNew" | "Used" | "Worn";
  photos: { url: string; kind: "photo" | "doc" }[];
  documents?: { url: string; kind: "photo" | "doc" }[];

  // Location: bỏ lat/lng như bạn yêu cầu
  location?: {
    city?: string;
    district?: string;
    address?: string;
  };

  // Phần 15
  priceListed: number;                // giá niêm yết (>= 0)
  tradeMethod?: TradeMethod;          // "meet" | "ship" | "consignment"

  status:
    | "Draft"
    | "PendingReview"
    | "Published"
    | "InTransaction"
    | "Sold"
    | "Expired"
    | "Rejected";

  notes?: string;
  rejectReason?: string;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
