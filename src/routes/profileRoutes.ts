import express from "express";
import {
  getProfile,
  updatePersonalInfo,
  getProfileStats,
  checkPostingPermission,
  uploadKYCDocuments,
  uploadAndScanCCCD,
  retryCCCDScanning,
  getKYCInfo,
  updateKYCStatus,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *                 addresses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 kycLevel:
 *                   type: string
 *                   enum: [NONE, BASIC, ADVANCED]
 *                 rating:
 *                   type: number
 *                 stats:
 *                   type: object
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
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                 kycStatus:
 *                   type: string
 *                 kycLevel:
 *                   type: string
 *                 paymentMethodCount:
 *                   type: number
 *                 defaultPaymentMethod:
 *                   type: object
 *                 stats:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/permissions:
 *   get:
 *     summary: Kiểm tra quyền đăng tin/thanh toán
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin quyền
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canPost:
 *                   type: boolean
 *                 canPay:
 *                   type: boolean
 *                 kycLevel:
 *                   type: string
 *                 kycStatus:
 *                   type: string
 *                 reason:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/kyc:
 *   post:
 *     summary: Upload KYC documents
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [citizen_id_front, citizen_id_back, driver_license, passport, other]
 *                     url:
 *                       type: string
 *                     issuedAt:
 *                       type: string
 *                       format: date
 *                     expiredAt:
 *                       type: string
 *                       format: date
 *     responses:
 *       200:
 *         description: Upload thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/kyc/scan-cccd:
 *   post:
 *     summary: Upload và quét CCCD tự động
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frontImageUrl:
 *                 type: string
 *                 description: URL hình ảnh CCCD mặt trước
 *               backImageUrl:
 *                 type: string
 *                 description: URL hình ảnh CCCD mặt sau (tùy chọn)
 *             required:
 *               - frontImageUrl
 *     responses:
 *       200:
 *         description: CCCD đã được quét thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 kycVerification:
 *                   type: object
 *                 scanResult:
 *                   type: object
 *                   properties:
 *                     idNumber:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                     gender:
 *                       type: string
 *                     nationality:
 *                       type: string
 *                     confidence:
 *                       type: number
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc lỗi quét CCCD
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/kyc/retry-scan/{documentId}:
 *   post:
 *     summary: Quét lại CCCD
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của document cần quét lại
 *     responses:
 *       200:
 *         description: Quét lại thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 document:
 *                   type: object
 *       400:
 *         description: Document không tồn tại hoặc lỗi quét
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/kyc:
 *   get:
 *     summary: Lấy thông tin KYC
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin KYC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kycLevel:
 *                   type: string
 *                 kycStatus:
 *                   type: string
 *                 documents:
 *                   type: array
 *                 reviewNotes:
 *                   type: string
 *                 reviewedBy:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/kyc/{userId}:
 *   put:
 *     summary: Cập nhật trạng thái KYC (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED, EXPIRED]
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/addresses:
 *   get:
 *     summary: Lấy danh sách địa chỉ
 *     tags: [Address]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách địa chỉ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [home, work, other]
 *                   name:
 *                     type: string
 *                   fullAddress:
 *                     type: string
 *                   ward:
 *                     type: string
 *                   district:
 *                     type: string
 *                   city:
 *                     type: string
 *                   province:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *                   isDefault:
 *                     type: boolean
 *                   coordinates:
 *                     type: object
 *                   isActive:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/addresses:
 *   post:
 *     summary: Thêm địa chỉ mới
 *     tags: [Address]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [home, work, other]
 *               name:
 *                 type: string
 *               fullAddress:
 *                 type: string
 *               ward:
 *                 type: string
 *               district:
 *                 type: string
 *               city:
 *                 type: string
 *               province:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *             required:
 *               - type
 *               - name
 *               - fullAddress
 *               - ward
 *               - district
 *               - city
 *               - province
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/addresses/{addressId}:
 *   put:
 *     summary: Cập nhật địa chỉ
 *     tags: [Address]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [home, work, other]
 *               name:
 *                 type: string
 *               fullAddress:
 *                 type: string
 *               ward:
 *                 type: string
 *               district:
 *                 type: string
 *               city:
 *                 type: string
 *               province:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               coordinates:
 *                 type: object
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/addresses/{addressId}:
 *   delete:
 *     summary: Xóa địa chỉ
 *     tags: [Address]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: Địa chỉ không tồn tại
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/payment-methods:
 *   get:
 *     summary: Lấy danh sách phương thức thanh toán
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách phương thức thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   provider:
 *                     type: string
 *                   tokenId:
 *                     type: string
 *                   brand:
 *                     type: string
 *                   last4:
 *                     type: string
 *                   isDefault:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/payment-methods:
 *   post:
 *     summary: Thêm phương thức thanh toán
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [stripe, xpay, momo, zalopay, bank]
 *               tokenId:
 *                 type: string
 *               brand:
 *                 type: string
 *               last4:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *             required:
 *               - provider
 *               - tokenId
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/payment-methods/{paymentId}:
 *   put:
 *     summary: Cập nhật phương thức thanh toán
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *               tokenId:
 *                 type: string
 *               brand:
 *                 type: string
 *               last4:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/payment-methods/{paymentId}:
 *   delete:
 *     summary: Xóa phương thức thanh toán
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: Phương thức thanh toán không tồn tại
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

// Profile routes
profileRoutes.get("/", authenticate, getProfile);
profileRoutes.put("/", authenticate, updatePersonalInfo);
profileRoutes.get("/stats", authenticate, getProfileStats);
profileRoutes.get("/permissions", authenticate, checkPostingPermission);

// KYC routes
profileRoutes.post("/kyc", authenticate, uploadKYCDocuments);
profileRoutes.post("/kyc/scan-cccd", authenticate, uploadAndScanCCCD);
profileRoutes.post(
  "/kyc/retry-scan/:documentId",
  authenticate,
  retryCCCDScanning
);
profileRoutes.get("/kyc", authenticate, getKYCInfo);
profileRoutes.put("/kyc/:userId", authenticate, updateKYCStatus);

// Address routes
profileRoutes.get("/addresses", authenticate, getAddresses);
profileRoutes.post("/addresses", authenticate, addAddress);
profileRoutes.put("/addresses/:addressId", authenticate, updateAddress);
profileRoutes.delete("/addresses/:addressId", authenticate, deleteAddress);

// Payment method routes
profileRoutes.get("/payment-methods", authenticate, getPaymentMethods);
profileRoutes.post("/payment-methods", authenticate, addPaymentMethod);
profileRoutes.put(
  "/payment-methods/:paymentId",
  authenticate,
  updatePaymentMethod
);
profileRoutes.delete(
  "/payment-methods/:paymentId",
  authenticate,
  deletePaymentMethod
);

export default profileRoutes;
