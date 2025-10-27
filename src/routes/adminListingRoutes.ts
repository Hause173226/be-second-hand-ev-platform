// src/routes/adminListingRoutes.ts
import express from "express";
import { body, query } from "express-validator";
import { authenticate } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/role";
import { validate } from "../middlewares/validate";
import {
  pendingQueue,
  approveListing,
  rejectListing,
  adminList, // ⬅️ controller mới (đã thêm trong adminListingController.ts)
} from "../controllers/adminListingController";

const adminListingRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Listings
 *     description: API duyệt/từ chối/tra cứu listing dành cho Admin
 */

/**
 * @swagger
 * /api/admin/listings:
 *   get:
 *     summary: Danh sách listing cho Admin (lọc theo trạng thái, tìm kiếm, phân trang)
 *     tags: [Admin Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PendingReview, Published, Rejected]
 *         required: false
 *         description: Trạng thái lọc (mặc định PendingReview)
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         required: false
 *         description: Từ khóa tìm kiếm theo make/model/ghi chú/thành phố/quận
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         required: false
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         required: false
 *         description: Số bản ghi mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách listing + thông tin phân trang
 *       400:
 *         description: Tham số không hợp lệ
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 */
adminListingRoutes.get(
  "/listings",
  authenticate,
  requireAdmin,
  // validate query
  query("status").optional().isIn(["PendingReview", "Published", "Rejected"]),
  query("keyword").optional().isString().trim().isLength({ max: 200 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  validate,
  adminList
);

/**
 * @swagger
 * /api/admin/listings/pending:
 *   get:
 *     summary: Danh sách listing chờ duyệt (Admin) - legacy
 *     tags: [Admin Listings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách PendingReview
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 */
adminListingRoutes.get(
  "/listings/pending",
  authenticate,
  requireAdmin,
  pendingQueue
);

/**
 * @swagger
 * /api/admin/listings/{id}/approve:
 *   post:
 *     summary: Duyệt listing (PendingReview → Published)
 *     tags: [Admin Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Duyệt thành công → Published
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 *       404:
 *         description: Not found
 *       409:
 *         description: Trạng thái hiện tại không hợp lệ
 */
adminListingRoutes.post(
  "/listings/:id/approve",
  authenticate,
  requireAdmin,
  approveListing
);

/**
 * @swagger
 * /api/admin/listings/{id}/reject:
 *   post:
 *     summary: Từ chối listing (PendingReview → Rejected)
 *     tags: [Admin Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Ảnh mờ/thiếu giấy tờ"
 *     responses:
 *       200:
 *         description: Reject thành công → Rejected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 *       404:
 *         description: Not found
 *       409:
 *         description: Trạng thái hiện tại không hợp lệ
 */
adminListingRoutes.post(
  "/listings/:id/reject",
  authenticate,
  requireAdmin,
  body("reason").optional().isString().trim().isLength({ max: 500 }),
  validate,
  rejectListing
);

export default adminListingRoutes;
