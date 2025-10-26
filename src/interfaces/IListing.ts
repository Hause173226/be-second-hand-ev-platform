// src/interfaces/IListing.ts

export interface IMedia {
  url: string;
  kind: "photo" | "doc";
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface ILocation {
  city?: string;
  district?: string;
  address?: string;
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

interface BaseListing {
  _id?: string;
  sellerId: string;
  photos: IMedia[];
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

  condition?: "New" | "LikeNew" | "Used" | "Worn";
}

export interface CarListing extends BaseListing {
  type: "Car";
  // Chung
  make?: string;               // Nhãn hiệu
  model?: string;
  year?: number;
  mileageKm?: number;

  // Các trường hợp đồng
  licensePlate?: string;       // Biển số
  engineDisplacementCc?: number; // Dung tích xi lanh
  vehicleType?: string;        // Loại xe
  paintColor?: string;         // Màu sơn
  engineNumber?: string;       // Số máy
  chassisNumber?: string;      // Số khung
  otherFeatures?: string;      // Các đặc điểm khác
}

export interface BatteryListing extends BaseListing {
  type: "Battery";
  make?: string;
  model?: string;
  year?: number;

  batteryCapacityKWh?: number;
  chargeCycles?: number;
}

export type IListing = CarListing | BatteryListing;
