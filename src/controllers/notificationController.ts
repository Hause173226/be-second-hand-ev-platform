// src/controllers/notificationController.ts
import { Request, Response, NextFunction } from "express";
import notificationMessageService from "../services/notificationMessageService";

// Lấy danh sách notification của user
export const getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { limit = 20, skip = 0, type, isRead } = req.query;

        console.log('🎯 getNotifications called by userId:', userId);
        console.log('📋 Query params:', { limit, skip, type, isRead });

        const result = await notificationMessageService.getUserNotifications(userId, {
            limit: Number(limit),
            skip: Number(skip),
            type: type as string,
            isRead: isRead === "true" ? true : isRead === "false" ? false : undefined
        });

        res.json({
            success: true,
            data: result.notifications,
            pagination: {
                total: result.total,
                limit: Number(limit),
                skip: Number(skip),
                hasMore: result.total > Number(skip) + Number(limit)
            },
            unreadCount: result.unreadCount
        });
    } catch (error) {
        console.error("Error in getNotifications:", error);
        res.status(500).json({
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

        res.json({
            success: true,
            data: notification,
            message: "Đã đánh dấu thông báo là đã đọc"
        });
    } catch (error) {
        console.error("Error in markAsRead:", error);
        res.status(500).json({
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

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error in markAllAsRead:", error);
        res.status(500).json({
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
        const userId = (req as any).user.userId;
        const { notificationId } = req.params;

        const result = await notificationMessageService.deleteNotification(notificationId, userId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error in deleteNotification:", error);
        res.status(500).json({
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