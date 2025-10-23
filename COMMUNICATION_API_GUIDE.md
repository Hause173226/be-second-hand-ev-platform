# Hướng dẫn API Giao tiếp & Đàm phán

Hướng dẫn này bao gồm tất cả các API cho chức năng Giao tiếp & Đàm phán (Chat & Offer).

## Mục lục
1. [API Chat](#chat-apis)
2. [API Lịch hẹn](#appointment-apis)
3. [API Đề nghị giá/Đàm phán](#offernegotiation-apis)
4. [Sự kiện WebSocket](#websocket-events)
5. [Xác thực](#authentication)

## API Chat

### 1. Lấy hoặc Tạo Chat
**GET** `/api/chat/listing/:listingId`

Lấy hoặc tạo chat giữa người mua và người bán cho một listing cụ thể.

**Headers:**
```
Authorization: Bearer <token>
```

**Phản hồi:**
```json
{
  "_id": "chat_id",
  "listingId": {
    "_id": "listing_id",
    "make": "Tesla",
    "model": "Model 3",
    "year": 2022
  },
  "buyerId": {
    "_id": "buyer_id",
    "fullName": "John Doe",
    "phone": "0123456789"
  },
  "sellerId": {
    "_id": "seller_id",
    "fullName": "Jane Smith",
    "phone": "0987654321"
  },
  "lastMessage": {
    "content": "Xin chào, chiếc xe này còn bán không?",
    "senderId": "buyer_id",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 2. Lấy Danh sách Chat của Người dùng
**GET** `/api/chat?page=1&limit=20`

Lấy tất cả chat cho người dùng đã xác thực.

**Tham số Query:**
- `page` (tùy chọn): Số trang (mặc định: 1)
- `limit` (tùy chọn): Số mục mỗi trang (mặc định: 20)

**Phản hồi:**
```json
{
  "chats": [...],
  "totalPages": 5,
  "currentPage": 1,
  "total": 100
}
```

### 3. Lấy Tin nhắn Chat
**GET** `/api/chat/:chatId/messages?page=1&limit=50`

Lấy tin nhắn cho một chat cụ thể.

**Tham số Query:**
- `page` (tùy chọn): Số trang (mặc định: 1)
- `limit` (tùy chọn): Số mục mỗi trang (mặc định: 50)

**Phản hồi:**
```json
{
  "messages": [
    {
      "_id": "message_id",
      "chatId": "chat_id",
      "senderId": {
        "_id": "user_id",
        "fullName": "John Doe"
      },
      "content": "Xin chào, chiếc xe này còn bán không?",
      "messageType": "text",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "totalPages": 2,
  "currentPage": 1,
  "total": 50
}
```

### 4. Gửi Tin nhắn
**POST** `/api/chat/:chatId/messages`

Gửi tin nhắn trong một chat.

**Nội dung Yêu cầu:**
```json
{
  "content": "Xin chào, chiếc xe này còn bán không?",
  "messageType": "text",
  "metadata": {
    "imageUrl": "https://example.com/image.jpg"
  }
}
```

**Loại Tin nhắn:**
- `text`: Tin nhắn văn bản thông thường
- `image`: Tin nhắn hình ảnh
- `file`: File đính kèm
- `offer`: Tin nhắn liên quan đến đề nghị giá
- `appointment`: Tin nhắn liên quan đến lịch hẹn

### 5. Đánh dấu Tin nhắn đã Đọc
**PUT** `/api/chat/:chatId/read`

Đánh dấu tất cả tin nhắn chưa đọc trong chat là đã đọc.

### 6. Lấy Số lượng Tin nhắn Chưa Đọc
**GET** `/api/chat/unread/count`

Lấy tổng số tin nhắn chưa đọc cho người dùng.

**Phản hồi:**
```json
{
  "unreadCount": 5
}
```

## API Lịch hẹn

### 1. Tạo Lịch hẹn
**POST** `/api/appointments`

Tạo lịch hẹn xem xe mới.

**Nội dung Yêu cầu:**
```json
{
  "listingId": "listing_id",
  "chatId": "chat_id",
  "scheduledDate": "2024-01-20T14:00:00Z",
  "location": {
    "address": "123 Main Street, District 1",
    "city": "Ho Chi Minh City",
    "district": "District 1",
    "coordinates": {
      "lat": 10.7769,
      "lng": 106.7009
    }
  },
  "notes": "Vui lòng mang theo giấy tờ xe"
}
```

### 2. Lấy Lịch hẹn của Người dùng
**GET** `/api/appointments?status=pending&page=1&limit=20`

Lấy lịch hẹn cho người dùng đã xác thực.

**Tham số Query:**
- `status` (optional): Lọc theo trạng thái (`pending`, `confirmed`, `cancelled`, `completed`)
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số mục mỗi trang (mặc định: 20)

### 3. Cập nhật Trạng thái Lịch hẹn
**PUT** `/api/appointments/:appointmentId/status`

Cập nhật trạng thái lịch hẹn.

**Nội dung Yêu cầu:**
```json
{
  "status": "confirmed",
  "notes": "Đã xác nhận lúc 2 giờ chiều"
}
```

**Giá trị Trạng thái:**
- `pending`: Chờ xác nhận
- `confirmed`: Đã xác nhận bởi cả hai bên
- `cancelled`: Đã hủy bởi một trong hai bên
- `completed`: Lịch hẹn đã hoàn thành

### 4. Lấy Lịch hẹn theo ID
**GET** `/api/appointments/:appointmentId`

Lấy chi tiết lịch hẹn cụ thể.

### 5. Xóa Lịch hẹn
**DELETE** `/api/appointments/:appointmentId`

Xóa lịch hẹn đang chờ (chỉ người mua mới có thể xóa).

## API Đề nghị giá/Đàm phán

### 1. Tạo Đề nghị giá
**POST** `/api/offers`

Tạo đề nghị giá mới.

**Nội dung Yêu cầu:**
```json
{
  "listingId": "listing_id",
  "chatId": "chat_id",
  "offeredPrice": 500000000,
  "message": "Tôi quan tâm đến chiếc xe này. Bạn có thể xem xét giá này không?",
  "expiresInDays": 7
}
```

### 2. Lấy Đề nghị giá của Người dùng
**GET** `/api/offers?type=sent&status=pending&page=1&limit=20`

Lấy đề nghị giá cho người dùng đã xác thực.

**Tham số Query:**
- `type` (optional): `sent`, `received`, or `all` (default: `all`)
- `status` (optional): Lọc theo trạng thái (`pending`, `accepted`, `rejected`, `countered`, `expired`)
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số mục mỗi trang (mặc định: 20)

### 3. Phản hồi Đề nghị giá
**PUT** `/api/offers/:offerId/respond`

Phản hồi đề nghị giá (chấp nhận, từ chối, hoặc trả giá).

**Nội dung Yêu cầu:**
```json
{
  "action": "counter",
  "counterPrice": 480000000,
  "message": "Giá này thì sao?"
}
```

**Hành động:**
- `accept`: Chấp nhận đề nghị giá
- `reject`: Từ chối đề nghị giá
- `counter`: Đưa ra đề nghị giá trả giá

### 4. Phản hồi Trả giá
**PUT** `/api/offers/:offerId/counter-respond`

Phản hồi trả giá.

**Nội dung Yêu cầu:**
```json
{
  "action": "accept"
}
```

**Hành động:**
- `accept`: Chấp nhận trả giá
- `reject`: Từ chối trả giá

### 5. Lấy Đề nghị giá theo ID
**GET** `/api/offers/:offerId`

Lấy chi tiết đề nghị giá cụ thể.

### 6. Hủy Đề nghị giá
**DELETE** `/api/offers/:offerId`

Hủy đề nghị giá đang chờ hoặc đã trả giá.

## Sự kiện WebSocket

### Sự kiện Client (Gửi đến Server)

#### Kết nối
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### Tham gia Chat
```javascript
socket.emit('join_chat', 'chat_id');
```

#### Rời khỏi Chat
```javascript
socket.emit('leave_chat', 'chat_id');
```

#### Gửi Tin nhắn
```javascript
socket.emit('send_message', {
  chatId: 'chat_id',
  content: 'Xin chào!',
  messageType: 'text',
  metadata: {}
});
```

#### Chỉ báo Đang gõ
```javascript
// Bắt đầu gõ
socket.emit('typing_start', { chatId: 'chat_id' });

// Dừng gõ
socket.emit('typing_stop', { chatId: 'chat_id' });
```

#### Thông báo Đề nghị giá
```javascript
socket.emit('offer_created', {
  chatId: 'chat_id',
  offerId: 'offer_id',
  offeredPrice: 500000000,
  message: 'Đề nghị giá của tôi'
});
```

#### Thông báo Lịch hẹn
```javascript
socket.emit('appointment_created', {
  chatId: 'chat_id',
  appointmentId: 'appointment_id',
  scheduledDate: '2024-01-20T14:00:00Z',
  location: { address: '123 Main St' }
});
```

### Sự kiện Server (Nhận từ Server)

#### Tin nhắn Mới
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data);
  // data: { chatId, content, messageType, metadata, senderId, timestamp }
});
```

#### Thông báo Tin nhắn
```javascript
socket.on('message_notification', (data) => {
  console.log('Message notification:', data);
  // data: { chatId, senderId, content }
});
```

#### Người dùng Đang gõ
```javascript
socket.on('user_typing', (data) => {
  console.log('User typing:', data);
  // data: { userId, chatId }
});
```

#### Người dùng Dừng gõ
```javascript
socket.on('user_stopped_typing', (data) => {
  console.log('User stopped typing:', data);
  // data: { userId, chatId }
});
```

#### Đề nghị giá Mới
```javascript
socket.on('new_offer', (data) => {
  console.log('New offer:', data);
  // data: { chatId, offerId, offeredPrice, message, senderId }
});
```

#### Lịch hẹn Mới
```javascript
socket.on('new_appointment', (data) => {
  console.log('New appointment:', data);
  // data: { chatId, appointmentId, scheduledDate, location, senderId }
});
```

#### Cảnh báo Gian lận
```javascript
socket.on('fraud_warning', (data) => {
  console.log('Fraud warning:', data);
  // data: { message, riskScore }
});
```

#### Lỗi
```javascript
socket.on('error', (data) => {
  console.log('Lỗi:', data);
  // data: { message }
});
```

## Xác thực

Tất cả các endpoint API đều yêu cầu xác thực bằng JWT token.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**WebSocket Xác thực:**
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## Lỗi Responses

Tất cả endpoint đều trả về phản hồi lỗi nhất quán:

```json
{
  "error": "Lỗi message description"
}
```

**Mã trạng thái HTTP thông dụng:**
- `200`: Thành công
- `201`: Đã tạo
- `400`: Yêu cầu không hợp lệ
- `401`: Không được phép
- `403`: Bị cấm
- `404`: Không tìm thấy
- `500`: Lỗi máy chủ nội bộ

## Phát hiện Gian lận

Hệ thống bao gồm phát hiện gian lận tích hợp sẵn để giám sát:
- Mẫu đề nghị giá đáng ngờ
- Tin nhắn spam
- Nội dung không phù hợp
- Yêu cầu liên hệ bên ngoài
- Tự đề nghị giá và tự lịch hẹn

Khi phát hiện gian lận, người dùng nhận được cảnh báo và hệ thống ghi lại các sự cố để xem xét.
