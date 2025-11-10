// src/routes/notificationDepositRoutes.ts
import express, { RequestHandler } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
    getAllNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    deleteNotification,
} from '../controllers/notificationDepositController';

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lấy tất cả notification của user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái đã đọc/chưa đọc
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, deposit_confirmation, contract, transaction_complete]
 *         description: Lọc theo loại notification
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng notification mỗi trang
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *     responses:
 *       200:
 *         description: Danh sách notification
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, getAllNotifications as unknown as RequestHandler);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Lấy số notification chưa đọc
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Số notification chưa đọc
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count', authenticate, getUnreadCount as unknown as RequestHandler);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả notification là đã đọc
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đánh dấu thành công
 *       401:
 *         description: Unauthorized
 */
router.patch('/read-all', authenticate, markAllAsRead as unknown as RequestHandler);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     summary: Đánh dấu notification là đã đọc
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của notification
 *     responses:
 *       200:
 *         description: Đánh dấu thành công
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.patch('/:notificationId/read', authenticate, markAsRead as unknown as RequestHandler);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Xóa notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của notification
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.delete('/:notificationId', authenticate, deleteNotification as unknown as RequestHandler);

export default router;

