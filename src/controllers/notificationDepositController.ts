// src/controllers/notificationDepositController.ts
import { Request, Response } from 'express';
import depositNotificationService from '../services/depositNotificationService';

/**
 * Lấy tất cả notification của user
 * GET /api/notifications
 */
export const getAllNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        const { isRead, type, limit, page } = req.query;

        const result = await depositNotificationService.getUserNotifications(
            userId,
            {
                isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
                type: type as string,
                limit: limit ? parseInt(limit as string) : undefined,
                page: page ? parseInt(page as string) : undefined,
            }
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error('Error getting notifications:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error getting notifications',
        });
    }
};

/**
 * Đánh dấu notification là đã đọc
 * PATCH /api/notifications/:notificationId/read
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { notificationId } = req.params;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        const notification = await depositNotificationService.markAsRead(
            notificationId,
            userId
        );

        return res.status(200).json({
            success: true,
            data: notification,
        });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error marking notification as read',
        });
    }
};

/**
 * Đánh dấu tất cả notification là đã đọc
 * PATCH /api/notifications/read-all
 */
export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        const result = await depositNotificationService.markAllAsRead(userId);

        return res.status(200).json({
            success: true,
            data: { modifiedCount: result.modifiedCount },
        });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error marking all notifications as read',
        });
    }
};

/**
 * Lấy số notification chưa đọc
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        const count = await depositNotificationService.getUnreadCount(userId);

        return res.status(200).json({
            success: true,
            data: { count },
        });
    } catch (error: any) {
        console.error('Error getting unread count:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error getting unread count',
        });
    }
};

/**
 * Xóa notification
 * DELETE /api/notifications/:notificationId
 */
export const deleteNotification = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { notificationId } = req.params;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        await depositNotificationService.deleteNotification(notificationId, userId);

        return res.status(200).json({
            success: true,
            message: 'Notification deleted successfully',
        });
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error deleting notification',
        });
    }
};

