export interface IAddress {
  _id?: any;
  fullAddress?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IUser {
  _id?: string;

  // Authentication
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  password?: string;
  roles: string[];
  role?: "user" | "staff" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  lastLoginAt?: Date;

  // Profile
  fullName?: string;
  avatar?: string;
  currentMembership?: string;
  membershipBadge?: string;
  gender?: string;
  dateOfBirth?: Date;
  citizenId?: string;
  address?: IAddress;

  // Stats & Rating
  rating?: number;
  stats?: {
    soldCount: number;
    buyCount: number;
    cancelRate: number;
    responseTime: number;
    completionRate: number;
  };

  // OTP & Verification
  otpCode?: string;
  otpExpires?: Date;

  // Tokens
  refreshToken?: string;

  // SSO
  googleId?: string;
  facebookId?: string;

  // eKYC
  ekycStatus?: "unverified" | "pending" | "verified" | "rejected";
  ekycProvider?: "FPT";
  ekycRefId?: string;
  ekycResult?: any;
  verifiedAt?: Date;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}
