import express from "express";
import {
  getProfile,
  updatePersonalInfo,
  getProfileStats,
} from "../controllers/profileController";
import { authenticate } from "../middlewares/authenticate";

const profileRoutes = express.Router();

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Lấy thông tin profile của user hiện tại
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin profile được trả về thành công
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Nguyễn Văn A"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 example: "male"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               addresses:
 *                 type: object
 *                 properties:
 *                   fullAddress:
 *                     type: string
 *                     example: "123 Đường ABC"
 *                   ward:
 *                     type: string
 *                     example: "Phường 1"
 *                   district:
 *                     type: string
 *                     example: "Quận 1"
 *                   city:
 *                     type: string
 *                     example: "TP.HCM"
 *                   province:
 *                     type: string
 *                     example: "Hồ Chí Minh"
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/stats:
 *   get:
 *     summary: Lấy thống kê profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê profile
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

// Profile routes
profileRoutes.get("/", authenticate, getProfile);
profileRoutes.put("/", authenticate, updatePersonalInfo);
profileRoutes.get("/stats", authenticate, getProfileStats);
// DELETE profile đã được chuyển sang admin routes để admin có thể xóa user

export default profileRoutes;
