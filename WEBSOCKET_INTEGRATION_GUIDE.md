# 🔌 WebSocket Integration Guide - Chat System

## ✅ Tổng quan tích hợp

### **WebSocket đã được tích hợp hoàn chỉnh:**

✅ **Real-time Messaging** - Gửi/nhận tin nhắn tức thì  
✅ **Online Status Tracking** - Theo dõi trạng thái online/offline  
✅ **Typing Indicators** - Hiển thị khi ai đó đang gõ  
✅ **Read Receipts** - Xác nhận đã đọc tin nhắn  
✅ **File Upload Notifications** - Thông báo khi upload file  
✅ **Message Reactions** - React emoji real-time  
✅ **Chat List Updates** - Cập nhật danh sách chat tự động  
✅ **Fraud Detection** - Phát hiện gian lận real-time

---

## 🏗️ Kiến trúc

```
┌─────────────────┐         WebSocket         ┌──────────────────┐
│   Frontend      │ ◄────────────────────────► │   Backend        │
│  (React/Vue)    │                            │  (Socket.IO)     │
└─────────────────┘                            └──────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
  Socket.IO Client                           WebSocketService
    - connect()                               - setupEventHandlers()
    - emit()                                  - connectedUsers Map
    - on()                                    - typingUsers Map
                                              - broadcastMessage()
```

---

## 🔐 Authentication

### **Socket.IO Middleware:**

```typescript
// src/services/websocketService.ts

this.io.use(async (socket: AuthenticatedSocket, next) => {
  const token =
    socket.handshake.auth.token ||
    socket.handshake.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);

  socket.userId = user._id.toString();
  socket.user = user;
  next();
});
```

---

## 📡 Events Reference

### **1. Connection Events**

#### **Client → Server:**

```javascript
// Connect
const socket = io("http://localhost:8081", {
  auth: { token: "your-jwt-token" },
});

// Connection successful
socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

// Connection error
socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
});
```

#### **Server → Client:**

```javascript
// User status update (broadcast to all)
socket.on("user_status_update", (data) => {
  console.log("User status:", data);
  // {
  //   userId: "673c...",
  //   isOnline: true,
  //   timestamp: "2025-10-27T..."
  // }
});

// Contact status update (specific to your chats)
socket.on("contact_status_update", (data) => {
  console.log("Contact status:", data);
  // {
  //   userId: "673c...",
  //   chatId: "673c...",
  //   isOnline: false,
  //   timestamp: "2025-10-27T..."
  // }
});
```

---

### **2. Chat Room Events**

#### **Client → Server:**

```javascript
// Join chat room
socket.emit("join_chat", chatId);

// Leave chat room
socket.emit("leave_chat", chatId);
```

---

### **3. Messaging Events**

#### **Client → Server:**

```javascript
// Send text message
socket.emit("send_message", {
  chatId: "673c...",
  content: "Hello!",
  messageType: "text",
  metadata: {},
});

// Send image via WebSocket
socket.emit("send_image", {
  chatId: "673c...",
  imageData: "data:image/png;base64,...",
  content: "Check this out!",
  caption: "My photo",
  fileName: "photo.png",
});
```

#### **Server → Client:**

```javascript
// New message received
socket.on("new_message", (message) => {
  console.log("New message:", message);
  // {
  //   _id: "673c...",
  //   chatId: "673c...",
  //   content: "Hello!",
  //   messageType: "text",
  //   senderId: {
  //     _id: "673c...",
  //     fullName: "John Doe",
  //     avatar: "https://..."
  //   },
  //   isRead: false,
  //   createdAt: "2025-10-27T...",
  //   timestamp: "2025-10-27T..."
  // }
});

// Message notification (short preview)
socket.on("message_notification", (data) => {
  console.log("Message notification:", data);
  // {
  //   chatId: "673c...",
  //   senderId: "673c...",
  //   senderName: "John Doe",
  //   senderAvatar: "https://...",
  //   content: "Hello!...",
  //   timestamp: "2025-10-27T..."
  // }
});

// Chat list update
socket.on("chat_list_update", (data) => {
  console.log("Chat list update:", data);
  // {
  //   chatId: "673c...",
  //   lastMessage: {
  //     content: "Hello!",
  //     senderId: "673c...",
  //     timestamp: "2025-10-27T..."
  //   },
  //   updatedAt: "2025-10-27T..."
  // }
});

// File uploaded
socket.on("file_uploaded", (data) => {
  console.log("File uploaded:", data);
  // {
  //   messageId: "673c...",
  //   files: [{
  //     filename: "image.png",
  //     url: "https://...",
  //     size: 12345,
  //     mimetype: "image/png"
  //   }],
  //   senderInfo: {...},
  //   timestamp: "2025-10-27T..."
  // }
});
```

---

### **4. Typing Indicator Events**

#### **Client → Server:**

```javascript
// Start typing
socket.emit("typing_start", {
  chatId: "673c...",
});

// Stop typing
socket.emit("typing_stop", {
  chatId: "673c...",
});
```

#### **Server → Client:**

```javascript
// User is typing
socket.on("user_typing", (data) => {
  console.log("User typing:", data);
  // {
  //   chatId: "673c...",
  //   typingUsers: [{
  //     userId: "673c...",
  //     fullName: "John Doe",
  //     avatar: "https://..."
  //   }],
  //   timestamp: "2025-10-27T..."
  // }
});

// User stopped typing
socket.on("user_stopped_typing", (data) => {
  console.log("User stopped typing:", data);
  // {
  //   chatId: "673c...",
  //   typingUsers: [],
  //   timestamp: "2025-10-27T..."
  // }
});
```

**Auto-stop logic:** Server tự động stop typing sau 3 giây không nhận event mới.

---

### **5. Message Actions Events**

#### **Client → Server:**

```javascript
// Thông qua HTTP API (có WebSocket broadcast)
// POST /api/chat/messages/:messageId/reaction
// PUT /api/chat/messages/:messageId
// DELETE /api/chat/messages/:messageId
```

#### **Server → Client:**

```javascript
// Message reaction updated
socket.on("message_reaction_updated", (data) => {
  console.log("Reaction:", data);
  // {
  //   messageId: "673c...",
  //   reactions: [{
  //     userId: "673c...",
  //     emoji: "👍",
  //     createdAt: "2025-10-27T..."
  //   }],
  //   userId: "673c...",
  //   emoji: "👍",
  //   action: "add",
  //   timestamp: "2025-10-27T..."
  // }
});

// Message edited
socket.on("message_edited", (data) => {
  console.log("Message edited:", data);
  // {
  //   messageId: "673c...",
  //   content: "New content",
  //   editedAt: "2025-10-27T...",
  //   timestamp: "2025-10-27T..."
  // }
});

// Message deleted
socket.on("message_deleted", (data) => {
  console.log("Message deleted:", data);
  // {
  //   messageId: "673c...",
  //   deletedBy: "673c...",
  //   deleteForEveryone: false,
  //   deletedAt: "2025-10-27T...",
  //   timestamp: "2025-10-27T..."
  // }
});
```

---

### **6. Offer & Appointment Events**

#### **Client → Server:**

```javascript
// Offer created
socket.emit("offer_created", {
  chatId: "673c...",
  offerId: "673c...",
  offeredPrice: 500000000,
  message: "I can offer 500M VND",
});

// Appointment created
socket.emit("appointment_created", {
  chatId: "673c...",
  appointmentId: "673c...",
  scheduledDate: "2025-10-30T10:00:00Z",
  location: "123 Street ABC",
});
```

#### **Server → Client:**

```javascript
// New offer
socket.on("new_offer", (data) => {
  console.log("New offer:", data);
  // {
  //   chatId: "673c...",
  //   offerId: "673c...",
  //   offeredPrice: 500000000,
  //   message: "...",
  //   senderId: "673c..."
  // }
});

// New appointment
socket.on("new_appointment", (data) => {
  console.log("New appointment:", data);
  // {
  //   chatId: "673c...",
  //   appointmentId: "673c...",
  //   scheduledDate: "2025-10-30T10:00:00Z",
  //   location: {...},
  //   senderId: "673c..."
  // }
});
```

---

### **7. Fraud Detection Events**

#### **Server → Client:**

```javascript
// Fraud warning
socket.on("fraud_warning", (data) => {
  console.log("⚠️ Fraud warning:", data);
  // {
  //   message: "Your message contains suspicious content...",
  //   riskScore: 0.85
  // }
});
```

---

### **8. Error Events**

#### **Server → Client:**

```javascript
// Error
socket.on("error", (data) => {
  console.error("Socket error:", data);
  // { message: "Chat not found" }
  // { message: "Access denied" }
  // { message: "Failed to send message" }
});
```

---

## 🌐 REST API Endpoints với WebSocket

### **Endpoints có WebSocket broadcast:**

| Endpoint                                 | Method | WebSocket Events                                          |
| ---------------------------------------- | ------ | --------------------------------------------------------- |
| `/api/chat/:chatId/messages`             | POST   | `new_message`, `message_notification`, `chat_list_update` |
| `/api/chat/:chatId/messages/image`       | POST   | `new_message`, `file_uploaded`, `chat_list_update`        |
| `/api/chat/:chatId/messages/files`       | POST   | `new_message`, `file_uploaded`, `chat_list_update`        |
| `/api/chat/messages/:messageId/reaction` | POST   | `message_reaction_updated`                                |
| `/api/chat/messages/:messageId`          | PUT    | `message_edited`                                          |
| `/api/chat/messages/:messageId`          | DELETE | `message_deleted`                                         |

---

## 📊 Online Status Tracking

### **REST API Endpoints:**

#### **1. Get online users in chat**

```http
GET /api/chat/:chatId/online-users
Authorization: Bearer {token}
```

**Response:**

```json
{
  "chatId": "673c...",
  "onlineUsers": [
    {
      "_id": "673c...",
      "fullName": "John Doe",
      "avatar": "https://...",
      "phone": "0123456789",
      "email": "john@example.com",
      "isOnline": true
    }
  ],
  "onlineCount": 1,
  "timestamp": "2025-10-27T..."
}
```

#### **2. Get user online status**

```http
GET /api/chat/users/:userId/online-status
Authorization: Bearer {token}
```

**Response:**

```json
{
  "userId": "673c...",
  "user": {
    "_id": "673c...",
    "fullName": "John Doe",
    "avatar": "https://...",
    "phone": "0123456789",
    "email": "john@example.com"
  },
  "isOnline": true,
  "lastSeen": "2025-10-27T15:30:00Z",
  "timestamp": "2025-10-27T..."
}
```

### **WebSocket Events:**

- `user_status_update` - Broadcast to all when user connect/disconnect
- `contact_status_update` - Sent to specific users in same chats

---

## 💻 Frontend Implementation

### **1. Setup Socket.IO Client**

```javascript
// socket.js
import io from "socket.io-client";

let socket;

export const initSocket = (token) => {
  socket = io("http://localhost:8081", {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("✅ Connected to WebSocket");
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from WebSocket");
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};
```

---

### **2. React Hook for Chat**

```javascript
// useChatSocket.js
import { useEffect, useState } from "react";
import { getSocket } from "./socket";

export const useChatSocket = (chatId, onNewMessage) => {
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socket = getSocket();

  useEffect(() => {
    if (!socket || !chatId) return;

    // Join chat room
    socket.emit("join_chat", chatId);

    // Listen for new messages
    socket.on("new_message", (message) => {
      onNewMessage(message);
    });

    // Listen for typing indicators
    socket.on("user_typing", (data) => {
      setTypingUsers(data.typingUsers);
    });

    socket.on("user_stopped_typing", (data) => {
      setTypingUsers(data.typingUsers);
    });

    // Listen for online status
    socket.on("contact_status_update", (data) => {
      if (data.chatId === chatId) {
        // Update online status
        updateOnlineStatus(data.userId, data.isOnline);
      }
    });

    // Cleanup
    return () => {
      socket.emit("leave_chat", chatId);
      socket.off("new_message");
      socket.off("user_typing");
      socket.off("user_stopped_typing");
      socket.off("contact_status_update");
    };
  }, [chatId, socket]);

  const sendMessage = (content, messageType = "text") => {
    socket.emit("send_message", {
      chatId,
      content,
      messageType,
    });
  };

  const startTyping = () => {
    socket.emit("typing_start", { chatId });
  };

  const stopTyping = () => {
    socket.emit("typing_stop", { chatId });
  };

  return {
    sendMessage,
    startTyping,
    stopTyping,
    typingUsers,
    onlineUsers,
  };
};
```

---

### **3. Usage Example**

```javascript
// ChatPage.jsx
import { useState, useEffect } from "react";
import { useChatSocket } from "./useChatSocket";

const ChatPage = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const { sendMessage, startTyping, stopTyping, typingUsers, onlineUsers } =
    useChatSocket(chatId, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    startTyping();
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    sendMessage(inputValue);
    setInputValue("");
    stopTyping();
  };

  return (
    <div>
      {/* Online indicator */}
      <div className="online-status">{onlineUsers.length} online</div>

      {/* Messages */}
      {messages.map((msg) => (
        <div key={msg._id}>{msg.content}</div>
      ))}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers[0].fullName} đang nhập...
        </div>
      )}

      {/* Input */}
      <input
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};
```

---

## 🧪 Testing WebSocket

### **1. Test với Browser Console:**

```javascript
// Connect
const socket = io("http://localhost:8081", {
  auth: { token: "your-jwt-token" },
});

// Join chat
socket.emit("join_chat", "chat-id");

// Send message
socket.emit("send_message", {
  chatId: "chat-id",
  content: "Test message",
  messageType: "text",
});

// Listen for messages
socket.on("new_message", (msg) => console.log("New message:", msg));
socket.on("user_typing", (data) => console.log("Typing:", data));
```

---

### **2. Test với Postman/Insomnia:**

Postman không hỗ trợ WebSocket tốt, dùng các tool sau:

- **Socket.IO Client Tool** (Chrome Extension)
- **Firecamp** (https://firecamp.io/)
- **Apidog** (https://apidog.com/)

---

## 📝 Summary

### ✅ **Đã tích hợp hoàn chỉnh:**

1. ✅ **Real-time messaging** qua WebSocket
2. ✅ **Online status tracking** với API endpoints
3. ✅ **Typing indicators** với auto-stop (3s)
4. ✅ **Chat list updates** real-time
5. ✅ **File upload notifications**
6. ✅ **Message reactions** real-time
7. ✅ **Fraud detection** với warning
8. ✅ **Offer/Appointment** notifications

### 🎯 **Cách sử dụng:**

1. **Frontend** kết nối Socket.IO với JWT token
2. **Join chat room** khi vào chat
3. **Listen events** để nhận real-time updates
4. **Emit events** để gửi tin nhắn/typing
5. **Use REST API** để lấy online status

---

**Happy Coding! 🚀**
