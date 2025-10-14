export interface IUser {
  fullName: string;
  phone: string;
  email?: string;
  citizenId?: string;
  password?: string; // Optional for phone authentication
  dateOfBirth?: Date;
  role?: "user" | "admin";
  gender?: "male" | "female" | "other";
  address?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  otpCode?: string;
  otpExpires?: Date;
  refreshToken?: string; // Added for JWT refresh token
  avatar?: string;
  // SSO fields
  googleId?: string;
  facebookId?: string;
}
