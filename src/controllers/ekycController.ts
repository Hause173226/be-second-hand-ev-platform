import { Request, Response } from "express";
import { fptEkycService } from "../services/fptEkycService";
import { User } from "../models/User";

export const verifyWithFpt = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.userId;
    if (!authUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const idFront = files?.["id_front"]?.[0];
    const idBack = files?.["id_back"]?.[0];
    const face = files?.["face"]?.[0];

    if (!idFront) {
      res
        .status(400)
        .json({ error: "Thiếu ảnh mặt trước CMND/CCCD (id_front)" });
      return;
    }

    const result = await fptEkycService.verify({
      idFrontPath: idFront.path,
      idBackPath: idBack?.path,
      facePath: face?.path,
      userId: authUserId,
    });

    const user = await User.findById(authUserId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    (user as any).ekycStatus =
      typeof result.faceMatchScore === "number" && result.faceMatchScore >= 0.6
        ? "verified"
        : "pending";
    (user as any).ekycProvider = "FPT";
    (user as any).ekycRefId = result.refId;
    (user as any).ekycResult = result.raw;
    if ((user as any).ekycStatus === "verified") {
      (user as any).verifiedAt = new Date();
    }
    await user.save();

    res.status(200).json({
      message: "Đã gửi xác minh eKYC",
      status: (user as any).ekycStatus,
      refId: result.refId,
      faceMatchScore: result.faceMatchScore,
      livenessScore: result.livenessScore,
      ocr: result.ocrData,
    });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi eKYC" });
  }
};

export const ocrId = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.userId;
    if (!authUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const file = (req as any).files?.["image"]?.[0] as
      | Express.Multer.File
      | undefined;
    if (!file) {
      res.status(400).json({ error: "Thiếu file 'image'" });
      return;
    }

    const result = await fptEkycService.ocrId(file.path);
    res.status(200).json({ message: "OCR thành công", result });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi OCR" });
  }
};

export const faceMatch = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.userId;
    if (!authUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const file1 = files?.["file1"]?.[0];
    const file2 = files?.["file2"]?.[0];
    if (!file1 || !file2) {
      res.status(400).json({ error: "Thiếu 'file1' hoặc 'file2'" });
      return;
    }

    const result = await fptEkycService.checkFaceMatch(file1.path, file2.path);
    res.status(200).json({ message: "FaceMatch thành công", result });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi FaceMatch" });
  }
};
