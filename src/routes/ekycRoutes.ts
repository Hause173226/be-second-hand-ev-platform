import express from "express";
import multer from "multer";
import { verifyWithFpt, ocrId, faceMatch } from "../controllers/ekycController";
import { authenticate } from "../middlewares/authenticate";

// Dùng memory storage để có Buffer cho Cloudinary và FPT API
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

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
  memoryUpload.fields([
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
 *                 description: Ảnh mặt trước CCCD/CMND (bắt buộc)
 *               image_back:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt sau CCCD/CMND (tùy chọn)
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
  memoryUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "image_back", maxCount: 1 },
  ]),
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
  memoryUpload.fields([
    { name: "file1", maxCount: 1 },
    { name: "file2", maxCount: 1 },
  ]),
  faceMatch
);
