import mongoose from "mongoose";

// Migration strategy để đảm bảo backward compatibility
export const migrationService = {
  // Migrate User từ schema cũ sang schema mới
  migrateUserSchema: async () => {
    const User = mongoose.model("User");

    // Lấy tất cả users hiện tại
    const users = await User.find({});

    for (const user of users) {
      const updateData: any = {};

      // Map các field cũ sang field mới
      if (user.fullName && !user.fullName) {
        updateData.fullName = user.fullName;
      }

      if (user.password && !user.passwordHash) {
        updateData.passwordHash = user.password;
      }

      if (user.role && !user.roles) {
        updateData.roles = [user.role];
      }

      if (user.isActive !== undefined && !user.status) {
        updateData.status = user.isActive ? "ACTIVE" : "SUSPENDED";
      }

      // Chỉ update nếu có thay đổi
      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(user._id, updateData);
        console.log(`Migrated user ${user._id}`);
      }
    }

    console.log("User migration completed");
  },

  // Rollback migration nếu cần
  rollbackUserSchema: async () => {
    const User = mongoose.model("User");

    const users = await User.find({});

    for (const user of users) {
      const updateData: any = {};

      // Map ngược từ field mới sang field cũ
      if (user.passwordHash && !user.password) {
        updateData.password = user.passwordHash;
      }

      if (user.roles && user.roles.length > 0 && !user.role) {
        updateData.role = user.roles[0];
      }

      if (user.status && !user.isActive) {
        updateData.isActive = user.status === "ACTIVE";
      }

      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(user._id, updateData);
        console.log(`Rolled back user ${user._id}`);
      }
    }

    console.log("User rollback completed");
  },
};
