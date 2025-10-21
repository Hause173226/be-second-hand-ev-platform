export interface IProfile {
  _id?: string;
  userId: any; // Mongoose ObjectId
  fullName?: string;
  avatarUrl?: string;
  addresses?: IAddress[];
  kycLevel: "NONE" | "BASIC" | "ADVANCED";
  rating?: number;
  stats?: {
    soldCount: number;
    buyCount: number;
    cancelRate: number;
    responseTime: number;
    completionRate: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAddress {
  _id?: any; // Mongoose ObjectId
  type: "home" | "work" | "other";
  name: string;
  fullAddress: string;
  ward: string;
  district: string;
  city: string;
  province: string;
  postalCode?: string;
  isDefault: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKYCVerification {
  _id?: string;
  userId: any; // Mongoose ObjectId
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  documents: IKYCDocument[];
  reviewNotes?: string;
  reviewedBy?: any; // Mongoose ObjectId
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKYCDocument {
  _id?: any; // Mongoose ObjectId
  type:
    | "citizen_id_front"
    | "citizen_id_back"
    | "driver_license"
    | "passport"
    | "other";
  url: string;
  issuedAt?: Date;
  expiredAt?: Date;
  // CCCD scanning fields
  scannedData?: {
    idNumber?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    placeOfOrigin?: string;
    placeOfResidence?: string;
    issuedDate?: string;
    issuedPlace?: string;
    confidence?: number; // OCR confidence score 0-100
  };
  scanStatus?: "PENDING" | "SUCCESS" | "FAILED";
  scanError?: string;
}

export interface IPaymentMethod {
  _id?: string;
  userId: any; // Mongoose ObjectId
  provider: "stripe" | "xpay" | "momo" | "zalopay" | "bank" | string;
  tokenId: string;
  brand?: string;
  last4?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
