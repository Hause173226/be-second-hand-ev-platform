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
import { NotificationService } from "./notificationService";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private typingUsers: Map<
    string,
    Map<string, { userInfo: any; timeout: NodeJS.Timeout }>
  > = new Map(); // chatId -> userId -> userInfo

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"],
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
      throw new Error("WebSocketService not initialized");
    }
    return WebSocketService.instance;
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "your-secret-key"
        ) as any;
        const user = await User.findById(decoded.userId).select(
          "-password -refreshToken"
        );

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      //   console.log(`User ${socket.userId} connected with socket ${socket.id}`);

      // Store user connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);

        // Send online status update to all users
        this.sendOnlineStatusUpdate(socket.userId, true);

        // Broadcast to all chats this user is part of
        this.broadcastUserOnlineStatusToChats(socket.userId, true);
      }

      // Join user to their personal room
      if (socket.userId) {
        socket.join(`user_${socket.userId}`);
      }

      // Handle joining chat room
      socket.on("join_chat", (chatId: string) => {
        socket.join(`chat_${chatId}`);
        // console.log(`User ${socket.userId} joined chat ${chatId}`);
      });

      // Handle leaving chat room
      socket.on("leave_chat", (chatId: string) => {
        socket.leave(`chat_${chatId}`);
        console.log(`User ${socket.userId} left chat ${chatId}`);
      });

      // Handle sending messages
      socket.on(
        "send_message",
        async (data: {
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
              messageType: data.messageType || "text",
            });

            if (fraudResult.isFraud) {
              // Send fraud warning to sender
              socket.emit("fraud_warning", {
                message:
                  FraudDetectionService.generateFraudWarning(fraudResult),
                riskScore: fraudResult.riskScore,
              });

              // Log fraud attempt
              console.warn(
                `Fraud detected for user ${socket.userId}:`,
                fraudResult
              );
              return;
            }

            // Kiểm tra quyền truy cập chat
            const chat = await Chat.findById(data.chatId);
            if (!chat) {
              socket.emit("error", { message: "Chat not found" });
              return;
            }

            if (
              !chat.buyerId.equals(socket.userId) &&
              !chat.sellerId.equals(socket.userId)
            ) {
              socket.emit("error", { message: "Access denied" });
              return;
            }

            // Lưu tin nhắn vào database
            const messageDoc = new Message({
              chatId: new Types.ObjectId(data.chatId),
              senderId: new Types.ObjectId(socket.userId),
              content: data.content,
              messageType: data.messageType || "text",
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
            await messageDoc.populate("senderId", "fullName avatar");

            // Broadcast message to chat room
            this.io.to(`chat_${data.chatId}`).emit("new_message", {
              _id: messageDoc._id,
              chatId: data.chatId,
              content: data.content,
              messageType: data.messageType || "text",
              metadata: data.metadata,
              senderId: {
                _id: (messageDoc.senderId as any)._id,
                fullName: (messageDoc.senderId as any).fullName,
                avatar:
                  (messageDoc.senderId as any).avatar || "/default-avatar.png",
              },
              isRead: false,
              createdAt: messageDoc.createdAt,
              timestamp: messageDoc.createdAt,
            });

            // Notify other users in the chat
            socket.to(`chat_${data.chatId}`).emit("message_notification", {
              chatId: data.chatId,
              senderId: socket.userId,
              content:
                data.content.substring(0, 50) +
                (data.content.length > 50 ? "..." : ""),
            });

            // Tạo notification cho người nhận (nếu không online trong chat)
            try {
              const receiverId =
                chat.buyerId.toString() === socket.userId
                  ? chat.sellerId.toString()
                  : chat.buyerId.toString();

              const { default: notificationMessageService } = await import(
                "./notificationMessageService"
              );
              await notificationMessageService.createMessageNotification({
                userId: receiverId,
                senderId: socket.userId as string,
                chatId: data.chatId,
                messageId: messageDoc._id.toString(),
                messageContent: data.content,
                senderName: (messageDoc.senderId as any).fullName,
                senderAvatar: (messageDoc.senderId as any).avatar,
              });
            } catch (error) {
              console.error("Error creating notification:", error);
            }

            // Broadcast chat list update to both users
            const buyerIdStr = chat.buyerId.toString();
            const sellerIdStr = chat.sellerId.toString();

            [buyerIdStr, sellerIdStr].forEach((userId) => {
              this.io.to(`user_${userId}`).emit("chat_list_update", {
                chatId: data.chatId,
                lastMessage: {
                  content: data.content,
                  senderId: socket.userId,
                  timestamp: new Date(),
                },
                updatedAt: new Date(),
              });
            });
          } catch (error) {
            console.error("Error handling send_message:", error);
            socket.emit("error", { message: "Failed to send message" });
          }
        }
      );

      // Handle sending images via WebSocket
      socket.on(
        "send_image",
        async (data: {
          chatId: string;
          imageData: string;
          content?: string;
          caption?: string;
          fileName?: string;
        }) => {
          try {
            // Kiểm tra quyền truy cập chat
            const chat = await Chat.findById(data.chatId);
            if (!chat) {
              socket.emit("error", { message: "Chat not found" });
              return;
            }

            if (
              !chat.buyerId.equals(socket.userId) &&
              !chat.sellerId.equals(socket.userId)
            ) {
              socket.emit("error", { message: "Access denied" });
              return;
            }

            // Import FileUploadService dynamically to avoid circular dependency
            const { FileUploadService } = await import("./fileUploadService");

            // Xử lý base64 image data
            const processedImage = await FileUploadService.processBase64Image(
              data.imageData,
              data.fileName || "pasted-image.png"
            );

            // Tạo metadata cho tin nhắn hình ảnh
            const messageMetadata = {
              files: [
                {
                  filename: processedImage.filename,
                  originalname: processedImage.originalname,
                  url: processedImage.url,
                  size: processedImage.size,
                  mimetype: processedImage.mimetype,
                  formattedSize: FileUploadService.formatFileSize(
                    processedImage.size
                  ),
                },
              ],
            };

            // Lưu tin nhắn vào database
            const messageDoc = new Message({
              chatId: new Types.ObjectId(data.chatId),
              senderId: new Types.ObjectId(socket.userId),
              content:
                (data.content && data.content.trim()) ||
                (data.caption && data.caption.trim()) ||
                "Đã gửi hình ảnh",
              messageType: "image",
              metadata: messageMetadata,
            });

            await messageDoc.save();

            // Cập nhật tin nhắn cuối cùng của chat
            chat.lastMessage = {
              content: messageDoc.content,
              senderId: new Types.ObjectId(socket.userId),
              timestamp: new Date(),
            };
            await chat.save();

            // Lấy thông tin người gửi
            await messageDoc.populate("senderId", "fullName avatar");

            // Broadcast message to chat room
            this.io.to(`chat_${data.chatId}`).emit("new_message", {
              _id: messageDoc._id,
              chatId: data.chatId,
              content: messageDoc.content,
              messageType: "image",
              metadata: messageDoc.metadata,
              senderId: {
                _id: (messageDoc.senderId as any)._id,
                fullName: (messageDoc.senderId as any).fullName,
                avatar:
                  (messageDoc.senderId as any).avatar || "/default-avatar.png",
              },
              isRead: false,
              createdAt: messageDoc.createdAt,
              timestamp: messageDoc.createdAt,
            });

            // Notify other users in the chat
            socket.to(`chat_${data.chatId}`).emit("message_notification", {
              chatId: data.chatId,
              senderId: socket.userId,
              content: "📷 Đã gửi hình ảnh",
              messageType: "image",
            });

            // Broadcast chat list update to both users
            const buyerIdStr = chat.buyerId.toString();
            const sellerIdStr = chat.sellerId.toString();

            [buyerIdStr, sellerIdStr].forEach((userId) => {
              this.io.to(`user_${userId}`).emit("chat_list_update", {
                chatId: data.chatId,
                lastMessage: {
                  content: messageDoc.content,
                  senderId: socket.userId,
                  timestamp: new Date(),
                },
                updatedAt: new Date(),
              });
            });
          } catch (error) {
            console.error("Error handling send_image:", error);
            socket.emit("error", { message: "Failed to send image" });
          }
        }
      );

      // Handle typing indicators with enhanced features
      socket.on("typing_start", (data: { chatId: string }) => {
        if (!socket.userId) return;

        const chatId = data.chatId;
        const userInfo = {
          userId: socket.userId,
          fullName: socket.user?.fullName || "Unknown User",
          avatar: socket.user?.avatar || "/default-avatar.png",
        };

        // Initialize chat typing users if not exists
        if (!this.typingUsers.has(chatId)) {
          this.typingUsers.set(chatId, new Map());
        }

        const chatTypingUsers = this.typingUsers.get(chatId)!;

        // Clear existing timeout if user was already typing
        if (chatTypingUsers.has(socket.userId)) {
          clearTimeout(chatTypingUsers.get(socket.userId)!.timeout);
        }

        // Set new timeout (3 seconds)
        const timeout = setTimeout(() => {
          this.handleTypingStop(chatId, socket.userId!);
        }, 3000);

        // Add user to typing list
        chatTypingUsers.set(socket.userId, { userInfo, timeout });

        // Broadcast to other users in chat
        socket.to(`chat_${chatId}`).emit("user_typing", {
          chatId,
          typingUsers: Array.from(chatTypingUsers.values()).map(
            (u) => u.userInfo
          ),
          timestamp: new Date(),
        });
      });

      socket.on("typing_stop", (data: { chatId: string }) => {
        if (!socket.userId) return;
        this.handleTypingStop(data.chatId, socket.userId);
      });

      // Handle offer notifications
      socket.on(
        "offer_created",
        (data: {
          chatId: string;
          offerId: string;
          offeredPrice: number;
          message?: string;
        }) => {
          // Notify seller about new offer
          this.io.to(`chat_${data.chatId}`).emit("new_offer", {
            chatId: data.chatId,
            offerId: data.offerId,
            offeredPrice: data.offeredPrice,
            message: data.message,
            senderId: socket.userId,
          });
        }
      );

      // Handle appointment notifications
      socket.on(
        "appointment_created",
        (data: {
          chatId: string;
          appointmentId: string;
          scheduledDate: string;
          location: any;
        }) => {
          // Notify seller about new appointment
          this.io.to(`chat_${data.chatId}`).emit("new_appointment", {
            chatId: data.chatId,
            appointmentId: data.appointmentId,
            scheduledDate: data.scheduledDate,
            location: data.location,
            senderId: socket.userId,
          });
        }
      );

      // Đấu giá: Tham gia 1 phòng auction
      socket.on("join_auction", (auctionId: string) => {
        socket.join(`auction_${auctionId}`);
        // Optionally: gửi thông báo user tham gia
      });

      socket.on("leave_auction", (auctionId: string) => {
        socket.leave(`auction_${auctionId}`);
      });

      // Khi user submit bid mới
      socket.on(
        "bid_auction",
        async (data: { auctionId: string; bid: number }) => {
          const userId = socket.userId;
          if (!userId) {
            socket.emit("auction_bid_result", { error: "Chưa xác thực" });
            return;
          }
          const { auctionId, bid } = data;
          try {
            const Auction = (await import("../models/Auction")).default;
            const { Types } = await import("mongoose");
            const auction = await Auction.findById(auctionId);
            if (!auction) {
              socket.emit("auction_bid_result", {
                error: "Không tồn tại phiên",
              });
              return;
            }
            if (auction.status !== "active") {
              socket.emit("auction_bid_result", {
                error: "Phiên đã kết thúc hoặc đóng",
              });
              return;
            }
            const now = new Date();
            if (now < auction.startAt || now > auction.endAt) {
              socket.emit("auction_bid_result", {
                error: "Ngoài thời gian phiên đấu giá",
              });
              return;
            }
            const highestBid =
              auction.bids.length > 0
                ? Math.max(...auction.bids.map((b) => b.price))
                : auction.startingPrice;
            if (bid <= highestBid) {
              socket.emit("auction_bid_result", {
                error: `Giá phải lớn hơn hiện tại (${highestBid})`,
              });
              return;
            }
            // Push bid mới - convert userId to ObjectId
            auction.bids.push({
              userId: new Types.ObjectId(userId),
              price: bid,
              createdAt: now,
            });
            await auction.save();
            // Broadcast cho tất cả user đã join auction
            this.io.to(`auction_${auctionId}`).emit("auction_bid_update", {
              auctionId,
              bid: { userId, price: bid, createdAt: now },
              highest: bid,
              bidsCount: auction.bids.length,
            });
            socket.emit("auction_bid_result", { success: true });
          } catch (err) {
            socket.emit("auction_bid_result", {
              error: err instanceof Error ? err.message : err,
            });
          }
        }
      );

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User ${socket.userId} disconnected`);
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);

          // Send offline status update
          this.sendOnlineStatusUpdate(socket.userId, false);

          // Broadcast to all chats this user is part of
          this.broadcastUserOnlineStatusToChats(socket.userId, false);

          // Clear typing status for all chats
          this.clearUserTypingStatus(socket.userId);
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
    this.io.to(`chat_${chatId}`).emit("new_message", message);
  }

  // Send message notification to chat room (for HTTP API integration)
  public sendMessageNotification(
    chatId: string,
    senderId: string,
    content: string
  ) {
    this.io.to(`chat_${chatId}`).emit("message_notification", {
      chatId,
      senderId,
      content: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
    });
  }

  // Broadcast offer notification
  public broadcastOffer(chatId: string, offerData: any) {
    this.io.to(`chat_${chatId}`).emit("new_offer", offerData);
  }

  // Broadcast appointment notification
  public broadcastAppointment(chatId: string, appointmentData: any) {
    this.io.to(`chat_${chatId}`).emit("new_appointment", appointmentData);
  }

  // Send enhanced message notification with avatar
  public sendEnhancedMessageNotification(
    chatId: string,
    senderId: string,
    content: string,
    senderInfo: any
  ) {
    this.io.to(`chat_${chatId}`).emit("message_notification", {
      chatId,
      senderId,
      senderName: senderInfo.fullName,
      senderAvatar: senderInfo.avatar,
      content: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
      timestamp: new Date(),
    });
  }

  // Send typing indicator with user info
  public sendTypingIndicator(
    chatId: string,
    userId: string,
    userInfo: any,
    isTyping: boolean
  ) {
    this.io
      .to(`chat_${chatId}`)
      .emit(isTyping ? "user_typing" : "user_stopped_typing", {
        userId,
        chatId,
        userInfo: {
          fullName: userInfo.fullName,
          avatar: userInfo.avatar,
        },
        timestamp: new Date(),
      });
  }

  // Send message reaction update
  public sendReactionUpdate(
    chatId: string,
    messageId: string,
    reactions: any[],
    userId: string,
    emoji: string,
    action: string
  ) {
    this.io.to(`chat_${chatId}`).emit("message_reaction_updated", {
      messageId,
      reactions,
      userId,
      emoji,
      action,
      timestamp: new Date(),
    });
  }

  // Send message edit notification
  public sendMessageEditNotification(
    chatId: string,
    messageId: string,
    newContent: string,
    editedAt: Date
  ) {
    this.io.to(`chat_${chatId}`).emit("message_edited", {
      messageId,
      content: newContent,
      editedAt,
      timestamp: new Date(),
    });
  }

  // Send message delete notification
  public sendMessageDeleteNotification(
    chatId: string,
    messageId: string,
    deletedBy: string,
    deleteForEveryone: boolean
  ) {
    this.io.to(`chat_${chatId}`).emit("message_deleted", {
      messageId,
      deletedBy,
      deleteForEveryone,
      deletedAt: new Date(),
      timestamp: new Date(),
    });
  }

  // Send file upload notification
  public sendFileUploadNotification(
    chatId: string,
    messageId: string,
    files: any[],
    senderInfo: any
  ) {
    this.io.to(`chat_${chatId}`).emit("file_uploaded", {
      messageId,
      files,
      senderInfo,
      timestamp: new Date(),
    });
  }

  // Emit auction event (public method to access io)
  public emitAuctionEvent(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  // Send online status update
  public sendOnlineStatusUpdate(userId: string, isOnline: boolean) {
    this.io.emit("user_status_update", {
      userId,
      isOnline,
      timestamp: new Date(),
    });
  }

  // Broadcast user online status to all their chats
  public async broadcastUserOnlineStatusToChats(
    userId: string,
    isOnline: boolean
  ) {
    try {
      const Chat = (await import("../models/Chat")).default;
      const chats = await Chat.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        isActive: true,
      }).select("_id buyerId sellerId");

      chats.forEach((chat) => {
        const otherUserId =
          chat.buyerId.toString() === userId
            ? chat.sellerId.toString()
            : chat.buyerId.toString();
        this.io.to(`user_${otherUserId}`).emit("contact_status_update", {
          userId,
          chatId: chat._id.toString(),
          isOnline,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("Error broadcasting user online status to chats:", error);
    }
  }

  // Get online users in a chat
  public getOnlineUsersInChat(chatId: string): string[] {
    const onlineUsers: string[] = [];
    const chatRoom = this.io.sockets.adapter.rooms.get(`chat_${chatId}`);

    if (chatRoom) {
      chatRoom.forEach((socketId) => {
        const socket = this.io.sockets.sockets.get(
          socketId
        ) as AuthenticatedSocket;
        if (socket && socket.userId) {
          onlineUsers.push(socket.userId);
        }
      });
    }

    return onlineUsers;
  }

  // Handle typing stop with cleanup
  private handleTypingStop(chatId: string, userId: string) {
    const chatTypingUsers = this.typingUsers.get(chatId);
    if (!chatTypingUsers) return;

    const userTyping = chatTypingUsers.get(userId);
    if (userTyping) {
      clearTimeout(userTyping.timeout);
      chatTypingUsers.delete(userId);
    }

    // If no one is typing, remove the chat from map
    if (chatTypingUsers.size === 0) {
      this.typingUsers.delete(chatId);
    }

    // Broadcast to other users
    this.io.to(`chat_${chatId}`).emit("user_stopped_typing", {
      chatId,
      typingUsers: Array.from(chatTypingUsers.values()).map((u) => u.userInfo),
      timestamp: new Date(),
    });
  }

  // Get typing users in a chat
  public getTypingUsersInChat(chatId: string): any[] {
    const chatTypingUsers = this.typingUsers.get(chatId);
    if (!chatTypingUsers) return [];

    return Array.from(chatTypingUsers.values()).map((u) => u.userInfo);
  }

  // Clear typing status for a user in all chats
  private clearUserTypingStatus(userId: string) {
    this.typingUsers.forEach((chatTypingUsers, chatId) => {
      const userTyping = chatTypingUsers.get(userId);
      if (userTyping) {
        clearTimeout(userTyping.timeout);
        chatTypingUsers.delete(userId);

        // If no one is typing, remove the chat from map
        if (chatTypingUsers.size === 0) {
          this.typingUsers.delete(chatId);
        } else {
          // Broadcast to other users that this user stopped typing
          this.io.to(`chat_${chatId}`).emit("user_stopped_typing", {
            chatId,
            typingUsers: Array.from(chatTypingUsers.values()).map(
              (u) => u.userInfo
            ),
            timestamp: new Date(),
          });
        }
      }
    });
  }
}
