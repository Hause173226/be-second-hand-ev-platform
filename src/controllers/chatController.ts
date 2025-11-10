
import { Request, Response, NextFunction } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import Listing from "../models/Listing";
import { User } from "../models/User";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";
import { FileUploadService } from "../services/fileUploadService";
import chatService from "../services/chatService";


export const createDirectChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = (req as any).user.userId;

        if (!targetUserId) {
            res.status(400).json({ error: "ID người dùng đích là bắt buộc" });
            return;
        }

        if (currentUserId === targetUserId) {
            res.status(400).json({ error: "Không thể tạo chat với chính mình" });
            return;
        }

        // Kiểm tra user đích có tồn tại không
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            res.status(404).json({ error: "Không tìm thấy người dùng đích" });
            return;
        }

        // Kiểm tra xem chat đã tồn tại chưa
        let chat = await Chat.findOne({
            $or: [
                { buyerId: currentUserId, sellerId: targetUserId },
                { buyerId: targetUserId, sellerId: currentUserId }
            ],
            listingId: { $exists: false }, // Chat trực tiếp không có listingId
            isActive: true,
        }).populate("buyerId sellerId", "fullName phone email avatar");

        if (!chat) {
            // Tạo chat mới
            chat = new Chat({
                buyerId: new Types.ObjectId(currentUserId),
                sellerId: new Types.ObjectId(targetUserId),
                isActive: true,
                chatType: 'direct' // Đánh dấu là chat trực tiếp
            });
            await chat.save();
            await chat.populate("buyerId sellerId", "fullName phone email avatar");
        }

        res.json(chat);
    } catch (error) {
        console.error("Lỗi trong createDirectChat:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

export const getOrCreateChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { listingId } = req.params;
        const buyerId = (req as any).user.userId;

        // Tìm listing để lấy sellerId
        const listing = await Listing.findById(listingId);
        if (!listing) {
            res.status(404).json({ error: "Không tìm thấy listing" });
            return;
        }

        // Kiểm tra xem chat đã tồn tại chưa
        let chat = await Chat.findOne({
            listingId: new Types.ObjectId(listingId),
            buyerId: new Types.ObjectId(buyerId),
            sellerId: listing.sellerId,
            isActive: true,
        }).populate("buyerId sellerId listingId", "fullName phone email avatar make model year");

        if (!chat) {
            // Tạo chat mới
            chat = new Chat({
                listingId: new Types.ObjectId(listingId),
                buyerId: new Types.ObjectId(buyerId),
                sellerId: listing.sellerId,
                isActive: true,
            });
            await chat.save();
            await chat.populate("buyerId sellerId listingId", "fullName phone email avatar make model year");
        }

        res.json(chat);
    } catch (error) {
        console.error("Lỗi trong getOrCreateChat:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const getUserChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;

        // Sử dụng chatService (không có pagination trong service hiện tại)
        const chats = await chatService.getUserConversations(userId);

        res.json({ chats });
    } catch (error) {
        console.error("Lỗi trong getUserChats:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};


export const getChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const userId = (req as any).user.userId;

        // Lấy thông tin chat trước
        const chat = await Chat.findById(chatId)
            .populate('buyerId', 'fullName avatar phone email')
            .populate('sellerId', 'fullName avatar phone email')
            .populate('listingId', 'make model year photos priceListed status')
            .lean();

        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        // Xác định otherUser (người còn lại trong cuộc chat)
        const isBuyer = chat.buyerId._id.toString() === userId;
        const otherUser = isBuyer ? chat.sellerId : chat.buyerId;

        // Lấy messages
        const skip = (Number(page) - 1) * Number(limit);
        const messages = await chatService.getMessages(chatId, Number(limit), skip);

        res.json({ 
            messages,
            chat: {
                _id: chat._id,
                buyerId: chat.buyerId,
                sellerId: chat.sellerId,
                listingId: chat.listingId,
                otherUser,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt
            }
        });
    } catch (error) {
        console.error("Lỗi trong getChatMessages:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};


export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { content, messageType = "text", metadata } = req.body;
        const senderId = (req as any).user.userId;

        if (!content) {
            res.status(400).json({ error: "Nội dung tin nhắn là bắt buộc" });
            return;
        }

        // Lấy chat để xác định receiverId
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        // Xác định receiverId
        const receiverId = chat.buyerId.toString() === senderId ? chat.sellerId.toString() : chat.buyerId.toString();

        // Sử dụng chatService
        const message = await chatService.sendMessage({
            chatId,
            senderId,
            receiverId,
            content,
            messageType,
            attachments: metadata?.files?.map((f: any) => f.url) || []
        });

        // Emit WebSocket event để notify real-time
        try {
            const wsService = WebSocketService.getInstance();
            const senderInfo = {
                fullName: (message.senderId as any).fullName,
                avatar: (message.senderId as any).avatar || '/default-avatar.png'
            };

            // Broadcast message to chat room
            wsService.broadcastMessage(chatId, {
                _id: message._id,
                chatId: message.chatId,
                content: message.content,
                messageType: message.messageType,
                metadata: message.metadata,
                senderId: {
                    _id: (message.senderId as any)._id,
                    fullName: senderInfo.fullName,
                    avatar: senderInfo.avatar
                },
                isRead: message.isRead,
                createdAt: message.createdAt,
                timestamp: message.createdAt,
            });

            // Send enhanced notification
            wsService.sendEnhancedMessageNotification(chatId, senderId, message.content, senderInfo);

            // Broadcast chat list update to both users
            const buyerIdStr = chat.buyerId.toString();
            const sellerIdStr = chat.sellerId.toString();
            
            wsService.sendToUser(buyerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: message.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
            
            wsService.sendToUser(sellerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: message.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
        } catch (wsError) {
            console.error("Lỗi gửi WebSocket notification:", wsError);
        }

        res.status(201).json(message);
    } catch (error) {
        console.error("Lỗi trong sendMessage:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};


export const markMessagesAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const userId = (req as any).user.userId;

        // Lấy thông tin chat trước
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        // Sử dụng chatService
        await chatService.markMessagesAsRead(chatId, userId);

        // Emit WebSocket event để update real-time
        try {
            const wsService = WebSocketService.getInstance();
            
            // Notify người gửi (người kia) rằng tin nhắn đã được đọc
            const otherUserId = chat.buyerId.toString() === userId 
                ? chat.sellerId.toString() 
                : chat.buyerId.toString();
            
            wsService.sendToUser(otherUserId, 'messages_read', {
                chatId,
                readBy: userId,
                timestamp: new Date()
            });

            // Broadcast to chat room
            wsService.broadcastToChatRoom(chatId, 'messages_read', {
                chatId,
                readBy: userId,
                timestamp: new Date()
            });

            // Update chat list for the user who read the messages
            wsService.sendToUser(userId, 'chat_list_update', {
                chatId,
                unreadCount: 0,
                updatedAt: new Date()
            });
        } catch (wsError) {
            console.error("Lỗi gửi WebSocket notification:", wsError);
        }

        res.json({ message: "Đã đánh dấu tin nhắn là đã đọc" });
    } catch (error) {
        console.error("Lỗi trong markMessagesAsRead:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};


export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;

        // Lấy tất cả chat mà user tham gia
        const chats = await Chat.find({
            $or: [{ buyerId: userId }, { sellerId: userId }],
            isActive: true,
        }).select("_id");

        const chatIds = chats.map(chat => chat._id);

        // Đếm tin nhắn chưa đọc
        const unreadCount = await Message.countDocuments({
            chatId: { $in: chatIds },
            senderId: { $ne: userId },
            isRead: false,
            'metadata.isDeleted': { $ne: true }
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error("Lỗi trong getUnreadCount:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

export const sendMessageWithPastedImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { content, caption, imageData, fileName = 'pasted-image.png' } = req.body;
        const senderId = (req as any).user.userId;

        // Validation đầu vào
        if (!imageData) {
            res.status(400).json({ error: "Dữ liệu hình ảnh là bắt buộc" });
            return;
        }

        // Kiểm tra format base64
        if (!imageData.startsWith('data:image/')) {
            res.status(400).json({ error: "Dữ liệu hình ảnh phải ở định dạng base64 hợp lệ" });
            return;
        }

        // Kiểm tra độ dài base64 (tránh quá lớn)
        if (imageData.length > 20 * 1024 * 1024) { // 20MB base64 string
            res.status(400).json({ error: "Hình ảnh quá lớn. Vui lòng chọn hình ảnh nhỏ hơn." });
            return;
        }

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(senderId) && !chat.sellerId.equals(senderId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Xử lý base64 image data
        const processedImage = await FileUploadService.processBase64Image(imageData, fileName);

        // Tạo metadata cho tin nhắn hình ảnh
        const messageMetadata = {
            files: [{
                filename: processedImage.filename,
                originalname: processedImage.originalname,
                url: processedImage.url,
                size: processedImage.size,
                mimetype: processedImage.mimetype,
                formattedSize: FileUploadService.formatFileSize(processedImage.size)
            }]
        };

        // Tạo tin nhắn mới
        const messageDoc = new Message({
            chatId: new Types.ObjectId(chatId),
            senderId: new Types.ObjectId(senderId),
            content: (content && String(content).trim()) || (caption && String(caption).trim()) || "Đã gửi hình ảnh",
            messageType: "image",
            metadata: messageMetadata,
        });

        await messageDoc.save();

        // Cập nhật tin nhắn cuối cùng của chat
        chat.lastMessage = {
            content: messageDoc.content,
            senderId: new Types.ObjectId(senderId),
            timestamp: new Date(),
        };
        await chat.save();

        // Lấy thông tin người gửi
        await messageDoc.populate("senderId", "fullName avatar");

        // Gửi real-time notification qua WebSocket
        try {
            const wsService = WebSocketService.getInstance();
            const senderInfo = {
                fullName: (messageDoc.senderId as any).fullName,
                avatar: (messageDoc.senderId as any).avatar || '/default-avatar.png'
            };

            wsService.broadcastMessage(chatId, {
                _id: messageDoc._id,
                chatId: messageDoc.chatId,
                content: messageDoc.content,
                messageType: messageDoc.messageType,
                metadata: messageDoc.metadata,
                senderId: {
                    _id: (messageDoc.senderId as any)._id,
                    fullName: senderInfo.fullName,
                    avatar: senderInfo.avatar
                },
                isRead: messageDoc.isRead,
                createdAt: messageDoc.createdAt,
                timestamp: messageDoc.createdAt,
            });

            // Gửi enhanced notification cho user khác
            wsService.sendEnhancedMessageNotification(chatId, senderId, messageDoc.content, senderInfo);

            // Gửi file upload notification
            wsService.sendFileUploadNotification(chatId, messageDoc._id.toString(), messageDoc.metadata?.files || [], senderInfo);
            
            // Broadcast chat list update to both users
            const buyerIdStr = chat.buyerId.toString();
            const sellerIdStr = chat.sellerId.toString();
            
            wsService.sendToUser(buyerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: messageDoc.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
            
            wsService.sendToUser(sellerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: messageDoc.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.status(201).json(messageDoc);
    } catch (error) {
        console.error("Lỗi trong sendMessageWithPastedImage:", error);

        // Xử lý các lỗi cụ thể
        if (error instanceof Error) {
            if (error.message.includes('Invalid base64 image format')) {
                res.status(400).json({ error: "Định dạng hình ảnh không được hỗ trợ. Chỉ hỗ trợ PNG, JPEG, JPG, GIF và WebP." });
            } else if (error.message.includes('Image size exceeds')) {
                res.status(400).json({ error: "Hình ảnh quá lớn. Kích thước tối đa là 10MB." });
            } else if (error.message.includes('Image size too small')) {
                res.status(400).json({ error: "Hình ảnh quá nhỏ. Vui lòng chọn hình ảnh khác." });
            } else {
                res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
            }
        } else {
            res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
        }
    }
};

export const sendMessageWithFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { content, caption, messageType = "text", metadata } = req.body;
        const senderId = (req as any).user.userId;

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(senderId) && !chat.sellerId.equals(senderId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        let messageMetadata: any = {};
        let finalMessageType = messageType;

        // Xử lý metadata từ body nếu có
        if (metadata) {
            try {
                messageMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            } catch (error) {
                console.error('Error parsing metadata:', error);
                messageMetadata = {};
            }
        }

        // Xử lý file upload nếu có
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            console.log('Processing files:', req.files.length);

            const uploadedFiles = await FileUploadService.processUploadedFiles(req.files as Express.Multer.File[]);
            console.log('Uploaded files:', uploadedFiles);

            // Xác định messageType dựa trên file đầu tiên
            const firstFile = uploadedFiles[0];
            const detectedMessageType = FileUploadService.getFileType(firstFile.mimetype);

            messageMetadata = {
                ...messageMetadata,
                files: uploadedFiles.map(file => ({
                    filename: file.filename,
                    originalname: file.originalname,
                    url: file.url,
                    size: file.size,
                    mimetype: file.mimetype,
                    formattedSize: FileUploadService.formatFileSize(file.size)
                }))
            };

            // Cập nhật messageType nếu có file
            if (detectedMessageType === 'image') {
                finalMessageType = 'image';
            } else {
                finalMessageType = 'file';
            }
        }

        // Tạo tin nhắn mới
        console.log('Final message metadata:', JSON.stringify(messageMetadata, null, 2));
        console.log('Final message type:', finalMessageType);

        const messageDoc = new Message({
            chatId: new Types.ObjectId(chatId),
            senderId: new Types.ObjectId(senderId),
            content: (content && String(content).trim()) || (caption && String(caption).trim()) || (req.files ? "Đã gửi file" : ""),
            messageType: finalMessageType,
            metadata: messageMetadata,
        });

        await messageDoc.save();
        console.log('Saved message:', JSON.stringify(messageDoc.toObject(), null, 2));

        // Cập nhật tin nhắn cuối cùng của chat
        chat.lastMessage = {
            content: messageDoc.content,
            senderId: new Types.ObjectId(senderId),
            timestamp: new Date(),
        };
        await chat.save();

        // Lấy thông tin người gửi
        await messageDoc.populate("senderId", "fullName avatar");

        // Gửi real-time notification qua WebSocket
        try {
            const wsService = WebSocketService.getInstance();
            const senderInfo = {
                fullName: (messageDoc.senderId as any).fullName,
                avatar: (messageDoc.senderId as any).avatar || '/default-avatar.png'
            };

            wsService.broadcastMessage(chatId, {
                _id: messageDoc._id,
                chatId: messageDoc.chatId,
                content: messageDoc.content,
                messageType: messageDoc.messageType,
                metadata: messageDoc.metadata,
                senderId: {
                    _id: (messageDoc.senderId as any)._id,
                    fullName: senderInfo.fullName,
                    avatar: senderInfo.avatar
                },
                isRead: messageDoc.isRead,
                createdAt: messageDoc.createdAt,
                timestamp: messageDoc.createdAt,
            });

            // Gửi enhanced notification cho user khác
            wsService.sendEnhancedMessageNotification(chatId, senderId, messageDoc.content, senderInfo);

            // Gửi file upload notification
            if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                wsService.sendFileUploadNotification(chatId, messageDoc._id.toString(), messageDoc.metadata?.files || [], senderInfo);
            }
            
            // Broadcast chat list update to both users
            const buyerIdStr = chat.buyerId.toString();
            const sellerIdStr = chat.sellerId.toString();
            
            wsService.sendToUser(buyerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: messageDoc.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
            
            wsService.sendToUser(sellerIdStr, 'chat_list_update', {
                chatId,
                lastMessage: {
                    content: messageDoc.content,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.status(201).json(messageDoc);
    } catch (error) {
        console.error("Lỗi trong sendMessageWithFiles:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const searchMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { query, limit = 20 } = req.query;
        const userId = (req as any).user.userId;

        if (!query) {
            res.status(400).json({ error: "Từ khóa tìm kiếm là bắt buộc" });
            return;
        }

        // Sử dụng chatService
        const messages = await chatService.searchMessages(chatId, query as string, Number(limit));

        res.json({ messages });
    } catch (error) {
        console.error("Lỗi trong searchMessages:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};


export const addMessageReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = (req as any).user.userId;

        if (!emoji) {
            res.status(400).json({ error: "Emoji là bắt buộc" });
            return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ error: "Không tìm thấy tin nhắn" });
            return;
        }

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(message.chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Khởi tạo metadata nếu chưa có
        if (!message.metadata) {
            message.metadata = {};
        }
        if (!message.metadata.reactions) {
            message.metadata.reactions = [];
        }

        // Kiểm tra xem user đã reaction với emoji này chưa
        const existingReaction = message.metadata.reactions.find(
            (reaction: any) => reaction.userId.equals(userId) && reaction.emoji === emoji
        );

        if (existingReaction) {
            // Xóa reaction nếu đã tồn tại
            message.metadata.reactions = message.metadata.reactions.filter(
                (reaction: any) => !(reaction.userId.equals(userId) && reaction.emoji === emoji)
            );
        } else {
            // Thêm reaction mới
            message.metadata.reactions.push({
                userId: new Types.ObjectId(userId),
                emoji,
                createdAt: new Date()
            });
        }

        await message.save();

        // Gửi real-time notification
        try {
            const wsService = WebSocketService.getInstance();
            wsService.sendToChat(message.chatId.toString(), 'message_reaction_updated', {
                messageId: message._id,
                reactions: message.metadata.reactions,
                userId,
                emoji,
                action: existingReaction ? 'removed' : 'added'
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.json({
            message: existingReaction ? "Đã xóa reaction" : "Đã thêm reaction",
            reactions: message.metadata.reactions
        });
    } catch (error) {
        console.error("Lỗi trong addMessageReaction:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const editMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = (req as any).user.userId;

        if (!content) {
            res.status(400).json({ error: "Nội dung tin nhắn là bắt buộc" });
            return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ error: "Không tìm thấy tin nhắn" });
            return;
        }

        // Chỉ người gửi mới có thể sửa tin nhắn
        if (!message.senderId.equals(userId)) {
            res.status(403).json({ error: "Chỉ người gửi mới có thể sửa tin nhắn" });
            return;
        }

        // Không thể sửa tin nhắn đã bị xóa
        if (message.metadata?.isDeleted) {
            res.status(400).json({ error: "Không thể sửa tin nhắn đã bị xóa" });
            return;
        }

        // Cập nhật tin nhắn
        const oldContent = message.content;
        message.content = content;

        if (!message.metadata) {
            message.metadata = {};
        }
        message.metadata.editedAt = new Date();

        await message.save();

        // Cập nhật tin nhắn cuối cùng của chat
        const chat = await Chat.findById(message.chatId);
        if (chat) {
            chat.lastMessage = {
                content: message.content,
                senderId: message.senderId,
                timestamp: new Date(),
            };
            await chat.save();
        }

        // Gửi real-time notification
        try {
            const wsService = WebSocketService.getInstance();
            wsService.sendToChat(message.chatId.toString(), 'message_edited', {
                messageId: message._id,
                content: message.content,
                editedAt: message.metadata.editedAt,
                oldContent
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.json(message);
    } catch (error) {
        console.error("Lỗi trong editMessage:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const getMessageFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const userId = (req as any).user.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            res.status(404).json({ error: "Không tìm thấy tin nhắn" });
            return;
        }

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(message.chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Kiểm tra tin nhắn có file không
        if (!message.metadata?.files || message.metadata.files.length === 0) {
            res.status(404).json({ error: "Tin nhắn không có file" });
            return;
        }

        res.json({
            messageId: message._id,
            files: message.metadata.files,
            messageType: message.messageType,
            content: message.content,
            senderId: message.senderId,
            createdAt: message.createdAt
        });
    } catch (error) {
        console.error("Lỗi trong getMessageFiles:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const getOnlineUsersInChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const userId = (req as any).user.userId;

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Lấy danh sách user online trong chat
        const wsService = WebSocketService.getInstance();
        const onlineUserIds = wsService.getOnlineUsersInChat(chatId);

        // Lấy thông tin chi tiết của các user online
        const onlineUsers = await User.find({
            _id: { $in: onlineUserIds }
        }).select("fullName avatar phone email");

        res.json({
            chatId: chatId,
            onlineUsers: onlineUsers.map((user: any) => ({
                _id: user._id,
                fullName: user.fullName,
                avatar: user.avatar,
                phone: user.phone,
                email: user.email,
                isOnline: true
            })),
            onlineCount: onlineUsers.length,
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Lỗi trong getOnlineUsersInChat:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const getUserOnlineStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const currentUserId = (req as any).user.userId;

        // Kiểm tra user có tồn tại không
        const user = await User.findById(userId).select("fullName avatar phone email");
        if (!user) {
            res.status(404).json({ error: "Không tìm thấy user" });
            return;
        }

        // Kiểm tra trạng thái online
        const wsService = WebSocketService.getInstance();
        const isOnline = wsService.isUserOnline(userId);

        res.json({
            userId: userId,
            user: {
                _id: user._id,
                fullName: user.fullName,
                avatar: user.avatar,
                phone: user.phone,
                email: user.email
            },
            isOnline: isOnline,
            lastSeen: isOnline ? null : new Date(), // Có thể implement lastSeen logic
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Lỗi trong getUserOnlineStatus:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const deleteChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const userId = (req as any).user.userId;

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Xóa tất cả tin nhắn trong chat
        const messages = await Message.find({ chatId });

        // Xóa các file đính kèm nếu có
        for (const message of messages) {
            if (message.metadata?.files && message.metadata.files.length > 0) {
                for (const file of message.metadata.files) {
                    try {
                        await FileUploadService.deleteFile(file.filename);
                    } catch (error) {
                        console.error('Error deleting file:', file.filename, error);
                    }
                }
            }
        }

        // Xóa tất cả tin nhắn
        await Message.deleteMany({ chatId });

        // Xóa chat
        await Chat.findByIdAndDelete(chatId);

        // Gửi real-time notification
        try {
            const wsService = WebSocketService.getInstance();
            wsService.sendToChat(chatId, 'chat_deleted', {
                chatId: chatId,
                deletedBy: userId,
                deletedAt: new Date()
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.json({
            message: "Đã xóa toàn bộ cuộc trò chuyện",
            chatId: chatId,
            deletedMessages: messages.length,
            deletedAt: new Date()
        });
    } catch (error) {
        console.error("Lỗi trong deleteChat:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};


export const deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const userId = (req as any).user.userId;

        // Sử dụng chatService
        await chatService.deleteMessage(messageId, userId);

        res.json({ message: "Đã xóa tin nhắn" });
    } catch (error) {
        console.error("Lỗi trong deleteMessage:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
    
};