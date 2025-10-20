import express from "express";
import {
  getAllUsers,
  signIn,
  forgotPassword,
  resendOTP,
  resetPasswordWithOTP,
  signOut,
  signUp,
  getUserById,
  updateUser,
  changePassword,
  refreshToken,
  getProfile,
} from "../controllers/userController";
import { authenticate } from "../middlewares/authenticate";

const userRoutes = express.Router();

/**
 * @swagger
 * /api/users/signup:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - fullName
 *               - phone
 *               - password
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã tồn tại
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/signin:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       400:
 *         description: Email hoặc mật khẩu không đúng
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Quên mật khẩu (gửi OTP về email)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Đã gửi OTP thành công
 *       400:
 *         description: Email không tồn tại
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/resend-otp:
 *   post:
 *     summary: Gửi lại OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Đã gửi lại OTP thành công
 *       400:
 *         description: Email không tồn tại
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: OTP không hợp lệ hoặc hết hạn
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/signout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy danh sách tất cả users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Danh sách users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   fullName:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   email:
 *                     type: string
 *                   citizenId:
 *                     type: string
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                   gender:
 *                     type: string
 *                   address:
 *                     type: string
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lấy thông tin user theo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user cần lấy thông tin
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 citizenId:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 role:
 *                   type: string
 *                 gender:
 *                   type: string
 *                 address:
 *                   type: string
 *       404:
 *         description: User không tìm thấy
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Cập nhật thông tin user theo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               citizenId:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: User đã được cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: User không tìm thấy
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/change-password/{id}:
 *   put:
 *     summary: Đổi mật khẩu
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Mật khẩu hiện tại
 *               newPassword:
 *                 type: string
 *                 description: Mật khẩu mới (ít nhất 6 ký tự)
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc mật khẩu hiện tại sai
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Lấy thông tin profile của user hiện tại
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin profile được trả về thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 citizenId:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 gender:
 *                   type: string
 *                   enum: [male, female, other]
 *                 address:
 *                   type: string
 *                 role:
 *                   type: string
 *                   enum: [user, admin]
 *                 isActive:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

// Auth routes
userRoutes.post("/signup", signUp);
userRoutes.post("/signin", signIn);
userRoutes.post("/refresh-token", refreshToken);
userRoutes.post("/forgot-password", forgotPassword);
userRoutes.post("/resend-otp", resendOTP);
userRoutes.post("/reset-password", resetPasswordWithOTP);
userRoutes.post("/signout", authenticate, signOut);

// Profile routes
userRoutes.get("/profile", authenticate, getProfile);

// Protected routes
userRoutes.get("/", authenticate, getAllUsers);
userRoutes.get("/:id", authenticate, getUserById);
userRoutes.put("/:id", authenticate, updateUser);
userRoutes.put("/change-password/:id", authenticate, changePassword);

export default userRoutes;
