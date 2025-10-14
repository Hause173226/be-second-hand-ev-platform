import express from "express";
import { ssoService } from "../services/ssoService";
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
  signUpWithPhone,
  verifyPhoneOTP,
  signInWithPhone,
  verifySignInOTP,
  resendPhoneOTP,
  sendEmailVerification,
  verifyEmail,
} from "../controllers/userController";
import { authenticateJWT } from "../middlewares/authenticate";
import {
  validateSignUp,
  validateSignUpPhone,
  validateOTP,
  validateSignIn,
} from "../middlewares/validation";

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
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Nguyễn Văn A"
 *               phone:
 *                 type: string
 *                 pattern: "^(0[3|5|7|8|9])[0-9]{8}$"
 *                 example: "0987654321"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 50
 *                 example: "password123"
 *               termsAgreed:
 *                 type: boolean
 *                 example: true
 *             required:
 *               - fullName
 *               - phone
 *               - email
 *               - password
 *               - termsAgreed
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

/**
 * @swagger
 * /api/users/signup-phone:
 *   post:
 *     summary: Đăng ký tài khoản bằng số điện thoại
 *     tags: [Phone Auth]
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
 *             required:
 *               - fullName
 *               - phone
 *     responses:
 *       201:
 *         description: Đăng ký thành công, OTP đã được gửi
 *       400:
 *         description: Số điện thoại đã tồn tại hoặc thiếu thông tin
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/verify-phone-otp:
 *   post:
 *     summary: Xác thực OTP cho đăng ký bằng số điện thoại
 *     tags: [Phone Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *             required:
 *               - phone
 *               - otp
 *     responses:
 *       200:
 *         description: Xác thực thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/signin-phone:
 *   post:
 *     summary: Đăng nhập bằng số điện thoại (gửi OTP)
 *     tags: [Phone Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *             required:
 *               - phone
 *     responses:
 *       200:
 *         description: OTP đã được gửi về số điện thoại
 *       400:
 *         description: Số điện thoại không tồn tại hoặc chưa được kích hoạt
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/verify-signin-otp:
 *   post:
 *     summary: Xác thực OTP cho đăng nhập bằng số điện thoại
 *     tags: [Phone Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *             required:
 *               - phone
 *               - otp
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/resend-phone-otp:
 *   post:
 *     summary: Gửi lại OTP cho số điện thoại
 *     tags: [Phone Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *             required:
 *               - phone
 *     responses:
 *       200:
 *         description: OTP mới đã được gửi
 *       400:
 *         description: Số điện thoại không tồn tại
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/send-email-verification:
 *   post:
 *     summary: Gửi email xác thực tài khoản
 *     tags: [Email Verification]
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
 *         description: Email xác thực đã được gửi
 *       400:
 *         description: Email không tồn tại hoặc đã được kích hoạt
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/users/verify-email:
 *   post:
 *     summary: Xác thực email bằng OTP
 *     tags: [Email Verification]
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
 *             required:
 *               - email
 *               - otp
 *     responses:
 *       200:
 *         description: Email đã được xác thực thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */

// Auth routes
userRoutes.post("/signup", validateSignUp, signUp);
userRoutes.post("/signin", validateSignIn, signIn);
userRoutes.post("/refresh-token", refreshToken);
userRoutes.post("/forgot-password", forgotPassword);
userRoutes.post("/resend-otp", resendOTP);
userRoutes.post("/reset-password", resetPasswordWithOTP);
userRoutes.post("/signout", authenticateJWT, signOut);

// Phone authentication routes
userRoutes.post("/signup-phone", validateSignUpPhone, signUpWithPhone);
userRoutes.post("/verify-phone-otp", validateOTP, verifyPhoneOTP);
userRoutes.post("/signin-phone", signInWithPhone);
userRoutes.post("/verify-signin-otp", validateOTP, verifySignInOTP);
userRoutes.post("/resend-phone-otp", resendPhoneOTP);

// Email verification routes
userRoutes.post("/send-email-verification", sendEmailVerification);
userRoutes.post("/verify-email", validateOTP, verifyEmail);

/**
 * @swagger
 * /api/users/google:
 *   post:
 *     summary: Đăng nhập bằng Google
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profile
 *             properties:
 *               profile:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "google_user_id"
 *                   emails:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: string
 *                           example: "user@gmail.com"
 *                   name:
 *                     type: object
 *                     properties:
 *                       givenName:
 *                         type: string
 *                         example: "John"
 *                       familyName:
 *                         type: string
 *                         example: "Doe"
 *                   photos:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: string
 *                           example: "https://example.com/photo.jpg"
 *     responses:
 *       200:
 *         description: Đăng nhập Google thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Lỗi đăng nhập Google
 */

/**
 * @swagger
 * /api/users/facebook:
 *   post:
 *     summary: Đăng nhập bằng Facebook
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profile
 *             properties:
 *               profile:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "facebook_user_id"
 *                   emails:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: string
 *                           example: "user@facebook.com"
 *                   name:
 *                     type: object
 *                     properties:
 *                       givenName:
 *                         type: string
 *                         example: "John"
 *                       familyName:
 *                         type: string
 *                         example: "Doe"
 *                   photos:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: string
 *                           example: "https://example.com/photo.jpg"
 *     responses:
 *       200:
 *         description: Đăng nhập Facebook thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Lỗi đăng nhập Facebook
 */

// Profile routes
userRoutes.get("/profile", authenticateJWT, getProfile);

// SSO routes
userRoutes.post("/google", async (req, res) => {
  try {
    const { profile } = req.body;
    const result = await ssoService.handleGoogleCallback(profile);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

userRoutes.post("/facebook", async (req, res) => {
  try {
    const { profile } = req.body;
    const result = await ssoService.handleFacebookCallback(profile);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Protected routes
userRoutes.get("/", authenticateJWT, getAllUsers);
userRoutes.get("/:id", authenticateJWT, getUserById);
userRoutes.put("/:id", authenticateJWT, updateUser);
userRoutes.put("/change-password/:id", authenticateJWT, changePassword);

export default userRoutes;
