// src/routes/listingRoutes.ts
import express, { RequestHandler } from "express";
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
  priceSuggestionAI,
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
 *               priceListed: { type: number, minimum: 0 }           # (15)
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] }  # (15)
 *               location:
 *                 type: string
 *                 description: JSON string {"city","district","address"}        # (15) bỏ lat/lng
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
  body("priceListed").isFloat({ min: 0 }).withMessage("priceListed ≥ 0"), // (15)
  body("tradeMethod") // (15)
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  // tránh .equals(...) gây lỗi TS; custom check 'true'
  body("sellerConfirm")
    .custom((v) => v === "true")
    .withMessage("sellerConfirm phải là 'true'"),
  body("location")
    .custom((v) => {
      try {
        const o = typeof v === "string" ? JSON.parse(v) : v;
        return !!(o?.city && o?.district && o?.address);
      } catch {
        return false;
      }
    })
    .withMessage("location phải là JSON hợp lệ và có city/district/address"),
];

listingRoutes.post(
  "/",
  authenticateJWT as RequestHandler,
  requireProfile as RequestHandler,
  upload.array("photos", 10),
  ...createValidators,
  validate as RequestHandler,
  createListing as unknown as RequestHandler
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
 *               priceListed: { type: number, minimum: 0 }                # (15)
 *               tradeMethod: { type: string, enum: [meet, ship, consignment] } # (15)
 *               location:
 *                 type: object
 *                 properties:
 *                   city: { type: string }
 *                   district: { type: string }
 *                   address: { type: string }
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (không phải chủ sở hữu) }
 *       404: { description: Not found }
 *       409: { description: Không thể sửa khi trạng thái hiện tại không hợp lệ }
 */
const updateValidators = [
  body("type").optional().isIn(["Car", "Battery"]),
  body("priceListed").optional().isFloat({ min: 0 }), // (15)
  body("tradeMethod") // (15)
    .optional()
    .isIn(["meet", "ship", "consignment"])
    .withMessage("tradeMethod phải là meet/ship/consignment"),
  body("condition").optional().isIn(["New", "LikeNew", "Used", "Worn"]),
  body("year").optional().isInt({ min: 1900 }),
  body("batteryCapacityKWh").optional().isFloat({ min: 0 }),
  body("mileageKm").optional().isFloat({ min: 0 }),
  body("chargeCycles").optional().isInt({ min: 0 }),
  body("location")
    .optional()
    .custom((v) => {
      if (v == null) return true;
      if (typeof v !== "object") return false;
      // Nếu có location thì yêu cầu tối thiểu các field cơ bản
      return !!(v.city && v.district && v.address);
    }),
];

listingRoutes.patch(
  "/:id",
  authenticateJWT as RequestHandler,
  requireProfile as RequestHandler,
  ...updateValidators,
  validate as RequestHandler,
  updateListing as unknown as RequestHandler
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
  authenticateJWT as RequestHandler,
  requireProfile as RequestHandler,
  submitListing as unknown as RequestHandler
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
listingRoutes.get(
  "/mine",
  authenticateJWT as RequestHandler,
  myListings as unknown as RequestHandler
);

/**
 * @swagger
 * /api/listings/price-suggest:
 *   post:
 *     summary: Gợi ý giá (tạm thời dùng heuristic)
 *     description: Body là JSON, KHÔNG phải multipart.
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
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
 *               mileageKm: { type: number }
 *               batteryCapacityKWh: { type: number }
 *               condition: { type: string, enum: [New, LikeNew, Used, Worn] }
 *     responses:
 *       200:
 *         description: Giá gợi ý thành công (heuristic)
 *       401: { description: Unauthorized }
 *       500: { description: Lỗi server }
 */
listingRoutes.post(
  "/price-suggest",
  authenticateJWT as RequestHandler,
  validate as RequestHandler, // để đồng nhất pipeline
  priceSuggestionAI as unknown as RequestHandler
);

export default listingRoutes;
