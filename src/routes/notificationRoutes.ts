// src/routes/notificationRoutes.ts
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead
} from "../controllers/notificationController";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: NotificationMessages
 *   description: Notification message management APIs
 */

/**
 * @swagger
 * /api/notification-messages:
 *   get:
 *     summary: Lấy danh sách thông báo
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng thông báo mỗi trang
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Bỏ qua số lượng thông báo
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [message, offer, appointment, listing, system]
 *         description: Lọc theo loại thông báo
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái đã đọc
 *     responses:
 *       200:
 *         description: Danh sách thông báo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [message, offer, appointment, listing, system]
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       isRead:
 *                         type: boolean
 *                       actionUrl:
 *                         type: string
 *                       metadata:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     skip:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, getNotifications);

/**
 * @swagger
 * /api/notification-messages/unread-count:
 *   get:
 *     summary: Lấy số lượng thông báo chưa đọc
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Số lượng thông báo chưa đọc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 */
router.get("/unread-count", authenticate, getUnreadCount);

/**
 * @swagger
 * /api/notification-messages/mark-all-read:
 *   post:
 *     summary: Đánh dấu tất cả thông báo đã đọc
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã đánh dấu tất cả thông báo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 */
router.post("/mark-all-read", authenticate, markAllAsRead);

/**
 * @swagger
 * /api/notification-messages/delete-all-read:
 *   delete:
 *     summary: Xóa tất cả thông báo đã đọc
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã xóa tất cả thông báo đã đọc
 */
router.delete("/delete-all-read", authenticate, deleteAllRead);

/**
 * @swagger
 * /api/notification-messages/{notificationId}/read:
 *   post:
 *     summary: Đánh dấu thông báo đã đọc
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Đã đánh dấu thông báo
 */
router.post("/:notificationId/read", authenticate, markAsRead);

/**
 * @swagger
 * /api/notification-messages/{notificationId}:
 *   delete:
 *     summary: Xóa thông báo
 *     tags: [NotificationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Đã xóa thông báo
 */
router.delete("/:notificationId", authenticate, deleteNotification);

export default router;