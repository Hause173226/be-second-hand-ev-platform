// src/routes/offerRoutes.ts
import express from "express";
import {
    createOffer,
    getUserOffers,
    respondToOffer,
    respondToCounterOffer,
    getOfferById,
    cancelOffer,
} from "../controllers/offerController";
import { authenticate } from "../middlewares/authenticate";

// Router cho các API endpoints liên quan đến offers và đàm phán giá
const router = express.Router();

/**
 * @swagger
 * /api/offers:
 *   post:
 *     summary: Tạo đề nghị giá mới
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOfferRequest'
 *     responses:
 *       201:
 *         description: Tạo đề nghị giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Yêu cầu không hợp lệ - Thiếu các trường bắt buộc hoặc dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập - Người dùng không có quyền truy cập chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, createOffer);

/**
 * @swagger
 * /api/offers:
 *   get:
 *     summary: Lấy danh sách đề nghị giá của người dùng
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, countered, expired]
 *         description: Lọc theo trạng thái đề nghị giá
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, sent, received]
 *           default: all
 *         description: Filter by offer type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang cho phân trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of offers per page
 *     responses:
 *       200:
 *         description: Lấy danh sách đề nghị giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfferListResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authenticate, getUserOffers);

/**
 * @swagger
 * /api/offers/{offerId}:
 *   get:
 *     summary: Lấy đề nghị giá theo ID
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đề nghị giá
 *     responses:
 *       200:
 *         description: Lấy đề nghị giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       403:
 *         description: Access denied - User doesn't have access to this offer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy đề nghị giá
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:offerId", authenticate, getOfferById);

/**
 * @swagger
 * /api/offers/{offerId}/respond:
 *   put:
 *     summary: Phản hồi đề nghị giá (chấp nhận, từ chối, trả giá)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đề nghị giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RespondToOfferRequest'
 *     responses:
 *       200:
 *         description: Offer response processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Bad request - Invalid action or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - Only seller can respond to offers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy đề nghị giá
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:offerId/respond", authenticate, respondToOffer);

/**
 * @swagger
 * /api/offers/{offerId}/counter-respond:
 *   put:
 *     summary: Phản hồi trả giá (chấp nhận hoặc từ chối)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đề nghị giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RespondToCounterOfferRequest'
 *     responses:
 *       200:
 *         description: Counter offer response processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Bad request - Invalid action or no counter offer to respond to
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - Only buyer can respond to counter offers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy đề nghị giá
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:offerId/counter-respond", authenticate, respondToCounterOffer);

/**
 * @swagger
 * /api/offers/{offerId}:
 *   delete:
 *     summary: Hủy đề nghị giá
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đề nghị giá
 *     responses:
 *       200:
 *         description: Hủy đề nghị giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - Can only cancel pending or countered offers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - Only buyer can cancel offers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy đề nghị giá
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:offerId", authenticate, cancelOffer);

export default router;
