// src/routes/chatRoutes.ts
import express from "express";
import {
    getOrCreateChat,
    getUserChats,
    getChatMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount,
} from "../controllers/chatController";
import { authenticate } from "../middlewares/authenticate";

// Router cho các API endpoints liên quan đến chat và messaging
const router = express.Router();

/**
 * @swagger
 * /api/chat/listing/{listingId}:
 *   get:
 *     summary: Lấy hoặc tạo chat cho một listing
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID listing
 *     responses:
 *       200:
 *         description: Lấy hoặc tạo chat thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       404:
 *         description: Không tìm thấy listing
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
router.get("/listing/:listingId", authenticate, getOrCreateChat);

/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Lấy danh sách chat của người dùng
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of chats per page
 *     responses:
 *       200:
 *         description: Lấy danh sách chat thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatListResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authenticate, getUserChats);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   get:
 *     summary: Lấy tin nhắn của một chat cụ thể
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chat
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
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Lấy tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageListResponse'
 *       403:
 *         description: Access denied - User doesn't have access to this chat
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
router.get("/:chatId/messages", authenticate, getChatMessages);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   post:
 *     summary: Gửi tin nhắn
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: Gửi tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - User doesn't have access to this chat
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
router.post("/:chatId/messages", authenticate, sendMessage);

/**
 * @swagger
 * /api/chat/{chatId}/read:
 *   put:
 *     summary: Đánh dấu tin nhắn đã đọc
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chat
 *     responses:
 *       200:
 *         description: Đánh dấu tin nhắn đã đọc thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: Access denied - User doesn't have access to this chat
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
router.put("/:chatId/read", authenticate, markMessagesAsRead);

/**
 * @swagger
 * /api/chat/unread/count:
 *   get:
 *     summary: Lấy số lượng tin nhắn chưa đọc
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy số lượng tin nhắn chưa đọc thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnreadCountResponse'
 *       500:
 *         description: Lỗi máy chủ nội bộ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/unread/count", authenticate, getUnreadCount);

export default router;
