import { Profile } from "../models/Profile";
import { User } from "../models/User";
import { KYCVerification } from "../models/KYCVerification";
import { PaymentMethod } from "../models/PaymentMethod";
import {
  IProfile,
  IAddress,
  IKYCVerification,
  IPaymentMethod,
} from "../interfaces/IProfile";
import { ocrService } from "./ocrService";

export const profileService = {
  // ===== PROFILE MANAGEMENT =====

  // Tạo hoặc lấy profile của user
  getOrCreateProfile: async (userId: string) => {
    // Không dùng populate để tránh trùng lặp
    let profile = await Profile.findOne({ userId }).lean();

    if (!profile) {
      // Lấy thông tin từ User để tạo profile mới
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      const newProfile = await Profile.create({
        userId,
        kycLevel: "NONE",
        stats: {
          soldCount: 0,
          buyCount: 0,
          cancelRate: 0,
          responseTime: 0,
          completionRate: 0,
        },
      });
      profile = newProfile.toObject();
    }

    // Lấy thông tin User để merge vào response
    const user = await User.findById(userId)
      .select("-password -refreshToken")
      .lean();
    if (!user) {
      throw new Error("User not found");
    }

    // Merge thông tin User vào Profile (giữ nguyên tất cả field của Profile)
    return {
      ...profile,
      // Thêm các thông tin từ User model
      email: user.email,
      phone: user.phone,
      fullName: profile.fullName || user.fullName, // Ưu tiên Profile, fallback User
      avatar: user.avatar || null, // Từ User model (giống getUserById)
      avatarUrl: profile.avatarUrl || null, // Từ Profile model
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      role: user.role,
      status: user.status,
      rating: user.rating || profile.rating || null, // Ưu tiên User, fallback Profile
    };
  },

  // Cập nhật thông tin cá nhân
  updatePersonalInfo: async (userId: string, personalData: any) => {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new Error("Profile not found");
    }

    // Cập nhật thông tin cá nhân
    const allowedFields = ["fullName", "avatarUrl"];
    allowedFields.forEach((field) => {
      if (personalData[field] !== undefined) {
        (profile as any)[field] = personalData[field];
      }
    });

    // Sync địa chỉ với User model nếu có địa chỉ mặc định
    if (
      personalData.address &&
      profile.addresses &&
      profile.addresses.length > 0
    ) {
      const defaultAddress = profile.addresses.find((addr: IAddress) => addr.isDefault);
      if (defaultAddress) {
        // Cập nhật địa chỉ đơn giản trong User model
        await User.findByIdAndUpdate(userId, {
          address: `${defaultAddress.fullAddress}, ${defaultAddress.ward}, ${defaultAddress.district}, ${defaultAddress.city}`,
        });
      }
    }

    await profile.save();
    return profile;
  },

  // Upload KYC documents
  uploadKYCDocuments: async (userId: string, documents: any[]) => {
    // Tạo hoặc cập nhật KYC verification
    let kycVerification = await KYCVerification.findOne({ userId });

    if (!kycVerification) {
      kycVerification = await KYCVerification.create({
        userId,
        status: "PENDING",
        documents: documents,
      });
    } else {
      kycVerification.documents = documents;
      kycVerification.status = "PENDING";
      await kycVerification.save();
    }

    // Cập nhật KYC level trong profile
    const profile = await Profile.findOne({ userId });
    if (profile) {
      profile.kycLevel = "BASIC";
      await profile.save();
    }

    return kycVerification;
  },

  // Upload và quét CCCD
  uploadAndScanCCCD: async (
    userId: string,
    frontImageUrl: string,
    backImageUrl?: string
  ) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    try {
      // Quét CCCD mặt trước
      const frontScanResult = await ocrService.scanCCCDFront(frontImageUrl);

      if (!frontScanResult.success) {
        throw new Error(`Lỗi quét CCCD mặt trước: ${frontScanResult.error}`);
      }

      // Validate định dạng CCCD
      const validation = ocrService.validateCCCDFormat(frontScanResult.data!);
      if (!validation.isValid) {
        throw new Error(`CCCD không hợp lệ: ${validation.errors.join(", ")}`);
      }

      // Tạo documents array
      const documents: any[] = [
        {
          type: "citizen_id_front",
          url: frontImageUrl,
          scannedData: frontScanResult.data,
          scanStatus: "SUCCESS",
        },
      ];

      // Nếu có mặt sau, quét mặt sau
      if (backImageUrl) {
        const backScanResult = await ocrService.scanCCCDBack(backImageUrl);

        if (backScanResult.success) {
          documents.push({
            type: "citizen_id_back",
            url: backImageUrl,
            scannedData: backScanResult.data,
            scanStatus: "SUCCESS",
          });
        } else {
          documents.push({
            type: "citizen_id_back",
            url: backImageUrl,
            scanStatus: "FAILED",
            scanError: backScanResult.error,
          });
        }
      }

      // Tạo hoặc cập nhật KYC verification
      let kycVerification = await KYCVerification.findOne({ userId });

      if (!kycVerification) {
        kycVerification = await KYCVerification.create({
          userId,
          status: "PENDING",
          documents: documents,
        });
      } else {
        kycVerification.documents = documents;
        kycVerification.status = "PENDING";
        await kycVerification.save();
      }

      // Cập nhật profile's KYC level
      const profile = await Profile.findOne({ userId });
      if (profile) {
        profile.kycLevel = "BASIC";
        await profile.save();
      }

      return {
        message: "CCCD đã được quét và upload thành công",
        kycVerification,
        scanResult: frontScanResult.data,
      };
    } catch (error) {
      throw new Error(`Lỗi khi quét CCCD: ${(error as Error).message}`);
    }
  },

  // Quét lại CCCD (retry scanning)
  retryCCCDScanning: async (userId: string, documentId: string) => {
    const kycVerification = await KYCVerification.findOne({ userId });
    if (!kycVerification) {
      throw new Error("KYC verification not found");
    }

    const document = kycVerification.documents.find(
      (doc: any) => doc._id?.toString() === documentId
    );
    if (!document) {
      throw new Error("Document not found");
    }

    try {
      let scanResult;
      if (document.type === "citizen_id_front") {
        scanResult = await ocrService.scanCCCDFront(document.url);
      } else if (document.type === "citizen_id_back") {
        scanResult = await ocrService.scanCCCDBack(document.url);
      } else {
        throw new Error("Document type not supported for scanning");
      }

      if (scanResult.success) {
        (document as any).scannedData = scanResult.data;
        (document as any).scanStatus = "SUCCESS";
        (document as any).scanError = undefined;
      } else {
        (document as any).scanStatus = "FAILED";
        (document as any).scanError = scanResult.error;
      }

      await kycVerification.save();
      return { message: "CCCD scanning retry completed", document };
    } catch (error) {
      throw new Error(`Lỗi khi quét lại CCCD: ${(error as Error).message}`);
    }
  },

  // Cập nhật trạng thái KYC (Admin only)
  updateKYCStatus: async (
    userId: string,
    status: string,
    reviewNotes?: string,
    reviewedBy?: string
  ) => {
    const kycVerification = await KYCVerification.findOne({ userId });
    if (!kycVerification) {
      throw new Error("KYC verification not found");
    }

    kycVerification.status = status as any;
    if (reviewNotes) kycVerification.reviewNotes = reviewNotes;
    if (reviewedBy) kycVerification.reviewedBy = reviewedBy;

    await kycVerification.save();

    // Cập nhật KYC level trong profile
    const profile = await Profile.findOne({ userId });
    if (profile) {
      if (status === "APPROVED") {
        profile.kycLevel = "ADVANCED";
      } else if (status === "REJECTED") {
        profile.kycLevel = "NONE";
      }
      await profile.save();
    }

    return kycVerification;
  },

  // ===== ADDRESS MANAGEMENT =====

  // Thêm địa chỉ mới
  addAddress: async (userId: string, addressData: IAddress) => {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new Error("Profile not found");
    }

    // Nếu đây là địa chỉ mặc định, bỏ default của các địa chỉ khác
    if (addressData.isDefault) {
      profile.addresses?.forEach((addr: IAddress) => {
        addr.isDefault = false;
      });
    }

    const address = {
      ...addressData,
      isActive: true,
    };

    if (!profile.addresses) {
      profile.addresses = [];
    }
    profile.addresses.push(address);

    // Sync địa chỉ mặc định với User model
    if (address.isDefault) {
      await User.findByIdAndUpdate(userId, {
        address: `${address.fullAddress}, ${address.ward}, ${address.district}, ${address.city}`,
      });
    }

    await profile.save();
    return profile;
  },

  // Cập nhật địa chỉ
  updateAddress: async (
    userId: string,
    addressId: string,
    addressData: Partial<IAddress>
  ) => {
    const profile = await Profile.findOne({ userId });
    if (!profile || !profile.addresses) {
      throw new Error("Profile or addresses not found");
    }

    const address = profile.addresses.find(
      (addr: IAddress) => addr._id?.toString() === addressId
    );
    if (!address) {
      throw new Error("Address not found");
    }

    // Nếu đặt làm mặc định, bỏ default của các địa chỉ khác
    if (addressData.isDefault) {
      profile.addresses.forEach((addr: IAddress) => {
        if (addr._id?.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    Object.assign(address, addressData);
    await profile.save();
    return profile;
  },

  // Xóa địa chỉ
  deleteAddress: async (userId: string, addressId: string) => {
    const profile = await Profile.findOne({ userId });
    if (!profile || !profile.addresses) {
      throw new Error("Profile or addresses not found");
    }

    profile.addresses = profile.addresses.filter(
      (addr: IAddress) => addr._id?.toString() !== addressId
    );
    await profile.save();
    return profile;
  },

  // ===== PAYMENT METHOD MANAGEMENT =====

  // Thêm phương thức thanh toán
  addPaymentMethod: async (userId: string, paymentData: IPaymentMethod) => {
    // Nếu đây là phương thức mặc định, bỏ default của các phương thức khác
    if (paymentData.isDefault) {
      await PaymentMethod.updateMany({ userId }, { isDefault: false });
    }

    const paymentMethod = await PaymentMethod.create({
      ...paymentData,
      userId,
    });

    return paymentMethod;
  },

  // Cập nhật phương thức thanh toán
  updatePaymentMethod: async (
    userId: string,
    paymentId: string,
    paymentData: Partial<IPaymentMethod>
  ) => {
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentId,
      userId,
    });
    if (!paymentMethod) {
      throw new Error("Payment method not found");
    }

    // Nếu đặt làm mặc định, bỏ default của các phương thức khác
    if (paymentData.isDefault) {
      await PaymentMethod.updateMany(
        { userId, _id: { $ne: paymentId } },
        { isDefault: false }
      );
    }

    Object.assign(paymentMethod, paymentData);
    await paymentMethod.save();
    return paymentMethod;
  },

  // Xóa phương thức thanh toán
  deletePaymentMethod: async (userId: string, paymentId: string) => {
    const paymentMethod = await PaymentMethod.findOneAndDelete({
      _id: paymentId,
      userId,
    });
    if (!paymentMethod) {
      throw new Error("Payment method not found");
    }
    return paymentMethod;
  },

  // ===== UTILITY METHODS =====

  // Lấy thống kê profile
  getProfileStats: async (userId: string) => {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new Error("Profile not found");
    }

    const kycVerification = await KYCVerification.findOne({ userId });
    const paymentMethods = await PaymentMethod.find({ userId });

    return {
      profile,
      kycStatus: kycVerification?.status || "NONE",
      kycLevel: profile.kycLevel,
      paymentMethodCount: paymentMethods.length,
      defaultPaymentMethod: paymentMethods.find((pm) => pm.isDefault),
      stats: profile.stats,
    };
  },

  // Kiểm tra quyền đăng tin/thanh toán dựa trên KYC status
  checkPostingPermission: async (userId: string) => {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new Error("Profile not found");
    }

    const kycVerification = await KYCVerification.findOne({ userId });
    const paymentMethods = await PaymentMethod.find({
      userId,
      isDefault: true,
    });

    const canPost =
      profile.kycLevel === "ADVANCED" || profile.kycLevel === "BASIC";
    const canPay = paymentMethods.length > 0;

    return {
      canPost,
      canPay,
      kycLevel: profile.kycLevel,
      kycStatus: kycVerification?.status || "NONE",
      reason: !canPost
        ? "KYC chưa được xác minh"
        : !canPay
        ? "Chưa có phương thức thanh toán mặc định"
        : null,
    };
  },

  // Lấy danh sách địa chỉ
  getAddresses: async (userId: string) => {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new Error("Profile not found");
    }

    return profile.addresses || [];
  },

  // Lấy danh sách phương thức thanh toán
  getPaymentMethods: async (userId: string) => {
    const paymentMethods = await PaymentMethod.find({ userId });
    return paymentMethods;
  },

  // Lấy thông tin KYC
  getKYCInfo: async (userId: string) => {
    const kycVerification = await KYCVerification.findOne({ userId });
    const profile = await Profile.findOne({ userId });

    return {
      kycLevel: profile?.kycLevel || "NONE",
      kycStatus: kycVerification?.status || "NONE",
      documents: kycVerification?.documents || [],
      reviewNotes: kycVerification?.reviewNotes,
      reviewedBy: kycVerification?.reviewedBy,
      createdAt: kycVerification?.createdAt,
      updatedAt: kycVerification?.updatedAt,
    };
  },
};
