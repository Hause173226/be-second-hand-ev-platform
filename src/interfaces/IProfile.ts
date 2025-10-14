// src/interfaces/IProfile.ts
import { Types } from "mongoose";

export interface IProfile {
  userId: Types.ObjectId;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  preferences?: {
    notifications?: boolean;
    emailUpdates?: boolean;
    smsUpdates?: boolean;
  };
  vehiclePreferences?: {
    brands?: string[];
    priceRange?: {
      min?: number;
      max?: number;
    };
    fuelTypes?: string[];
  };
  isComplete?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
