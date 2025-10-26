import { Request, Response } from "express";
import { profileService } from "../services/profileService";

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
