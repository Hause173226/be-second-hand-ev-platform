# 📬 Notification API Documentation

## 🎯 Tổng quan

Hệ thống notification cho phép người dùng nhận thông báo real-time khi có:

- **Tin nhắn mới** từ người dùng khác
- **Đề xuất giá** (Offer) mới
- **Lịch hẹn** (Appointment) mới
- **Thông báo hệ thống**

---

## 📡 **API Endpoints**

### **1. Lấy danh sách notification**

```http
GET /api/notifications
Authorization: Bearer {token}
```

**Query Parameters:**

- `limit` (number, optional): Số lượng mỗi trang (default: 20)
- `skip` (number, optional): Bỏ qua số lượng (default: 0)
- `type` (string, optional): Lọc theo loại (`message`, `offer`, `appointment`, `listing`, `system`)
- `isRead` (boolean, optional): Lọc theo trạng thái đã đọc

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "673c2cd97a03030095d75650",
      "userId": "673a1234567890abcdef1234",
      "type": "message",
      "title": "Tin nhắn mới từ Nguyễn Văn A",
      "message": "Xe này còn bảo hành không?",
      "isRead": false,
      "actionUrl": "/messages/673c2cd97a03030095d75650",
      "actionText": "Xem tin nhắn",
      "metadata": {
        "senderName": "Nguyễn Văn A",
        "senderAvatar": "https://...",
        "messagePreview": "Xe này còn bảo hành không?"
      },
      "createdAt": "2025-10-27T10:30:00.000Z",
      "senderId": {
        "_id": "673a1234567890abcdef5678",
        "fullName": "Nguyễn Văn A",
        "avatar": "https://..."
      }
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "skip": 0,
    "hasMore": true
  },
  "unreadCount": 12
}
```

---

### **2. Lấy số lượng notification chưa đọc**

```http
GET /api/notifications/unread-count
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "unreadCount": 12
  }
}
```

---

### **3. Đánh dấu notification đã đọc**

```http
POST /api/notifications/{notificationId}/read
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "673c2cd97a03030095d75650",
    "isRead": true,
    "readAt": "2025-10-27T10:35:00.000Z"
  },
  "message": "Đã đánh dấu thông báo là đã đọc"
}
```

---

### **4. Đánh dấu tất cả notification đã đọc**

```http
POST /api/notifications/mark-all-read
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Đã đánh dấu tất cả thông báo là đã đọc"
  }
}
```

---

### **5. Xóa notification**

```http
DELETE /api/notifications/{notificationId}
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Đã xóa thông báo"
  }
}
```

---

### **6. Xóa tất cả notification đã đọc**

```http
DELETE /api/notifications/delete-all-read
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Đã xóa tất cả thông báo đã đọc"
  }
}
```

---

## 🔔 **WebSocket Real-time Notifications**

### **Kết nối WebSocket**

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:8081", {
  auth: { token: "your-jwt-token" },
});
```

### **Lắng nghe notification mới**

```javascript
socket.on('new_notification', (notification) => {
  console.log('📬 New notification:', notification);

  // notification object:
  {
    _id: "673c2cd97a03030095d75650",
    type: "message",
    title: "Tin nhắn mới từ Nguyễn Văn A",
    message: "Xe này còn bảo hành không?",
    actionUrl: "/messages/673c2cd97a03030095d75650",
    metadata: {
      senderName: "Nguyễn Văn A",
      senderAvatar: "https://...",
      messagePreview: "Xe này còn bảo hành không?"
    },
    createdAt: "2025-10-27T10:30:00.000Z",
    isRead: false
  }

  // Display notification to user
  showNotification(notification);
});
```

---

## 🎨 **Frontend Integration Example**

### **React Hook - useNotifications**

```jsx
import { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";

export const useNotifications = (token) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Load initial notifications
    loadNotifications();
    loadUnreadCount();

    // Setup WebSocket
    const newSocket = io("http://localhost:8081", {
      auth: { token },
    });

    newSocket.on("new_notification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show browser notification
      if (Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: notification.metadata?.senderAvatar,
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const loadNotifications = async () => {
    try {
      const res = await axios.get("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await axios.get("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(res.data.data.unreadCount);
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(
        "/api/notifications/mark-all-read",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
  };
};
```

### **React Component - Notification Bell**

```jsx
import { useNotifications } from "../hooks/useNotifications";
import { useNavigate } from "react-router-dom";

const NotificationBell = ({ token }) => {
  const { notifications, unreadCount, markAsRead } = useNotifications(token);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification._id);
    navigate(notification.actionUrl);
    setIsOpen(false);
  };

  return (
    <div className="notification-bell">
      <button onClick={() => setIsOpen(!isOpen)}>
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <h3>Thông báo ({unreadCount} chưa đọc)</h3>

          {notifications.length === 0 ? (
            <p>Không có thông báo</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif._id}
                className={`notification-item ${
                  notif.isRead ? "read" : "unread"
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <img
                  src={notif.metadata?.senderAvatar || "/default-avatar.png"}
                  alt=""
                />
                <div>
                  <h4>{notif.title}</h4>
                  <p>{notif.message}</p>
                  <span>{formatTime(notif.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
```

---

## 📝 **Notification Types**

### **1. Message Notification**

```json
{
  "type": "message",
  "title": "Tin nhắn mới từ {senderName}",
  "message": "{messageContent}",
  "metadata": {
    "senderName": "Nguyễn Văn A",
    "senderAvatar": "https://...",
    "messagePreview": "Xe này còn bảo hành không?"
  },
  "actionUrl": "/messages/{chatId}"
}
```

### **2. Offer Notification**

```json
{
  "type": "offer",
  "title": "Đề xuất mới từ {senderName}",
  "message": "{senderName} đã gửi đề xuất giá {offerAmount} VNĐ",
  "metadata": {
    "senderName": "Nguyễn Văn A",
    "offerAmount": 750000000,
    "listingTitle": "Tesla Model 3 2023"
  },
  "actionUrl": "/messages/{chatId}"
}
```

### **3. Appointment Notification**

```json
{
  "type": "appointment",
  "title": "Lịch hẹn mới từ {senderName}",
  "message": "{senderName} đã đặt lịch hẹn vào {scheduledDate}",
  "metadata": {
    "senderName": "Nguyễn Văn A",
    "appointmentDate": "2025-10-30T14:00:00.000Z",
    "listingTitle": "Tesla Model 3 2023"
  },
  "actionUrl": "/appointments/{appointmentId}"
}
```

---

## ✅ **Hoàn tất!**

Hệ thống notification đã được tích hợp đầy đủ:

- ✅ REST API cho CRUD operations
- ✅ WebSocket real-time notifications
- ✅ Auto-create notification khi có tin nhắn mới
- ✅ Swagger documentation
- ✅ Database indexing để tăng performance
- ✅ Auto-delete notification sau 30 ngày (TTL index)

**Test ngay:**

1. Gửi tin nhắn trong chat
2. Người nhận sẽ nhận được notification qua WebSocket
3. Notification được lưu vào database
4. Gọi API `/api/notifications` để xem danh sách
