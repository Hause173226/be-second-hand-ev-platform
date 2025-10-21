export interface IUser {
  _id?: string;

  // New schema fields
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  passwordHash?: string;
  role: "user" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Legacy fields (để backward compatibility)
  fullName?: string;
  password?: string;
  citizenId?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  isActive?: boolean;
  otpCode?: string;
  otpExpires?: Date;
  refreshToken?: string;
  avatar?: string;
  googleId?: string;
  facebookId?: string;
}
