export interface IAddress {
  _id?: string;
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

export interface IUser {
  _id?: string;

  // Authentication fields
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  passwordHash?: string;
  roles: string[];
  phoneVerified?: boolean;
  password?: string;
  role: "user" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Profile fields (tích hợp từ Profile)
  fullName?: string;
  avatar?: string;
  addresses?: IAddress[];
  paymentMethods?: IPaymentMethod[];
  kycLevel: "NONE" | "BASIC" | "ADVANCED";
  rating?: number;
  stats?: {
    soldCount: number;
    buyCount: number;
    cancelRate: number;
    responseTime: number;
    completionRate: number;
  };

  // Personal info
  citizenId?: string;
  dateOfBirth?: Date;
  gender?: string;
  isActive?: boolean;
  otpCode?: string;
  otpExpires?: Date;
  refreshToken?: string;
  avatar?: string;

  // SSO IDs
  googleId?: string;
  facebookId?: string;

  // Profile stats
  rating?: number;
  stats?: {
    soldCount: number;
    buyCount: number;
    cancelRate: number;
    responseTime: number;
    completionRate: number;
  };
  addresses?: IAddress;

  // OTP & Tokens
  otpCode?: string;
  otpExpires?: Date;
  refreshToken?: string;

  // SSO
  googleId?: string;
  facebookId?: string;
}
