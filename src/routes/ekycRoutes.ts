import express from "express";
import { verifyWithFpt, ocrId, faceMatch } from "../controllers/ekycController";
import { upload } from "../services/fileUploadService";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: eKYC
 *     description: Xác minh danh tính (FPT eKYC)
 */

/**
 * @swagger
 * /api/ekyc/verify:
 *   post:
 *     summary: Gửi ảnh để xác minh eKYC (tổng hợp)
 *     tags: [eKYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               id_front:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt trước CCCD/CMND (bắt buộc)
 *               id_back:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt sau CCCD/CMND (tùy chọn)
 *               face:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh selfie khuôn mặt (tùy chọn)
 *     responses:
 *       200:
 *         description: Kết quả xác minh đã được lưu vào User
 *       400:
 *         description: Thiếu file hoặc lỗi xác minh
 */
// POST /api/ekyc/verify
// multipart/form-data fields: id_front, id_back (optional), face (optional)
router.post(
  "/verify",
  authenticate,
  upload.fields([
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
    { name: "face", maxCount: 1 },
  ]),
  verifyWithFpt
);

export default router;

/**
 * @swagger
 * /api/ekyc/ocr:
 *   post:
 *     summary: OCR giấy tờ tùy thân (CCCD/CMND) qua FPT
 *     tags: [eKYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt trước CCCD/CMND
 *     responses:
 *       200:
 *         description: Trả về JSON OCR từ FPT
 *       400:
 *         description: Thiếu file hoặc lỗi OCR
 */
// OCR CCCD/CMND: field 'image'
router.post(
  "/ocr",
  authenticate,
  upload.fields([{ name: "image", maxCount: 1 }]),
  ocrId
);

/**
 * @swagger
 * /api/ekyc/face-match:
 *   post:
 *     summary: So khớp khuôn mặt giữa ảnh giấy tờ và ảnh selfie
 *     tags: [eKYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file1:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh 1 (ảnh giấy tờ hoặc khuôn mặt trích xuất)
 *               file2:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh 2 (ảnh selfie)
 *     responses:
 *       200:
 *         description: Trả về điểm so khớp từ FPT
 *       400:
 *         description: Thiếu file hoặc lỗi FaceMatch
 */
// FaceMatch: fields 'file1' và 'file2' (nội bộ sẽ gửi lên FPT dưới dạng file[])
router.post(
  "/face-match",
  authenticate,
  upload.fields([
    { name: "file1", maxCount: 1 },
    { name: "file2", maxCount: 1 },
  ]),
  faceMatch
);
