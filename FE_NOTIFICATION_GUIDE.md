# Hướng dẫn FE nhận và xử lý Notification

## 📋 API để FE nhận và xử lý Notification

### 1. Lấy danh sách notification

**Endpoint:** `GET /api/notification-messages`

**Headers:**

```
Authorization: Bearer {token}
```

**Query Parameters:**

- `limit` (optional, default: 20): Số lượng notification mỗi trang
- `skip` (optional, default: 0): Bỏ qua số lượng notification (cho pagination)
- `type` (optional): Lọc theo loại (`message`, `offer`, `appointment`, `listing`, `system`)
- `isRead` (optional): Lọc theo trạng thái đã đọc (`true` hoặc `false`)

**Ví dụ:**

```typescript
// Lấy tất cả notification
GET /api/notification-messages?limit=20&skip=0

// Lấy notification chưa đọc
GET /api/notification-messages?isRead=false

// Lấy notification về appointment
GET /api/notification-messages?type=appointment
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "691cba5e4194294dacb61865",
      "userId": "691cba5e4194294dacb61866",
      "type": "appointment",
      "title": "✅ Đặt cọc thành công",
      "message": "Bạn đã thanh toán đặt cọc 4,500,000 VND thành công. Vào xem lịch hẹn để thanh toán còn lại.",
      "actionUrl": "/appointments/691cba5e4194294dacb61865",
      "actionText": "Xem lịch hẹn",
      "metadata": {
        "appointmentId": "691cba5e4194294dacb61865",
        "amount": 4500000,
        "type": "deposit_success",
        "canPayRemaining": true // ⭐ Flag này để hiển thị nút "Thanh toán còn lại"
      },
      "isRead": false,
      "createdAt": "2025-11-19T12:36:10.000Z",
      "updatedAt": "2025-11-19T12:36:10.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "skip": 0,
    "hasMore": false
  },
  "unreadCount": 1
}
```

### 2. Lấy số notification chưa đọc

**Endpoint:** `GET /api/notification-messages/unread-count`

**Headers:**

```
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

**Cách sử dụng:**

- Gọi API này để hiển thị badge số notification chưa đọc trên icon notification
- Có thể gọi định kỳ (polling) hoặc sau khi nhận WebSocket event

### 3. Đánh dấu notification đã đọc

**Endpoint:** `POST /api/notification-messages/:notificationId/read`

**Headers:**

```
Authorization: Bearer {token}
```

**Ví dụ:**

```typescript
POST /api/notification-messages/691cba5e4194294dacb61865/read
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "691cba5e4194294dacb61865",
    "isRead": true,
    "readAt": "2025-11-19T13:00:00.000Z"
  },
  "message": "Đã đánh dấu thông báo là đã đọc"
}
```

**Cách sử dụng:**

- Gọi API này khi user click vào notification hoặc xem chi tiết notification

### 4. Đánh dấu tất cả notification đã đọc

**Endpoint:** `POST /api/notification-messages/mark-all-read`

**Headers:**

```
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

**Cách sử dụng:**

- Gọi API này khi user click nút "Đánh dấu tất cả đã đọc"

### 5. Xóa một notification

**Endpoint:** `DELETE /api/notification-messages/:notificationId`

**Headers:**

```
Authorization: Bearer {token}
```

**Ví dụ:**

```typescript
DELETE /api/notification-messages/691cba5e4194294dacb61865
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

### 6. Xóa tất cả notification đã đọc

**Endpoint:** `DELETE /api/notification-messages/delete-all-read`

**Headers:**

```
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

## 🔔 WebSocket Real-time Notification

Khi có notification mới, FE sẽ nhận qua WebSocket:

**Event:** `new_notification`

**Data:**

```json
{
  "_id": "...",
  "type": "appointment",
  "title": "✅ Đặt cọc thành công",
  "message": "Bạn đã thanh toán đặt cọc 4,500,000 VND thành công. Vào xem lịch hẹn để thanh toán còn lại.",
  "actionUrl": "/appointments/691cba5e4194294dacb61865",
  "actionText": "Xem lịch hẹn",
  "metadata": {
    "appointmentId": "691cba5e4194294dacb61865",
    "amount": 4500000,
    "type": "deposit_success",
    "canPayRemaining": true
  },
  "createdAt": "2025-11-19T12:36:10.000Z",
  "isRead": false
}
```

## 📱 Xử lý Notification trong FE

### Khi nhận notification đặt cọc thành công:

```typescript
// Check metadata
if (notification.metadata?.type === "deposit_success") {
  // Hiển thị notification với:
  // - Title: "✅ Đặt cọc thành công"
  // - Message: notification.message
  // - Action button: "Xem lịch hẹn" → redirect đến actionUrl
  // - Nút "Thanh toán còn lại" nếu metadata.canPayRemaining === true
}
```

### Logic hiển thị nút "Thanh toán còn lại":

```typescript
// Trong component Notification hoặc AppointmentDetail
if (notification.metadata?.canPayRemaining === true) {
  // Hiển thị nút "Thanh toán còn lại"
  // Khi click → gọi API:
  // POST /api/appointments/{appointmentId}/remaining-payment
  // → Nhận paymentUrl → Hiển thị QR code
}
```

## 🎯 Luồng xử lý

### 1. User nhận email đặt cọc thành công

↓

### 2. FE nhận notification qua WebSocket hoặc polling

↓

### 3. Hiển thị notification với:

- Title: "✅ Đặt cọc thành công"
- Message: "Bạn đã thanh toán đặt cọc X VND thành công. Vào xem lịch hẹn để thanh toán còn lại."
- Button: "Xem lịch hẹn" → redirect đến `/appointments/{appointmentId}`
  ↓

### 4. Trong trang Appointment Detail:

- Check `metadata.canPayRemaining === true`
- Hiển thị nút "Thanh toán còn lại"
  ↓

### 5. User click "Thanh toán còn lại":

- Gọi API: `POST /api/appointments/{appointmentId}/remaining-payment`
- Nhận `paymentUrl` từ response
- Hiển thị QR code từ `paymentUrl`
  ↓

### 6. User thanh toán thành công:

- Nhận notification mới: "🎉 Giao dịch hoàn thành"
- Redirect đến `/appointments/{appointmentId}`

## 📊 Các loại Notification

### 1. Đặt cọc thành công (deposit_success)

```json
{
  "type": "appointment",
  "title": "✅ Đặt cọc thành công",
  "message": "Bạn đã thanh toán đặt cọc X VND thành công. Vào xem lịch hẹn để thanh toán còn lại.",
  "actionUrl": "/appointments/{appointmentId}",
  "metadata": {
    "type": "deposit_success",
    "canPayRemaining": true // ⭐ Hiển thị nút "Thanh toán còn lại"
  }
}
```

### 2. Thanh toán toàn bộ thành công (full_payment_success)

```json
{
  "type": "appointment",
  "title": "🎉 Giao dịch hoàn thành",
  "message": "Bạn đã thanh toán đủ 100%, appointment {appointmentId} đã hoàn thành.",
  "actionUrl": "/appointments/{appointmentId}",
  "metadata": {
    "type": "full_payment_success",
    "isCompleted": true
  }
}
```

### 3. Thanh toán còn lại thành công (remaining_payment_success)

```json
{
  "type": "appointment",
  "title": "🎉 Giao dịch hoàn thành",
  "message": "Bạn đã thanh toán đủ 100% (10% đặt cọc + 90% còn lại), appointment {appointmentId} đã hoàn thành.",
  "actionUrl": "/appointments/{appointmentId}",
  "metadata": {
    "type": "remaining_payment_success",
    "isCompleted": true
  }
}
```

## 🔍 Kiểm tra Timeline

Sau khi nhận notification, FE có thể gọi API để xem timeline:

**Endpoint:** `GET /api/appointments/{appointmentId}/timeline`

**Headers:**

```
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "depositRequestAt": "2025-11-19T12:00:00Z",
    "depositPaidAt": "2025-11-19T12:36:10Z", // ✅ Đã thanh toán
    "remainingPaymentRequestAt": null, // Chưa có
    "remainingPaidAt": null,
    "fullPaymentRequestAt": null,
    "fullPaymentPaidAt": null,
    "completedAt": null
  }
}
```

**Logic hiển thị nút:**

- Nếu `depositPaidAt` có giá trị và `remainingPaidAt` = null → Hiển thị nút "Thanh toán còn lại"
- Nếu `remainingPaidAt` hoặc `fullPaymentPaidAt` có giá trị → Ẩn nút, hiển thị "Đã hoàn thành"

## 💻 Ví dụ Code FE (React/TypeScript)

### 1. Component hiển thị danh sách notification

```typescript
import { useState, useEffect } from "react";
import axios from "axios";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  actionText: string;
  metadata?: {
    appointmentId?: string;
    type?: string;
    canPayRemaining?: boolean;
  };
  isRead: boolean;
  createdAt: string;
}

const NotificationList = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Lấy danh sách notification
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/notification-messages", {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20, skip: 0 },
      });

      setNotifications(response.data.data);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Lấy số notification chưa đọc
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "/api/notification-messages/unread-count",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUnreadCount(response.data.data.unreadCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Đánh dấu đã đọc
  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `/api/notification-messages/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Cập nhật local state
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Xử lý click notification
  const handleNotificationClick = (notification: Notification) => {
    // Đánh dấu đã đọc
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Redirect đến actionUrl
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Polling để cập nhật unread count mỗi 30 giây
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Thông báo ({unreadCount} chưa đọc)</h2>

      {notifications.map((notification) => (
        <div
          key={notification._id}
          onClick={() => handleNotificationClick(notification)}
          style={{
            padding: "12px",
            border: "1px solid #ddd",
            marginBottom: "8px",
            cursor: "pointer",
            backgroundColor: notification.isRead ? "#fff" : "#f0f8ff",
          }}
        >
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>

          {/* Hiển thị nút "Thanh toán còn lại" nếu có flag */}
          {notification.metadata?.canPayRemaining && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Gọi API thanh toán còn lại
                handlePayRemaining(notification.metadata?.appointmentId);
              }}
            >
              Thanh toán còn lại
            </button>
          )}

          <span style={{ fontSize: "12px", color: "#666" }}>
            {new Date(notification.createdAt).toLocaleString("vi-VN")}
          </span>
        </div>
      ))}
    </div>
  );
};
```

### 2. Kết nối WebSocket để nhận notification real-time

```typescript
import { useEffect } from "react";
import io from "socket.io-client";

const useWebSocketNotifications = (
  onNewNotification: (notification: any) => void
) => {
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io("ws://localhost:8081", {
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("WebSocket connected");
    });

    socket.on("new_notification", (notification) => {
      console.log("New notification received:", notification);
      onNewNotification(notification);
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [onNewNotification]);
};

// Sử dụng trong component
const NotificationComponent = () => {
  const handleNewNotification = (notification: any) => {
    // Hiển thị toast/alert
    alert(`New notification: ${notification.title}`);

    // Cập nhật danh sách notification
    fetchNotifications();
  };

  useWebSocketNotifications(handleNewNotification);

  // ... rest of component
};
```

### 3. Xử lý thanh toán còn lại

```typescript
const handlePayRemaining = async (appointmentId: string) => {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `/api/appointments/${appointmentId}/remaining-payment`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Nhận paymentUrl và hiển thị QR code
    const { paymentUrl } = response.data.data;

    // Mở popup hoặc redirect đến paymentUrl
    window.open(paymentUrl, "_blank");

    // Hoặc hiển thị QR code trong modal
    // showQRCodeModal(paymentUrl);
  } catch (error) {
    console.error("Error creating remaining payment:", error);
    alert("Có lỗi xảy ra khi tạo thanh toán còn lại");
  }
};
```

### 4. Component hiển thị badge số notification chưa đọc

```typescript
const NotificationBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          "/api/notification-messages/unread-count",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setUnreadCount(response.data.data.unreadCount);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchUnreadCount();

    // Cập nhật mỗi 30 giây
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <BellIcon />
      {unreadCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-8px",
            right: "-8px",
            backgroundColor: "red",
            color: "white",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
          }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
};
```

## 📝 Tóm tắt các bước FE cần làm

1. **Hiển thị badge số notification chưa đọc:**

   - Gọi `GET /api/notification-messages/unread-count` khi component mount
   - Polling định kỳ (mỗi 30 giây) hoặc lắng nghe WebSocket event

2. **Hiển thị danh sách notification:**

   - Gọi `GET /api/notification-messages` để lấy danh sách
   - Hiển thị notification chưa đọc với style khác (highlight)

3. **Xử lý click notification:**

   - Gọi `POST /api/notification-messages/:id/read` để đánh dấu đã đọc
   - Redirect đến `actionUrl` nếu có

4. **Xử lý notification đặt cọc thành công:**

   - Check `metadata.canPayRemaining === true`
   - Hiển thị nút "Thanh toán còn lại"
   - Khi click → gọi `POST /api/appointments/:id/remaining-payment`
   - Hiển thị QR code từ `paymentUrl`

5. **Kết nối WebSocket (optional):**
   - Lắng nghe event `new_notification`
   - Cập nhật danh sách notification khi có notification mới
   - Hiển thị toast/alert cho user
