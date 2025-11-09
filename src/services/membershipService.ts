import { MembershipPackage } from "../models/MembershipPackage";
import { UserMembership } from "../models/UserMembership"; // ✅ FIX: Import UserMembership
import { User } from "../models/User";
import Listing from "../models/Listing";
import mongoose from "mongoose";

interface CanCreateListingResult {
  canCreate: boolean;
  reason?: string;
  current: number;
  max: number;
  packageName?: string;
}

export const membershipService = {
  getAllPackages: async () => {
    return await MembershipPackage.find({ isActive: true }).sort({
      displayOrder: 1,
    });
  },

  getCurrentMembership: async (userId: string) => {
    // ✅ FIX: Dùng UserMembership
    const membership = await UserMembership.findOne({
      userId,
      isActive: true,
      status: "ACTIVE",
    }).populate("packageId");

    // Kiểm tra expiration (chỉ với gói có endDate)
    if (membership && membership.endDate) {
      const now = new Date();
      if (membership.endDate < now) {
        membership.status = "EXPIRED";
        membership.isActive = false;
        await membership.save();

        console.log(`⏰ Membership expired for user ${userId}`);
        return null;
      }
    }

    return membership;
  },

  purchasePackage: async (
    userId: string,
    packageId: string,
    paymentId?: string,
    vnpTransactionNo?: string
  ) => {
    const pkg = await MembershipPackage.findById(packageId);
    if (!pkg) {
      throw new Error("Gói không tồn tại");
    }

    if (!pkg.isActive) {
      throw new Error("Gói này hiện không khả dụng");
    }

    // ✅ FIX: Dùng UserMembership
    const currentMembership = await UserMembership.findOne({
      userId,
      isActive: true,
    });

    if (currentMembership) {
      currentMembership.isActive = false;
      currentMembership.status = "CANCELLED";
      await currentMembership.save();
    }

    const startDate = new Date();
    let endDate: Date | null;

    if (pkg.isPermanent || pkg.price === 0) {
      endDate = null; // FREE vĩnh viễn
    } else {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + pkg.duration);
    }

    // ✅ FIX: Dùng UserMembership
    const newMembership = await UserMembership.create({
      userId,
      packageId,
      startDate,
      endDate,
      isActive: true,
      status: "ACTIVE",
      autoRenew: pkg.features.autoRenew,
      listingsUsed: 0,
      paymentId: paymentId ? new mongoose.Types.ObjectId(paymentId) : undefined,
      transactionId: vnpTransactionNo,
    });

    await User.findByIdAndUpdate(userId, {
      currentMembership: pkg._id,
      membershipBadge: pkg.features.badge,
    });

    console.log(`✅ Purchased ${pkg.name} for user ${userId}`);

    return newMembership;
  },

  renewMembership: async (
    userId: string,
    paymentId?: string,
    vnpTransactionNo?: string,
    months: number = 1 // ✅ THÊM param months
  ) => {
    const currentMembership = await UserMembership.findOne({
      userId,
      isActive: true,
    }).populate("packageId");

    if (!currentMembership) {
      throw new Error("Không tìm thấy gói đang sử dụng");
    }

    const pkg = await MembershipPackage.findById(currentMembership.packageId);
    if (!pkg) {
      throw new Error("Gói không tồn tại");
    }

    // Ngăn gia hạn gói FREE (nếu cần)
    if (pkg.isPermanent || pkg.price === 0) {
      throw new Error("Gói miễn phí là vĩnh viễn, không cần gia hạn");
    }

    if (!currentMembership.endDate) {
      throw new Error("Gói vĩnh viễn không cần gia hạn");
    }

    // ✅ Gia hạn theo số tháng
    const daysToAdd = months * 30;
    const newEndDate = new Date(currentMembership.endDate);
    newEndDate.setDate(newEndDate.getDate() + daysToAdd);

    currentMembership.endDate = newEndDate;

    if (paymentId) {
      currentMembership.paymentId = new mongoose.Types.ObjectId(paymentId);
      currentMembership.transactionId = vnpTransactionNo;
    }

    await currentMembership.save();

    console.log(`✅ Renewed ${pkg.name} for user ${userId} - ${months} months`);

    return currentMembership;
  },

  cancelMembership: async (userId: string) => {
    // ✅ FIX: Dùng UserMembership
    const membership = await UserMembership.findOne({
      userId,
      isActive: true,
    });

    if (!membership) {
      throw new Error("Không tìm thấy gói đang sử dụng");
    }

    membership.isActive = false;
    membership.status = "CANCELLED";
    await membership.save();

    await User.findByIdAndUpdate(userId, {
      currentMembership: null,
      membershipBadge: "",
    });

    console.log(`✅ Cancelled membership for user ${userId}`);

    return membership;
  },

  canCreateListing: async (userId: string): Promise<CanCreateListingResult> => {
    const membership = await membershipService.getCurrentMembership(userId);

    if (!membership) {
      return {
        canCreate: false,
        reason: "Không tìm thấy gói membership",
        current: 0,
        max: 0,
      };
    }

    const pkg = await MembershipPackage.findById(membership.packageId);
    if (!pkg) {
      return {
        canCreate: false,
        reason: "Không tìm thấy thông tin gói",
        current: 0,
        max: 0,
      };
    }

    const maxListings = pkg.features.maxListings;

    if (maxListings === -1) {
      return {
        canCreate: true,
        current: membership.listingsUsed,
        max: -1,
        packageName: pkg.name,
      };
    }

    const canCreate = membership.listingsUsed < maxListings;

    return {
      canCreate,
      reason: canCreate ? "" : "Đã đạt giới hạn số bài đăng",
      current: membership.listingsUsed,
      max: maxListings,
      packageName: pkg.name,
    };
  },

  incrementListingUsed: async (userId: string) => {
    // ✅ FIX: Dùng UserMembership
    const membership = await UserMembership.findOne({
      userId,
      isActive: true,
    });

    if (membership) {
      membership.listingsUsed += 1;
      await membership.save();
    }
  },

  decrementListingUsed: async (userId: string) => {
    // ✅ FIX: Dùng UserMembership
    const membership = await UserMembership.findOne({
      userId,
      isActive: true,
    });

    if (membership && membership.listingsUsed > 0) {
      membership.listingsUsed -= 1;
      await membership.save();
    }
  },

  getMembershipHistory: async (userId: string) => {
    if (!userId) {
      throw new Error("userId là bắt buộc");
    }

    // ✅ FIX: Dùng UserMembership
    return await UserMembership.find({ userId })
      .populate("packageId")
      .populate("paymentId")
      .sort({ createdAt: -1 });
  },

  checkExpiredMemberships: async () => {
    const now = new Date();

    // ✅ FIX: Dùng UserMembership
    const expiredMemberships = await UserMembership.find({
      status: "ACTIVE",
      isActive: true,
      endDate: { $lt: now, $ne: null },
    });

    console.log(`🔍 Tìm thấy ${expiredMemberships.length} gói hết hạn`);

    for (const membership of expiredMemberships) {
      console.log(
        `⏰ Expire membership ${membership._id} của user ${membership.userId}`
      );

      membership.status = "EXPIRED";
      membership.isActive = false;
      await membership.save();

      await User.findByIdAndUpdate(membership.userId, {
        currentMembership: null,
        membershipBadge: "",
      });
    }

    console.log(`✅ Đã expire ${expiredMemberships.length} membership`);

    return expiredMemberships.length;
  },
};
