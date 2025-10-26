export interface IAddress {
  _id?: any;
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

export interface IPaymentMethod {
  _id?: any;
  provider: "stripe" | "xpay" | "momo" | "zalopay" | "bank" | string;
  tokenId: string;
  brand?: string;
  last4?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IKYCVerification {
  _id?: any;
  userId: string;
  level: "BASIC" | "ADVANCED";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  documents: {
    type: "CITIZEN_ID" | "DRIVER_LICENSE" | "PASSPORT" | "SELFIE";
    url: string;
    verified: boolean;
    uploadedAt: Date;
  }[];
  citizenId?: string;
  fullName?: string;
  dateOfBirth?: Date;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  issueDate?: Date;
  expiryDate?: Date;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProfile {
  _id?: string;
  userId: string | any;
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
