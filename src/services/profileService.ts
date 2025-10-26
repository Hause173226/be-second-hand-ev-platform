import { User } from "../models/User";

export const profileService = {
  // ===== PROFILE MANAGEMENT =====

  // Lấy profile của user
  getOrCreateProfile: async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found with ID:", userId);
      throw new Error("User not found");
    }
    const userObj = user.toObject() as any;
    delete userObj.roles; // Chỉ giữ role (string)
    delete userObj.phoneVerified; // Đã bỏ field này
    return userObj;
  },

  // Cập nhật thông tin cá nhân
  updatePersonalInfo: async (userId: string, personalData: any) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Cập nhật các fields được phép
    const allowedFields = [
      "fullName",
      "avatar",
      "gender",
      "dateOfBirth",
      "addresses",
    ];

    allowedFields.forEach((field) => {
      if (personalData[field] !== undefined) {
        (user as any)[field] = personalData[field];
      }
    });

    await user.save();

    const userObj = user.toObject() as any;
    delete userObj.roles; // Chỉ giữ role (string)
    delete userObj.phoneVerified; // Đã bỏ field này
    return userObj;
  },

  // ===== UTILITY METHODS =====

  // Lấy thống kê profile
  getProfileStats: async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const userObj = user.toObject() as any;
    delete userObj.roles; // Chỉ giữ role (string)
    delete userObj.phoneVerified; // Đã bỏ field này
    return {
      profile: userObj,
      stats: user.stats || {
        soldCount: 0,
        buyCount: 0,
        cancelRate: 0,
        responseTime: 0,
        completionRate: 0,
      },
    };
  },
};
