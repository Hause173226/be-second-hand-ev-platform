import { User } from "../models/User";

export const profileService = {
  // ===== PROFILE MANAGEMENT =====

  // Lấy profile của user
  getOrCreateProfile: async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found with ID:", userId);
      throw new Error("User not found");
    let profile = await Profile.findOne({ userId }).populate("userId");

    if (!profile) {
      // Lấy thông tin từ User để tạo profile mới
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      profile = await Profile.create({
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
    // Sync địa chỉ với User model nếu có địa chỉ mặc định
    if (
      personalData.address &&
      profile.addresses &&
      profile.addresses.length > 0
    ) {
      const defaultAddress = profile.addresses.find((addr) => addr.isDefault);
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
      profile.addresses?.forEach((addr) => {
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
      (addr) => addr._id?.toString() === addressId
    );
    if (!address) {
      throw new Error("Address not found");
    }

    // Nếu đặt làm mặc định, bỏ default của các địa chỉ khác
    if (addressData.isDefault) {
      profile.addresses.forEach((addr) => {
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
      (addr) => addr._id?.toString() !== addressId
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
