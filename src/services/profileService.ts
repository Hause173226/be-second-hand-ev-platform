// src/services/profileService.ts
import { Profile } from "../models/Profile";
import { AppError, errorMessages } from "../utils/errorHandler";
import { Types } from "mongoose";

export const profileService = {
  // Tạo profile rỗng cho user mới
  createEmptyProfile: async (userId: string) => {
    try {
      const profile = await Profile.create({
        userId: new Types.ObjectId(userId),
        preferences: {
          notifications: true,
          emailUpdates: true,
          smsUpdates: false,
        },
        isComplete: false,
      });

      return profile;
    } catch (error) {
      console.error("Error creating profile:", error);
      throw new AppError("Không thể tạo hồ sơ", 500);
    }
  },

  // Lấy profile theo userId
  getProfileByUserId: async (userId: string) => {
    try {
      const profile = await Profile.findOne({
        userId: new Types.ObjectId(userId),
      }).populate("userId", "fullName email phone");

      if (!profile) {
        throw new AppError("Không tìm thấy hồ sơ", 404);
      }

      return profile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error getting profile:", error);
      throw new AppError("Lỗi khi lấy hồ sơ", 500);
    }
  },

  // Cập nhật profile
  updateProfile: async (userId: string, updateData: any) => {
    try {
      const profile = await Profile.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          ...updateData,
          isComplete: checkProfileCompleteness(updateData),
          updatedAt: new Date(),
        },
        { new: true, runValidators: true }
      );

      if (!profile) {
        throw new AppError("Không tìm thấy hồ sơ", 404);
      }

      return profile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error updating profile:", error);
      throw new AppError("Lỗi khi cập nhật hồ sơ", 500);
    }
  },

  // Xóa profile
  deleteProfile: async (userId: string) => {
    try {
      const profile = await Profile.findOneAndDelete({
        userId: new Types.ObjectId(userId),
      });

      if (!profile) {
        throw new AppError("Không tìm thấy hồ sơ", 404);
      }

      return { message: "Hồ sơ đã được xóa thành công" };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error deleting profile:", error);
      throw new AppError("Lỗi khi xóa hồ sơ", 500);
    }
  },

  // Kiểm tra độ hoàn thiện của profile
  checkCompleteness: async (userId: string) => {
    try {
      const profile = await Profile.findOne({
        userId: new Types.ObjectId(userId),
      });

      if (!profile) {
        throw new AppError("Không tìm thấy hồ sơ", 404);
      }

      const completeness = checkProfileCompleteness(profile);

      // Cập nhật trạng thái hoàn thiện
      profile.isComplete = completeness.isComplete;
      await profile.save();

      return completeness;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error checking completeness:", error);
      throw new AppError("Lỗi khi kiểm tra độ hoàn thiện", 500);
    }
  },
};

// Helper function để kiểm tra độ hoàn thiện
const checkProfileCompleteness = (profile: any) => {
  const requiredFields = ["bio", "location"];
  const optionalFields = [
    "avatar",
    "website",
    "socialMedia",
    "vehiclePreferences",
  ];

  let completedFields = 0;
  let totalFields = requiredFields.length;

  // Kiểm tra các trường bắt buộc
  requiredFields.forEach((field) => {
    if (profile[field] && profile[field].trim() !== "") {
      completedFields++;
    }
  });

  // Kiểm tra các trường tùy chọn
  optionalFields.forEach((field) => {
    if (profile[field]) {
      if (typeof profile[field] === "object") {
        // Kiểm tra object có giá trị không
        const hasValue = Object.values(profile[field]).some(
          (value) =>
            value && (typeof value === "string" ? value.trim() !== "" : true)
        );
        if (hasValue) {
          completedFields++;
          totalFields++;
        }
      } else if (profile[field].trim() !== "") {
        completedFields++;
        totalFields++;
      }
    }
  });

  const percentage = Math.round((completedFields / totalFields) * 100);
  const isComplete = percentage >= 70; // 70% trở lên là hoàn thiện

  return {
    isComplete,
    percentage,
    completedFields,
    totalFields,
    missingFields: requiredFields.filter(
      (field) => !profile[field] || profile[field].trim() === ""
    ),
  };
};
