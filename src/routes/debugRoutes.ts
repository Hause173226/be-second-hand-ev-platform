// src/routes/debugRoutes.ts
import express from "express";
import { User } from "../models/User";
import { authenticateJWT } from "../middlewares/authenticate";

const debugRoutes = express.Router();

// Middleware kiểm tra admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới được truy cập" });
  }
  next();
};

/**
 * @swagger
 * /api/debug/otp/phone/{phone}:
 *   get:
 *     summary: Lấy OTP theo số điện thoại (Admin only)
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Số điện thoại cần lấy OTP
 *     responses:
 *       200:
 *         description: Thông tin OTP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 phone:
 *                   type: string
 *                 otp:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *                 isExpired:
 *                   type: boolean
 *                 timeLeft:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *       404:
 *         description: Không tìm thấy OTP
 *       403:
 *         description: Không có quyền truy cập
 */

/**
 * @swagger
 * /api/debug/otp/email/{email}:
 *   get:
 *     summary: Lấy OTP theo email (Admin only)
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email cần lấy OTP
 *     responses:
 *       200:
 *         description: Thông tin OTP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                 otp:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *                 isExpired:
 *                   type: boolean
 *                 timeLeft:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     phone:
 *                       type: string
 *       404:
 *         description: Không tìm thấy OTP
 *       403:
 *         description: Không có quyền truy cập
 */

/**
 * @swagger
 * /api/debug/otp/all:
 *   get:
 *     summary: Lấy tất cả OTP đang active (Admin only)
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách OTP active
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeOTPs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       phone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       otp:
 *                         type: string
 *                       expires:
 *                         type: string
 *                         format: date-time
 *                       isExpired:
 *                         type: boolean
 *                       timeLeft:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           fullName:
 *                             type: string
 *       403:
 *         description: Không có quyền truy cập
 */

// Helper function để tính thời gian còn lại
const getTimeLeft = (expires: Date): string => {
  const now = new Date();
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Đã hết hạn";

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes} phút ${seconds} giây`;
  } else {
    return `${seconds} giây`;
  }
};

// Lấy OTP theo số điện thoại
debugRoutes.get(
  "/otp/phone/:phone",
  authenticateJWT,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const { phone } = req.params;

      const user = await User.findOne({ phone });
      if (!user || !user.otpCode || !user.otpExpires) {
        res
          .status(404)
          .json({ error: "Không tìm thấy OTP cho số điện thoại này" });
        return;
      }

      const isExpired = new Date() > user.otpExpires;
      const timeLeft = getTimeLeft(user.otpExpires);

      res.json({
        phone: user.phone,
        otp: user.otpCode,
        expires: user.otpExpires,
        isExpired,
        timeLeft,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Lấy OTP theo email
debugRoutes.get(
  "/otp/email/:email",
  authenticateJWT,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const { email } = req.params;

      const user = await User.findOne({ email });
      if (!user || !user.otpCode || !user.otpExpires) {
        res.status(404).json({ error: "Không tìm thấy OTP cho email này" });
        return;
      }

      const isExpired = new Date() > user.otpExpires;
      const timeLeft = getTimeLeft(user.otpExpires);

      res.json({
        email: user.email,
        otp: user.otpCode,
        expires: user.otpExpires,
        isExpired,
        timeLeft,
        user: {
          _id: user._id,
          fullName: user.fullName,
          phone: user.phone,
        },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Lấy tất cả OTP đang active
debugRoutes.get(
  "/otp/all",
  authenticateJWT,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const users = await User.find({
        otpCode: { $exists: true, $ne: null },
        otpExpires: { $exists: true, $ne: null },
      }).select("phone email otpCode otpExpires fullName");

      const activeOTPs = users.map((user) => {
        const isExpired = new Date() > user.otpExpires!;
        const timeLeft = getTimeLeft(user.otpExpires!);

        return {
          phone: user.phone,
          email: user.email,
          otp: user.otpCode,
          expires: user.otpExpires,
          isExpired,
          timeLeft,
          user: {
            _id: user._id,
            fullName: user.fullName,
          },
        };
      });

      res.json({
        activeOTPs,
        total: activeOTPs.length,
        expired: activeOTPs.filter((otp) => otp.isExpired).length,
        active: activeOTPs.filter((otp) => !otp.isExpired).length,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default debugRoutes;
