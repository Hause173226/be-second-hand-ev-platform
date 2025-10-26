export interface IAddress {
  _id?: string;
  fullAddress: string;
  ward: string;
  district: string;
  city: string;
  province: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser {
  _id?: string;

  // New schema fields
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  passwordHash?: string;
  roles: string[];
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Legacy fields (để backward compatibility)
  fullName?: string;
  password?: string;
  citizenId?: string;
  dateOfBirth?: Date;
  role?: string;
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
}
