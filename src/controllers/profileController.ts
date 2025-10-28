import { Request, Response } from "express";
import { profileService } from "../services/profileService";
import { FileUploadService } from "../services/fileUploadService";
import { uploadFromBuffer } from "../services/cloudinaryService";

// ===== PROFILE MANAGEMENT =====

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized - User not found" });
      return;
    }

    const profile = await profileService.getOrCreateProfile(userId);
    res.status(200).json(profile);
  } catch (err) {
    console.error("Error getting profile:", err);
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

    // Xử lý upload avatar nếu có
    let avatarUrl = req.body.avatar; // URL từ form data

    if (req.file) {
      // Upload avatar to Cloudinary instead of local storage
      const uploadResult = await uploadFromBuffer(
        req.file.buffer,
        `avatar-${userId}-${Date.now()}`,
        {
          folder: 'secondhand-ev/profiles/avatars',
          resource_type: 'image'
        }
      );
      avatarUrl = uploadResult.secureUrl;
    }

    // Xử lý addresses nếu là JSON string
    let addresses = req.body.addresses;
    if (typeof addresses === "string") {
      try {
        addresses = JSON.parse(addresses);
      } catch (parseErr) {
        res.status(400).json({ error: "Địa chỉ không đúng định dạng JSON" });
        return;
      }
    }

    // Tạo personal data với avatar và addresses đã parse
    const personalData = {
      ...req.body,
      avatar: avatarUrl,
      addresses: addresses,
    };

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

export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    if (!req.file) {
      res.status(400).json({ error: "Thiếu file avatar" });
      return;
    }

    // Upload file từ local lên server
    // Upload avatar to Cloudinary
    const uploadResult = await uploadFromBuffer(
      req.file.buffer,
      `avatar-${userId}-${Date.now()}`,
      {
        folder: 'secondhand-ev/profiles/avatars',
        resource_type: 'image'
      }
    );
    const avatarUrl = uploadResult.secureUrl;

    // Cập nhật avatar trong profile
    const profile = await profileService.updatePersonalInfo(userId, {
      avatar: avatarUrl,
    });

    res.status(200).json({
      message: "Avatar đã được cập nhật thành công",
      avatarUrl: avatarUrl,
      profile: profile,
    });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
  }
};
