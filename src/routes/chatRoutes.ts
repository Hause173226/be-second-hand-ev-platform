// src/routes/chatRoutes.ts
import express from "express";
import {
    createDirectChat,
    getOrCreateChat,
    getUserChats,
    getChatMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount,
    sendMessageWithFiles,
    sendMessageWithPastedImage,
    searchMessages,
    addMessageReaction,
    editMessage,
    deleteMessage,
    getMessageFiles,
    deleteChat,
    getOnlineUsersInChat,
    getUserOnlineStatus,
} from "../controllers/chatController";
import { authenticate } from "../middlewares/authenticate";
import { upload } from "../services/fileUploadService";

// Router cho các API endpoints liên quan đến chat và messaging
const router = express.Router();

/**
 * @swagger
 * /api/chat/direct:
 *   post:
 *     summary: Tạo chat room trực tiếp giữa 2 user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID của user muốn chat
 *             required:
 *               - targetUserId
 *     responses:
 *       200:
 *         description: Tạo hoặc lấy chat thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Bad request - Missing targetUserId or cannot chat with yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Target user not found
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
router.post("/direct", authenticate, createDirectChat);

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

/**
 * @swagger
 * /api/chat/{chatId}/messages/files:
 *   post:
 *     summary: Gửi tin nhắn với file đính kèm
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung tin nhắn
 *               caption:
 *                 type: string
 *                 description: Chú thích đi kèm hình ảnh (alias của content)
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload
 *     responses:
 *       201:
 *         description: Gửi tin nhắn với file thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request
 *       403:
 *         description: Access denied
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.post("/:chatId/messages/files", authenticate, upload.array('files', 5), sendMessageWithFiles);

/**
 * @swagger
 * /api/chat/{chatId}/messages/image:
 *   post:
 *     summary: Gửi tin nhắn với hình ảnh paste từ clipboard
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
 *             $ref: '#/components/schemas/SendImageRequest'
 *     responses:
 *       201:
 *         description: Gửi tin nhắn với hình ảnh thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request - Missing imageData or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.post("/:chatId/messages/image", authenticate, sendMessageWithPastedImage);

/**
 * @swagger
 * /api/chat/{chatId}/search:
 *   get:
 *     summary: Tìm kiếm tin nhắn trong chat
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
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số tin nhắn mỗi trang
 *     responses:
 *       200:
 *         description: Tìm kiếm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 query:
 *                   type: string
 *       400:
 *         description: Missing search query
 *       403:
 *         description: Access denied
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.get("/:chatId/search", authenticate, searchMessages);

/**
 * @swagger
 * /api/chat/messages/{messageId}/reaction:
 *   post:
 *     summary: Thêm/xóa reaction cho tin nhắn
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tin nhắn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emoji:
 *                 type: string
 *                 description: Emoji reaction
 *             required:
 *               - emoji
 *     responses:
 *       200:
 *         description: Reaction updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       emoji:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Missing emoji
 *       403:
 *         description: Access denied
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal server error
 */
router.post("/messages/:messageId/reaction", authenticate, addMessageReaction);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   put:
 *     summary: Sửa tin nhắn
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tin nhắn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung mới của tin nhắn
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Message edited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Missing content or message already deleted
 *       403:
 *         description: Only sender can edit message
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal server error
 */
router.put("/messages/:messageId", authenticate, editMessage);

/**
 * @swagger
 * /api/chat/{chatId}/online-users:
 *   get:
 *     summary: Lấy danh sách user online trong chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của chat
 *     responses:
 *       200:
 *         description: Lấy danh sách user online thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chatId:
 *                   type: string
 *                 onlineUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       isOnline:
 *                         type: boolean
 *                 onlineCount:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Access denied
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.get("/:chatId/online-users", authenticate, getOnlineUsersInChat);

/**
 * @swagger
 * /api/users/{userId}/online-status:
 *   get:
 *     summary: Kiểm tra trạng thái online của user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user cần kiểm tra
 *     responses:
 *       200:
 *         description: Lấy trạng thái online thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                 isOnline:
 *                   type: boolean
 *                 lastSeen:
 *                   type: string
 *                   format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/users/:userId/online-status", authenticate, getUserOnlineStatus);

/**
 * @swagger
 * /api/chat/{chatId}:
 *   delete:
 *     summary: Xóa toàn bộ cuộc trò chuyện
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của chat cần xóa
 *     responses:
 *       200:
 *         description: Xóa cuộc trò chuyện thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 chatId:
 *                   type: string
 *                 deletedMessages:
 *                   type: number
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Access denied - User doesn't have access to this chat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Chat not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:chatId", authenticate, deleteChat);

/**
 * @swagger
 * /api/chat/messages/{messageId}/files:
 *   get:
 *     summary: Lấy thông tin file từ tin nhắn
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tin nhắn
 *     responses:
 *       200:
 *         description: Lấy thông tin file thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       originalname:
 *                         type: string
 *                       url:
 *                         type: string
 *                       size:
 *                         type: number
 *                       mimetype:
 *                         type: string
 *                       formattedSize:
 *                         type: string
 *                 messageType:
 *                   type: string
 *                 content:
 *                   type: string
 *                 senderId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Access denied
 *       404:
 *         description: Message not found or no files
 *       500:
 *         description: Internal server error
 */
router.get("/messages/:messageId/files", authenticate, getMessageFiles);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   delete:
 *     summary: Xóa tin nhắn
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tin nhắn
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteForEveryone:
 *                 type: boolean
 *                 default: false
 *                 description: Xóa cho tất cả mọi người
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Access denied
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal server error
 */
router.delete("/messages/:messageId", authenticate, deleteMessage);

export default router;
