// src/routes/listingRoutes.ts
import express from "express";
import { body } from "express-validator";
import { authenticateJWT } from "../middlewares/authenticate";
import { requireProfile } from "../middlewares/requireProfile";
import { validate } from "../middlewares/validate";
import { upload } from "../utils/upload";
import {
  createListing,
  updateListing,
  submitListing,
  myListings,
} from "../controllers/listingController";

const listingRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Listings
 *     description: API cho người bán tạo/cập nhật/submit tin đăng
 */

/**
 * @swagger
 * /api/listings:
 *   post:
 *     summary: Tạo listing mới (người bán)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               batteryCapacityKWh: { type: number }
 *               mileageKm: { type: number }
 *               chargeCycles: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number }
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address","lat"?,"lng"?}
 *               sellerConfirm:
 *                 type: string
 *                 enum: ["true"]
 *                 description: Cam kết chính chủ
 *               photos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Tạo listing thành công (status=Draft) }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Unauthorized }
 *       403: { description: Account not active }
 *       500: { description: Lỗi server }
 */
const createValidators = [
  body("type").isIn(["Car", "Battery"]).withMessage("type phải là Car/Battery"),
  body("priceListed").isFloat({ gt: 0 }).withMessage("priceListed > 0"),
  body("sellerConfirm").equals("true").withMessage("sellerConfirm phải là 'true'"),
  body("location").custom((v) => {
    try {
      const o = typeof v === "string" ? JSON.parse(v) : v;
      return !!(o?.city && o?.district && o?.address);
    } catch {
      return false;
    }
  }).withMessage("location phải là JSON hợp lệ và có city/district/address"),
];

listingRoutes.post(
  "/",
  authenticateJWT,
  requireProfile,
  upload.array("photos", 10),
  ...createValidators,
  validate,
  createListing
);

/**
 * @swagger
 * /api/listings/{id}:
 *   patch:
 *     summary: Cập nhật listing (chỉ khi Draft/Rejected)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [Car, Battery] }
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               batteryCapacityKWh: { type: number }
 *               mileageKm: { type: number }
 *               chargeCycles: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *               priceListed: { type: number }
 *               location:
 *                 type: object
 *                 properties:
 *                   city: { type: string }
 *                   district: { type: string }
 *                   address: { type: string }
 *                   lat: { type: number }
 *                   lng: { type: number }
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (không phải chủ sở hữu) }
 *       404: { description: Not found }
 *       409: { description: Không thể sửa khi trạng thái hiện tại không hợp lệ }
 */
const updateValidators = [
  body("type").optional().isIn(["Car", "Battery"]),
  body("priceListed").optional().isFloat({ gt: 0 }),
  body("condition").optional().isIn(["New", "LikeNew", "Used", "Worn"]),
  body("year").optional().isInt({ min: 1900 }),
  body("batteryCapacityKWh").optional().isFloat({ min: 0 }),
  body("mileageKm").optional().isFloat({ min: 0 }),
  body("chargeCycles").optional().isInt({ min: 0 }),
  body("location").optional().custom((v) => {
    if (v == null) return true;
    if (typeof v !== "object") return false;
    // nếu có location thì cần tối thiểu các field cơ bản
    return !!(v.city && v.district && v.address);
  }),
];

listingRoutes.patch(
  "/:id",
  authenticateJWT,
  requireProfile,
  ...updateValidators,
  validate,
  updateListing
);

/**
 * @swagger
 * /api/listings/{id}/submit:
 *   post:
 *     summary: Submit listing để duyệt (Draft/Rejected → PendingReview)
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Submit thành công → PendingReview }
 *       400: { description: Auto moderation failed / thiếu dữ liệu bắt buộc }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       409: { description: Trạng thái hiện tại không hợp lệ }
 */
listingRoutes.post(
  "/:id/submit",
  authenticateJWT,
  requireProfile,
  submitListing
);

/**
 * @swagger
 * /api/listings/mine:
 *   get:
 *     summary: Lấy danh sách listing của tôi
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Danh sách listing của user hiện tại }
 *       401: { description: Unauthorized }
 */
listingRoutes.get("/mine", authenticateJWT, myListings);

export default listingRoutes;
