import express, { RequestHandler } from "express";
import {
  createContract,
  getContractInfo,
  uploadContractPhotos,
  completeTransaction,
  getStaffContracts,
  cancelContractTransaction,
  getContractTimeline,
  updateContractTimelineStep,
  generateContractPdfFile,
  getContractPdfFile,
} from "../controllers/contractController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";
import multer from "multer";

const router = express.Router();

/**
 * @swagger
 * /api/contracts/{appointmentId}:
 *   get:
 *     summary: Lấy thông tin hợp đồng
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin hợp đồng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Contract"
 */
router.get(
  "/:appointmentId",
  authenticate,
  getContractInfo as unknown as RequestHandler
);

router.post(
  "/:appointmentId/create",
  authenticate,
  requireRole(["staff", "admin"]),
  createContract as unknown as RequestHandler
);

/**
 * @swagger
 * /api/contracts/{appointmentId}/upload-photos:
 *   post:
 *     summary: Staff upload ảnh hợp đồng đã ký
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Upload ảnh thành công
 */
// ✅ Dùng memoryStorage để có file.buffer (thay vì CloudinaryStorage)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB/ảnh
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype) ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error("Invalid image type"));
  },
});

router.post(
  "/:appointmentId/upload-photos",
  authenticate,
  memoryUpload.array("photos", 10), // ✅ Tối đa 10 ảnh, lưu vào memory để có buffer
  uploadContractPhotos as unknown as RequestHandler
);

/**
 * @swagger
 * /api/contracts/{appointmentId}/complete:
 *   post:
 *     summary: Staff xác nhận giao dịch hoàn thành
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hoàn thành giao dịch thành công
 */
router.post(
  "/:appointmentId/complete",
  authenticate,
  completeTransaction as unknown as RequestHandler
);

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Lấy danh sách contract cho staff
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách contract
 */
router.get("/", authenticate, getStaffContracts as unknown as RequestHandler);

router.get(
  "/:contractId/timeline",
  authenticate,
  getContractTimeline as unknown as RequestHandler
);

router.patch(
  "/:contractId/timeline/:step",
  authenticate,
  requireRole(["staff", "admin"]),
  memoryUpload.array("attachments", 5),
  updateContractTimelineStep as unknown as RequestHandler
);

router.post(
  "/:contractId/pdf",
  authenticate,
  requireRole(["staff", "admin"]),
  generateContractPdfFile as unknown as RequestHandler
);

router.get(
  "/:contractId/pdf",
  authenticate,
  getContractPdfFile as unknown as RequestHandler
);

/**
 * @swagger
 * /api/contracts/{appointmentId}/cancel:
 *   post:
 *     summary: Staff hủy giao dịch tại cuộc hẹn (trường hợp một bên từ chối)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy giao dịch (bắt buộc)
 *                 example: "Người mua từ chối giao dịch do xe không đúng mô tả"
 *     responses:
 *       200:
 *         description: Hủy giao dịch thành công, tiền đã hoàn về ví người mua
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointmentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [CANCELLED]
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *                     reason:
 *                       type: string
 *                     cancelledBy:
 *                       type: string
 *       400:
 *         description: Lỗi validation (thiếu lý do hoặc giao dịch đã hoàn thành/hủy)
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy lịch hẹn
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/:appointmentId/cancel",
  authenticate,
  requireRole(["staff", "admin"]),
  cancelContractTransaction as unknown as RequestHandler
);

export default router;
