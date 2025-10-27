// src/controllers/notificationDepositController.ts
import { Request, Response } from 'express';
import depositNotificationService from '../services/depositNotificationService';

// Lấy danh sách notification của user
export const getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { limit = 20, skip = 0, type, isRead } = req.query;

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
            message: error instanceof Error ? error.message : "Lỗi khi lấy thông báo"
        });
    }
};

// Lấy số lượng notification chưa đọc
export const getUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const result = await notificationMessageService.getUnreadCount(userId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error in getUnreadCount:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Lỗi khi lấy số thông báo chưa đọc"
        });
    }
};

// Đánh dấu notification đã đọc
export const markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { notificationId } = req.params;

        const notification = await notificationMessageService.markAsRead(notificationId, userId);

        const notification = await depositNotificationService.markAsRead(
            notificationId,
            userId
        );

        return res.status(200).json({
            success: true,
            data: notification,
            message: "Đã đánh dấu thông báo là đã đọc"
        });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Lỗi khi đánh dấu đã đọc"
        });
    }
};

// Đánh dấu tất cả notification đã đọc
export const markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const result = await notificationMessageService.markAllAsRead(userId);

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        const result = await depositNotificationService.markAllAsRead(userId);

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Lỗi khi đánh dấu tất cả đã đọc"
        });
    }
};

// Xóa notification
export const deleteNotification = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
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

        const result = await notificationMessageService.deleteNotification(notificationId, userId);

        await depositNotificationService.deleteNotification(notificationId, userId);

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Lỗi khi xóa thông báo"
        });
    }
};

// Xóa tất cả notification đã đọc
export const deleteAllRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const result = await notificationMessageService.deleteAllRead(userId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error in deleteAllRead:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Lỗi khi xóa thông báo"
        });
    }
};
