import { Request, Response } from "express";
import { fptEkycService } from "../services/fptEkycService";
import { User } from "../models/User";
import { uploadFromBuffer } from "../services/cloudinaryService";

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

    if (!idFront || !idFront.buffer) {
      res
        .status(400)
        .json({ error: "Thiếu ảnh mặt trước CMND/CCCD (id_front)" });
      return;
    }

    // Upload lên Cloudinary để lưu trữ
    const cloudinaryUploads: Array<{ url: string; publicId: string }> = [];
    
    const idFrontUpload = await uploadFromBuffer(
      idFront.buffer,
      `ekyc-id-front-${authUserId}-${Date.now()}`,
      { folder: "secondhand-ev/ekyc" }
    );
    cloudinaryUploads.push({ url: idFrontUpload.secureUrl, publicId: idFrontUpload.publicId });

    let idBackUpload: { url: string; publicId: string } | undefined;
    if (idBack?.buffer) {
      const uploadResult = await uploadFromBuffer(
        idBack.buffer,
        `ekyc-id-back-${authUserId}-${Date.now()}`,
        { folder: "secondhand-ev/ekyc" }
      );
      idBackUpload = {
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId
      };
      cloudinaryUploads.push(idBackUpload);
    }

    let faceUpload: { url: string; publicId: string } | undefined;
    if (face?.buffer) {
      const uploadResult = await uploadFromBuffer(
        face.buffer,
        `ekyc-face-${authUserId}-${Date.now()}`,
        { folder: "secondhand-ev/ekyc" }
      );
      faceUpload = {
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId
      };
      cloudinaryUploads.push(faceUpload);
    }

    // 1) OCR mặt trước và (nếu có) mặt sau - dùng buffer
    const ocrFront = await fptEkycService.ocrId(idFront.buffer);
    let ocrBack: any | undefined;
    if (idBack?.buffer) {
      ocrBack = await fptEkycService.ocrId(idBack.buffer);
    }

    // 2) FaceMatch giữa ảnh giấy tờ (dùng luôn id_front) và ảnh selfie nếu có - dùng buffer
    let faceMatchResult: any | undefined;
    if (face?.buffer) {
      faceMatchResult = await fptEkycService.checkFaceMatch(
        idFront.buffer,
        face.buffer
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
      cloudinaryUrls: {
        idFront: idFrontUpload.secureUrl,
        idBack: idBackUpload?.url,
        face: faceUpload?.url,
      },
      cloudinaryPublicIds: cloudinaryUploads.map(u => u.publicId),
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
    if (!imageFront || !imageFront.buffer) {
      res.status(400).json({ error: "Thiếu file 'image' (mặt trước)" });
      return;
    }

    // Upload lên Cloudinary
    await uploadFromBuffer(
      imageFront.buffer,
      `ekyc-ocr-front-${authUserId}-${Date.now()}`,
      { folder: "secondhand-ev/ekyc" }
    );
    
    if (imageBack?.buffer) {
      await uploadFromBuffer(
        imageBack.buffer,
        `ekyc-ocr-back-${authUserId}-${Date.now()}`,
        { folder: "secondhand-ev/ekyc" }
      );
    }

    // Gửi buffer cho FPT API
    const front = await fptEkycService.ocrId(imageFront.buffer);
    let back: any | undefined;
    if (imageBack?.buffer) {
      back = await fptEkycService.ocrId(imageBack.buffer);
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
    if (!file1?.buffer || !file2?.buffer) {
      res.status(400).json({ error: "Thiếu 'file1' hoặc 'file2'" });
      return;
    }

    // Upload lên Cloudinary
    await uploadFromBuffer(
      file1.buffer,
      `ekyc-facematch-1-${authUserId}-${Date.now()}`,
      { folder: "secondhand-ev/ekyc" }
    );
    await uploadFromBuffer(
      file2.buffer,
      `ekyc-facematch-2-${authUserId}-${Date.now()}`,
      { folder: "secondhand-ev/ekyc" }
    );

    // Gửi buffer cho FPT API
    const result = await fptEkycService.checkFaceMatch(file1.buffer, file2.buffer);
    res.status(200).json({ message: "FaceMatch thành công", result });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Lỗi FaceMatch" });
  }
};
