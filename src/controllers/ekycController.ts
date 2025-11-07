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

    // 1) OCR mặt trước và (nếu có) mặt sau
    const ocrFront = await fptEkycService.ocrId(idFront.path);
    let ocrBack: any | undefined;
    if (idBack) {
      ocrBack = await fptEkycService.ocrId(idBack.path);
    }

    // 2) FaceMatch giữa ảnh giấy tờ (dùng luôn id_front) và ảnh selfie nếu có
    let faceMatchResult: any | undefined;
    if (face) {
      faceMatchResult = await fptEkycService.checkFaceMatch(
        idFront.path,
        face.path
      );
    }

    // 3) Quyết định trạng thái dựa trên điểm FaceMatch
    const score = Number(
      faceMatchResult?.score ??
        faceMatchResult?.similarity ??
        faceMatchResult?.data?.score ??
        faceMatchResult?.data?.similarity ??
        NaN
    );
    const PASS_THRESHOLD = 0.6;
    const isVerified =
      typeof score === "number" &&
      !Number.isNaN(score) &&
      score >= PASS_THRESHOLD;

    const user = await User.findById(authUserId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    (user as any).ekycStatus = isVerified ? "verified" : "pending";
    (user as any).ekycProvider = "FPT";
    (user as any).ekycRefId = (ocrFront?.ref_id ||
      ocrFront?.reference_id ||
      undefined) as any;
    (user as any).ekycResult = {
      ocr: { front: ocrFront, back: ocrBack },
      faceMatch: faceMatchResult,
      score,
    };
    if ((user as any).ekycStatus === "verified") {
      (user as any).verifiedAt = new Date();
    }
    await user.save();

    res.status(200).json({
      message: "Xác minh eKYC (tổng hợp) thành công",
      status: (user as any).ekycStatus,
      refId: (user as any).ekycRefId,
      score,
      ocr: { front: ocrFront, back: ocrBack },
      faceMatch: faceMatchResult,
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

    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const imageFront = files?.["image"]?.[0];
    const imageBack = files?.["image_back"]?.[0];
    if (!imageFront) {
      res.status(400).json({ error: "Thiếu file 'image' (mặt trước)" });
      return;
    }

    const front = await fptEkycService.ocrId(imageFront.path);
    let back: any | undefined;
    if (imageBack) {
      back = await fptEkycService.ocrId(imageBack.path);
    }

    res.status(200).json({ message: "OCR thành công", front, back });
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
