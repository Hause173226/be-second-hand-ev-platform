// src/interfaces/IListing.ts
import { Types } from "mongoose";

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
  location?: {
    city?: string;
    district?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  priceListed: number;
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
