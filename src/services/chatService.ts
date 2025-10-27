import Message from "../models/Message";
import Chat from "../models/Chat";
import { User } from "../models/User";

export class ChatService {
  // Tạo hoặc lấy conversation giữa 2 user
  async getOrCreateConversation(userId1: string, userId2: string, listingId?: string) {
    // Tìm chat đã tồn tại
    let chat = await Chat.findOne({
      $or: [
        { buyerId: userId1, sellerId: userId2 },
        { buyerId: userId2, sellerId: userId1 }
      ],
      ...(listingId && { listingId }),
      isActive: true
    });

    if (!chat) {
      chat = await Chat.create({
        buyerId: userId1,
        sellerId: userId2,
        listingId,
        isActive: true,
        chatType: listingId ? "listing" : "direct"
      });
    }

    await chat.populate("buyerId", "fullName avatar email phone");
    await chat.populate("sellerId", "fullName avatar email phone");
    if (listingId) {
      await chat.populate("listingId", "make model year photos priceListed");
    }

    return chat;
  }

  // Gửi tin nhắn mới
  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    chatId: string;
    content: string;
    messageType?: "TEXT" | "IMAGE" | "FILE";
    attachments?: string[];
  }) {
    const message = await Message.create({
      chatId: data.chatId,
      senderId: data.senderId,
      content: data.content,
      messageType: data.messageType || "text",
      metadata: {
        files: data.attachments?.map(url => ({ url })) || []
      }
    });

    // Cập nhật chat với tin nhắn mới nhất
    await Chat.findByIdAndUpdate(data.chatId, {
      lastMessage: {
        content: message.content,
        senderId: message.senderId,
        timestamp: message.createdAt
      }
    });

    // Populate thông tin
    await message.populate("senderId", "fullName avatar");

    return message;
  }

  // Lấy lịch sử tin nhắn trong conversation
  async getMessages(chatId: string, limit: number = 50, skip: number = 0) {
    console.log('🔍 getMessages called with:', { chatId, limit, skip });
    
    const messages = await Message.find({ chatId })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log('📨 Found messages:', messages.length);
    
    return messages.reverse();
  }

  // Lấy danh sách conversation của user
  async getUserConversations(userId: string) {
    console.log('🔍 getUserConversations for userId:', userId);
    
    const conversations = await Chat.find({
      $or: [
        { buyerId: userId },
        { sellerId: userId }
      ],
      isActive: true
    })
      .populate("buyerId", "fullName avatar email phone")
      .populate("sellerId", "fullName avatar email phone")
      .populate("listingId", "make model year photos priceListed")
      .populate({
        path: "lastMessage.senderId",
        select: "fullName avatar"
      })
      .sort({ updatedAt: -1 });

    console.log('📋 Found conversations:', conversations.length);

    // Format dữ liệu để trả về
    const formattedConversations = conversations.map((conv: any) => {
      console.log('Chat:', {
        _id: conv._id,
        buyerId: conv.buyerId?._id,
        sellerId: conv.sellerId?._id,
        hasLastMessage: !!conv.lastMessage
      });

      // Xác định người dùng còn lại (không phải current user)
      const isBuyer = conv.buyerId?._id?.toString() === userId;
      const otherUser = isBuyer ? conv.sellerId : conv.buyerId;

      return {
        _id: conv._id,
        otherUser,
        listing: conv.listingId,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.updatedAt,
        chatType: conv.chatType,
        unreadCount: 0 // TODO: Implement unread count logic
      };
    });

    return formattedConversations;
  }

  // Đánh dấu tin nhắn đã đọc
  async markMessagesAsRead(chatId: string, userId: string) {
    // Cập nhật tất cả tin nhắn chưa đọc (không phải của mình)
    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        isRead: false
      },
      {
        $set: {
          isRead: true
        }
      }
    );

    // Reset unread count trong chat
    await Chat.findByIdAndUpdate(chatId, {
      $set: { [`unreadCount.${userId}`]: 0 }
    });

    return { success: true };
  }

  // Xóa tin nhắn (chỉ người gửi)
  async deleteMessage(messageId: string, userId: string) {
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId
    });

    if (!message) {
      throw new Error("Không tìm thấy tin nhắn hoặc bạn không có quyền xóa");
    }

    // Soft delete - đánh dấu là deleted
    // message.deleted = true; // Không có property deleted trong IMessage
    (message as any).isDeleted = true; // Sử dụng type assertion
    message.content = "Tin nhắn đã bị xóa";
    await message.save();

    return message;
  }

  // Tìm kiếm tin nhắn trong conversation
  async searchMessages(chatId: string, keyword: string, limit: number = 20) {
    const messages = await Message.find({
      chatId,
      content: { $regex: keyword, $options: "i" },
      "metadata.isDeleted": { $ne: true }
    })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 })
      .limit(limit);

    return messages;
  }

  // Lấy số lượng tin nhắn chưa đọc
  async getUnreadCount(userId: string) {
    const chats = await Chat.find({
      $or: [
        { buyerId: userId },
        { sellerId: userId }
      ],
      isActive: true
    });

    // Đếm số message chưa đọc trong mỗi chat
    let totalUnread = 0;
    for (const chat of chats) {
      const unreadCount = await Message.countDocuments({
        chatId: chat._id,
        senderId: { $ne: userId },
        isRead: false
      });
      totalUnread += unreadCount;
    }

    return { totalUnread, chatCount: chats.length };
  }

  // Xóa conversation (archive)
  async archiveConversation(chatId: string, userId: string) {
    const chat = await Chat.findOne({
      _id: chatId,
      $or: [
        { buyerId: userId },
        { sellerId: userId }
      ]
    });

    if (!chat) {
      throw new Error("Không tìm thấy conversation");
    }

    // Đánh dấu chat không active
    chat.isActive = false;
    await chat.save();

    return chat;
  }
}

export default new ChatService();
