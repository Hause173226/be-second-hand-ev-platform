// src/routes/adminListingRoutes.ts
import express from "express";
import { body } from "express-validator";
import { authenticateJWT } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/role";
import { validate } from "../middlewares/validate";
import {
  pendingQueue,
  approveListing,
  rejectListing,
} from "../controllers/adminListingController";

const adminListingRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Listings
 *     description: API duyệt/từ chối listing dành cho Admin
 */

/**
 * @swagger
 * /api/admin/listings/pending:
 *   get:
 *     summary: Danh sách listing chờ duyệt (Admin)
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
  authenticateJWT,
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
  authenticateJWT,
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
  authenticateJWT,
  requireAdmin,
  // validate body.reason nếu có
  body("reason").optional().isString().trim().isLength({ max: 500 }),
  validate,
  rejectListing
);

export default adminListingRoutes;
