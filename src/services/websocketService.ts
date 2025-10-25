// src/services/websocketService.ts
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import Chat from "../models/Chat";
import Message from "../models/Message";
import { Types } from "mongoose";
import { Socket } from "socket.io";
import { FraudDetectionService } from "./fraudDetectionService";

interface AuthenticatedSocket extends Socket {
    userId?: string;
    user?: any;
}

export class WebSocketService {
    private static instance: WebSocketService;
    private io: SocketIOServer;
    private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

    constructor(server: HTTPServer) {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: [
                    "http://localhost:5173",
                    "http://localhost:5174",
                ],
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        this.setupMiddleware();
        this.setupEventHandlers();

        // Set singleton instance
        WebSocketService.instance = this;
    }

    // Singleton getter
    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            throw new Error('WebSocketService not initialized');
        }
        return WebSocketService.instance;
    }

    private setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
                const user = await User.findById(decoded.userId).select('-password -refreshToken');

                if (!user) {
                    return next(new Error('Authentication error: User not found'));
                }

                socket.userId = user._id.toString();
                socket.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            console.log(`User ${socket.userId} connected with socket ${socket.id}`);

            // Store user connection
            if (socket.userId) {
                this.connectedUsers.set(socket.userId, socket.id);
            }

            // Join user to their personal room
            if (socket.userId) {
                socket.join(`user_${socket.userId}`);
            }

            // Handle joining chat room
            socket.on('join_chat', (chatId: string) => {
                socket.join(`chat_${chatId}`);
                console.log(`User ${socket.userId} joined chat ${chatId}`);
            });

            // Handle leaving chat room
            socket.on('leave_chat', (chatId: string) => {
                socket.leave(`chat_${chatId}`);
                console.log(`User ${socket.userId} left chat ${chatId}`);
            });

            // Handle sending messages
            socket.on('send_message', async (data: {
                chatId: string;
                content: string;
                messageType?: string;
                metadata?: any;
            }) => {
                try {
                    // Fraud detection
                    const fraudResult = await FraudDetectionService.checkChatFraud({
                        messageContent: data.content,
                        senderId: socket.userId as any,
                        messageType: data.messageType || 'text',
                    });

                    if (fraudResult.isFraud) {
                        // Send fraud warning to sender
                        socket.emit('fraud_warning', {
                            message: FraudDetectionService.generateFraudWarning(fraudResult),
                            riskScore: fraudResult.riskScore,
                        });

                        // Log fraud attempt
                        console.warn(`Fraud detected for user ${socket.userId}:`, fraudResult);
                        return;
                    }

                    // Kiểm tra quyền truy cập chat
                    const chat = await Chat.findById(data.chatId);
                    if (!chat) {
                        socket.emit('error', { message: 'Chat not found' });
                        return;
                    }

                    if (!chat.buyerId.equals(socket.userId) && !chat.sellerId.equals(socket.userId)) {
                        socket.emit('error', { message: 'Access denied' });
                        return;
                    }

                    // Lưu tin nhắn vào database
                    const messageDoc = new Message({
                        chatId: new Types.ObjectId(data.chatId),
                        senderId: new Types.ObjectId(socket.userId),
                        content: data.content,
                        messageType: data.messageType || 'text',
                        metadata: data.metadata || {},
                    });

                    await messageDoc.save();

                    // Cập nhật tin nhắn cuối cùng của chat
                    chat.lastMessage = {
                        content: data.content,
                        senderId: new Types.ObjectId(socket.userId),
                        timestamp: new Date(),
                    };
                    await chat.save();

                    // Lấy thông tin người gửi
                    await messageDoc.populate("senderId", "fullName");

                    // Broadcast message to chat room
                    this.io.to(`chat_${data.chatId}`).emit('new_message', {
                        _id: messageDoc._id,
                        chatId: data.chatId,
                        content: data.content,
                        messageType: data.messageType || 'text',
                        metadata: data.metadata,
                        senderId: {
                            _id: (messageDoc.senderId as any)._id,
                            fullName: (messageDoc.senderId as any).fullName
                        },
                        isRead: false,
                        createdAt: messageDoc.createdAt,
                        timestamp: messageDoc.createdAt,
                    });

                    // Notify other users in the chat
                    socket.to(`chat_${data.chatId}`).emit('message_notification', {
                        chatId: data.chatId,
                        senderId: socket.userId,
                        content: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
                    });

                } catch (error) {
                    console.error('Error handling send_message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            // Handle typing indicators
            socket.on('typing_start', (data: { chatId: string }) => {
                socket.to(`chat_${data.chatId}`).emit('user_typing', {
                    userId: socket.userId,
                    chatId: data.chatId,
                });
            });

            socket.on('typing_stop', (data: { chatId: string }) => {
                socket.to(`chat_${data.chatId}`).emit('user_stopped_typing', {
                    userId: socket.userId,
                    chatId: data.chatId,
                });
            });

            // Handle offer notifications
            socket.on('offer_created', (data: {
                chatId: string;
                offerId: string;
                offeredPrice: number;
                message?: string;
            }) => {
                // Notify seller about new offer
                this.io.to(`chat_${data.chatId}`).emit('new_offer', {
                    chatId: data.chatId,
                    offerId: data.offerId,
                    offeredPrice: data.offeredPrice,
                    message: data.message,
                    senderId: socket.userId,
                });
            });

            // Handle appointment notifications
            socket.on('appointment_created', (data: {
                chatId: string;
                appointmentId: string;
                scheduledDate: string;
                location: any;
            }) => {
                // Notify seller about new appointment
                this.io.to(`chat_${data.chatId}`).emit('new_appointment', {
                    chatId: data.chatId,
                    appointmentId: data.appointmentId,
                    scheduledDate: data.scheduledDate,
                    location: data.location,
                    senderId: socket.userId,
                });
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`User ${socket.userId} disconnected`);
                if (socket.userId) {
                    this.connectedUsers.delete(socket.userId);
                }
            });
        });
    }

    // Send notification to specific user
    public sendToUser(userId: string, event: string, data: any) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    // Send notification to chat room
    public sendToChat(chatId: string, event: string, data: any) {
        this.io.to(`chat_${chatId}`).emit(event, data);
    }

    // Broadcast to all connected users
    public broadcast(event: string, data: any) {
        this.io.emit(event, data);
    }

    // Get connected users count
    public getConnectedUsersCount(): number {
        return this.connectedUsers.size;
    }

    // Check if user is online
    public isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    // Broadcast message to chat room (for HTTP API integration)
    public broadcastMessage(chatId: string, message: any) {
        this.io.to(`chat_${chatId}`).emit('new_message', message);
    }

    // Send message notification to chat room (for HTTP API integration)
    public sendMessageNotification(chatId: string, senderId: string, content: string) {
        this.io.to(`chat_${chatId}`).emit('message_notification', {
            chatId,
            senderId,
            content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        });
    }

    // Broadcast offer notification
    public broadcastOffer(chatId: string, offerData: any) {
        this.io.to(`chat_${chatId}`).emit('new_offer', offerData);
    }

    // Broadcast appointment notification
    public broadcastAppointment(chatId: string, appointmentData: any) {
        this.io.to(`chat_${chatId}`).emit('new_appointment', appointmentData);
    }
}
