import { Request, Response } from "express";
import { profileService } from "../services/profileService";

// ===== PROFILE MANAGEMENT =====

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const profile = await profileService.getOrCreateProfile(userId);
    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const updatePersonalInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const personalData = req.body;

    const profile = await profileService.updatePersonalInfo(
      userId,
      personalData
    );
    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const getProfileStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const stats = await profileService.getProfileStats(userId);
    res.status(200).json(stats);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const checkPostingPermission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const permission = await profileService.checkPostingPermission(userId);
    res.status(200).json(permission);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

// ===== KYC MANAGEMENT =====

export const uploadKYCDocuments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      res.status(400).json({ error: "Documents array is required" });
      return;
    }

    const kycVerification = await profileService.uploadKYCDocuments(
      userId,
      documents
    );
    res.status(200).json(kycVerification);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const uploadAndScanCCCD = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { frontImageUrl, backImageUrl } = req.body;

    if (!frontImageUrl) {
      res.status(400).json({ error: "frontImageUrl is required" });
      return;
    }

    const result = await profileService.uploadAndScanCCCD(
      userId,
      frontImageUrl,
      backImageUrl
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const retryCCCDScanning = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { documentId } = req.params;

    const result = await profileService.retryCCCDScanning(userId, documentId);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const getKYCInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const kycInfo = await profileService.getKYCInfo(userId);
    res.status(200).json(kycInfo);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const updateKYCStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewedBy = (req as any).user.userId; // Admin user

    if (
      !status ||
      !["PENDING", "APPROVED", "REJECTED", "EXPIRED"].includes(status)
    ) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const kycVerification = await profileService.updateKYCStatus(
      userId,
      status,
      reviewNotes,
      reviewedBy
    );
    res.status(200).json(kycVerification);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

// ===== ADDRESS MANAGEMENT =====

export const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addresses = await profileService.getAddresses(userId);
    res.status(200).json(addresses);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const addAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addressData = req.body;

    const profile = await profileService.addAddress(userId, addressData);
    res.status(201).json(profile);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { addressId } = req.params;
    const addressData = req.body;

    const profile = await profileService.updateAddress(
      userId,
      addressId,
      addressData
    );
    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { addressId } = req.params;

    const profile = await profileService.deleteAddress(userId, addressId);
    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

// ===== PAYMENT METHOD MANAGEMENT =====

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const paymentMethods = await profileService.getPaymentMethods(userId);
    res.status(200).json(paymentMethods);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const paymentData = req.body;

    const paymentMethod = await profileService.addPaymentMethod(
      userId,
      paymentData
    );
    res.status(201).json(paymentMethod);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const updatePaymentMethod = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { paymentId } = req.params;
    const paymentData = req.body;

    const paymentMethod = await profileService.updatePaymentMethod(
      userId,
      paymentId,
      paymentData
    );
    res.status(200).json(paymentMethod);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { paymentId } = req.params;

    const paymentMethod = await profileService.deletePaymentMethod(
      userId,
      paymentId
    );
    res.status(200).json(paymentMethod);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};
