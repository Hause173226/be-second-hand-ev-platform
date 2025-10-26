// src/interfaces/IListing.ts

export interface IMedia {
  url: string;                 // Cloudinary URL (nên dùng secure_url)
  kind: "photo" | "doc";
  publicId?: string;           // Cloudinary public_id (để xoá/transform)
  width?: number;              // optional metadata
  height?: number;             // optional metadata
  format?: string;             // ví dụ: jpg, png, webp
}

export interface ILocation {
  city?: string;
  district?: string;
  address?: string;
  // lat/lng đã bỏ theo yêu cầu
}

export type ListingStatus =
  | "Draft"
  | "PendingReview"
  | "Published"
  | "InTransaction"
  | "Sold"
  | "Expired"
  | "Rejected";

export type TradeMethod = "meet" | "ship" | "consignment";

export interface IListing {
  _id?: string;
  sellerId: string;            // ObjectId string
  type: "Car" | "Battery";

  make?: string;
  model?: string;
  year?: number;

  batteryCapacityKWh?: number;
  mileageKm?: number;
  chargeCycles?: number;

  condition?: "New" | "LikeNew" | "Used" | "Worn";

  photos: IMedia[];            // chứa url + publicId
  documents?: IMedia[];

  location?: ILocation;

  priceListed: number;
  tradeMethod: TradeMethod;

  status?: ListingStatus;
  notes?: string;
  rejectReason?: string;
  publishedAt?: string | Date;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}
