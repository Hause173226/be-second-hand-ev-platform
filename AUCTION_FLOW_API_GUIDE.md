# 🚗 HƯỚNG DẪN API - LUỒNG ĐẤU GIÁ XE ĐIỆN

## 📋 Tổng Quan Luồng

```
SELLER TẠO PHIÊN → USERS ĐẶT CỌC → USERS ĐẤU GIÁ → HỆ THỐNG TỰ ĐỘNG KẾT THÚC
→ WINNER TẠO LỊCH HẸN → XÁC NHẬN LỊCH → STAFF UPLOAD ẢNH → HOÀN THÀNH GIAO DỊCH
```

---

## 🔴 GIAI ĐOẠN 1: SELLER TẠO PHIÊN ĐẤU GIÁ

### 1.1 Tạo Phiên Đấu Giá

**Endpoint:** `POST /api/auctions`

**Headers:**

```json
{
  "Authorization": "Bearer <seller_token>"
}
```

**Request Body:**

```json
{
  "listingId": "673abc123def456789012345",
  "startAt": "2025-11-10T10:00:00Z",
  "endAt": "2025-11-15T18:00:00Z",
  "startingPrice": 500000000
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Tạo phiên đấu giá thành công",
  "auction": {
    "_id": "673xyz789abc123456789012",
    "listingId": "673abc123def456789012345",
    "startAt": "2025-11-10T10:00:00Z",
    "endAt": "2025-11-15T18:00:00Z",
    "startingPrice": 500000000,
    "status": "active",
    "bids": [],
    "currentHighestBid": null,
    "depositAmount": 0
  }
}
```

**Response Error (400):**

```json
{
  "success": false,
  "message": "Bạn đang có phiên đấu giá khác đang hoạt động hoặc sắp diễn ra"
}
```

**Business Rules:**

- ✅ Seller chỉ được tạo 1 phiên đấu giá active tại 1 thời điểm
- ✅ `endAt` phải sau `startAt`
- ✅ Chỉ owner của listing mới được tạo auction

---

## 🟡 GIAI ĐOẠN 2: USERS ĐĂNG KÝ THAM GIA (ĐẶT CỌC)

### 2.1 Lấy Thông Tin Phí Cọc

**Endpoint:** `GET /api/auctions/deposit/fee`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "participationFee": 1000000,
  "message": "Phí tham gia đấu giá cố định: 1,000,000 VNĐ"
}
```

**Note:** Phí cố định **1,000,000 VNĐ** cho tất cả phiên đấu giá.

---

### 2.2 Đặt Cọc Tham Gia Đấu Giá

**Endpoint:** `POST /api/auctions/:auctionId/deposit`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Response Success - Đủ Tiền (200):**

```json
{
  "success": true,
  "message": "Đặt cọc thành công",
  "deposit": {
    "_id": "673deposit123456789abc",
    "auctionId": "673xyz789abc123456789012",
    "userId": "673user123456789abcdef",
    "depositAmount": 1000000,
    "status": "FROZEN",
    "createdAt": "2025-11-09T10:30:00Z"
  }
}
```

**Response Success - Thiếu Tiền (200):**

```json
{
  "success": true,
  "vnpayUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "requiredAmount": 1000000,
  "currentBalance": 500000,
  "message": "Số dư không đủ. Vui lòng nạp thêm 500,000 VNĐ"
}
```

**Response Error - Seller Tự Đấu Giá (403):**

```json
{
  "success": false,
  "message": "Bạn không thể đặt cọc cho sản phẩm của chính mình"
}
```

**Response Error - Đã Đặt Cọc (400):**

```json
{
  "success": false,
  "message": "Bạn đã đặt cọc cho phiên đấu giá này"
}
```

**Business Rules:**

- ❌ Seller **KHÔNG ĐƯỢC** đặt cọc cho sản phẩm của mình
- ✅ Freeze 1 triệu VNĐ trong wallet
- ✅ Nếu thiếu tiền → trả về VNPay URL để nạp tiền
- ✅ Mỗi user chỉ đặt cọc 1 lần/auction

---

### 2.3 Kiểm Tra Trạng Thái Đặt Cọc

**Endpoint:** `GET /api/auctions/:auctionId/deposit/status`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "hasDeposit": true,
  "deposit": {
    "_id": "673deposit123456789abc",
    "status": "FROZEN",
    "depositAmount": 1000000,
    "createdAt": "2025-11-09T10:30:00Z"
  }
}
```

---

### 2.4 Hủy Đặt Cọc (Trước Khi Đấu Giá)

**Endpoint:** `DELETE /api/auctions/:auctionId/deposit`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Hủy đặt cọc thành công. Tiền đã được hoàn lại."
}
```

**Business Rules:**

- ✅ Chỉ hủy được khi auction chưa bắt đầu
- ✅ Hoàn lại 1 triệu VNĐ vào wallet

---

## 🟢 GIAI ĐOẠN 3: USERS ĐẤU GIÁ

### 3.1 Xem Danh Sách Phiên Đấu Giá

#### 3.1.1 Phiên Đang Diễn Ra

**Endpoint:** `GET /api/auctions/ongoing`

**Query Parameters:**

```
?page=1&limit=10
```

**Response Success (200):**

```json
{
  "success": true,
  "auctions": [
    {
      "_id": "673xyz789abc123456789012",
      "listingId": {
        "_id": "673abc123def456789012345",
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023,
        "images": ["url1", "url2"]
      },
      "startAt": "2025-11-10T10:00:00Z",
      "endAt": "2025-11-15T18:00:00Z",
      "startingPrice": 500000000,
      "currentHighestBid": 520000000,
      "totalBids": 15,
      "status": "active"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

#### 3.1.2 Phiên Sắp Diễn Ra

**Endpoint:** `GET /api/auctions/upcoming`

#### 3.1.3 Phiên Đã Kết Thúc

**Endpoint:** `GET /api/auctions/ended`

---

### 3.2 Xem Chi Tiết Phiên Đấu Giá

**Endpoint:** `GET /api/auctions/:auctionId`

**Response Success (200):**

```json
{
  "_id": "673xyz789abc123456789012",
  "listingId": {
    "_id": "673abc123def456789012345",
    "make": "Tesla",
    "model": "Model 3",
    "year": 2023,
    "batteryCapacity": 75,
    "range": 500,
    "priceListed": 750000000,
    "images": ["url1", "url2"],
    "sellerId": "673seller123456"
  },
  "startAt": "2025-11-10T10:00:00Z",
  "endAt": "2025-11-15T18:00:00Z",
  "startingPrice": 500000000,
  "currentHighestBid": 520000000,
  "status": "active",
  "bids": [
    {
      "userId": {
        "_id": "673user1",
        "fullName": "Nguyễn Văn A",
        "avatar": "https://cloudinary.com/avatar1.jpg"
      },
      "price": 510000000,
      "createdAt": "2025-11-10T11:00:00Z"
    },
    {
      "userId": {
        "_id": "673user2",
        "fullName": "Trần Thị B",
        "avatar": "https://cloudinary.com/avatar2.jpg"
      },
      "price": 520000000,
      "createdAt": "2025-11-10T12:00:00Z"
    }
  ],
  "participants": [
    {
      "userId": "673user1",
      "fullName": "Nguyễn Văn A",
      "avatar": "https://cloudinary.com/avatar1.jpg",
      "depositStatus": "FROZEN",
      "depositedAt": "2025-11-10T09:00:00Z"
    },
    {
      "userId": "673user2",
      "fullName": "Trần Thị B",
      "avatar": "https://cloudinary.com/avatar2.jpg",
      "depositStatus": "FROZEN",
      "depositedAt": "2025-11-10T09:30:00Z"
    },
    {
      "userId": "673user3",
      "fullName": "Lê Văn C",
      "avatar": "https://cloudinary.com/avatar3.jpg",
      "depositStatus": "FROZEN",
      "depositedAt": "2025-11-10T10:00:00Z"
    }
  ],
  "seller": {
    "userId": "673seller123456",
    "fullName": "Phạm Minh D",
    "email": "phaminhd@gmail.com",
    "phone": "0987654321",
    "avatar": "https://cloudinary.com/seller-avatar.jpg"
  },
  "totalParticipants": 3,
  "winnerId": null,
  "winningBid": null
}
```

**Mô tả các fields mới:**

- **`participants`**: Danh sách tất cả người đã đặt cọc và đang tham gia đấu giá

  - `userId`: ID người tham gia
  - `fullName`: Tên đầy đủ
  - `avatar`: Ảnh đại diện
  - `depositStatus`: Trạng thái tiền cọc (`FROZEN`, `DEDUCTED`)
  - `depositedAt`: Thời gian đặt cọc

- **`seller`**: Thông tin người tổ chức đấu giá (chủ xe)

  - `userId`: ID seller
  - `fullName`: Tên đầy đủ
  - `email`: Email
  - `phone`: Số điện thoại
  - `avatar`: Ảnh đại diện

- **`totalParticipants`**: Tổng số người đang tham gia (đã đặt cọc)

**Note:**

- Danh sách `participants` chỉ bao gồm người có deposit status = `FROZEN` hoặc `DEDUCTED` (người đã hủy cọc sẽ không xuất hiện)
- `bids` array đã được populate với thông tin user (fullName, avatar)

````

---

### 3.3 Đấu Giá (Đặt Giá)

**Endpoint:** `POST /api/auctions/:auctionId/bid`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
````

**Request Body:**

```json
{
  "price": 530000000
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Đấu giá thành công",
  "bid": {
    "userId": "673user123456789abcdef",
    "price": 530000000,
    "timestamp": "2025-11-10T13:00:00Z"
  },
  "auction": {
    "_id": "673xyz789abc123456789012",
    "currentHighestBid": 530000000,
    "totalBids": 16
  }
}
```

**Response Error - Giá Thấp (400):**

```json
{
  "success": false,
  "message": "Giá đấu phải cao hơn giá hiện tại: 520,000,000 VNĐ"
}
```

**Response Error - Chưa Đặt Cọc (400):**

```json
{
  "success": false,
  "message": "Bạn phải đặt cọc trước khi đấu giá"
}
```

**Response Error - Seller Tự Đấu Giá (403):**

```json
{
  "success": false,
  "message": "Bạn không thể đấu giá sản phẩm của chính mình"
}
```

**Business Rules:**

- ✅ Giá đấu **PHẢI CAO HƠN** `currentHighestBid`
- ✅ Phải đã đặt cọc 1 triệu VNĐ
- ❌ Seller **KHÔNG ĐƯỢC** đấu giá sản phẩm của mình
- ✅ Auction phải đang `active`

---

## ⚫ GIAI ĐOẠN 4: HỆ THỐNG TỰ ĐỘNG KẾT THÚC

### 4.1 Auto Close Auction (Backend Tự Động)

**Khi `endAt` đến, hệ thống tự động thực hiện:**

1. **Xác định Winner:**

   - Người đấu giá cao nhất = Winner
   - `auction.winnerId` = winner's userId
   - `auction.winningBid` = highest bid
   - `auction.status` = `'ended'`

2. **Hoàn Tiền Cọc Cho Người Thua:**

   - Tất cả users (trừ winner) nhận lại 1 triệu VNĐ
   - `AuctionDeposit.status` = `'REFUNDED'`
   - Unfreeze tiền trong wallet

3. **Giữ Tiền Cọc Winner:**

   - Winner's deposit status = `'DEDUCTED'`
   - Tiền vẫn frozen (sẽ trừ vào giá cuối)

4. **Tạo DepositRequest Ảo:**

   - Tự động tạo `DepositRequest` với:
     - `buyerId` = winner
     - `sellerId` = listing owner
     - `depositAmount` = 1,000,000
     - `status` = `'IN_ESCROW'` (đã có tiền cọc)
   - Tạo `EscrowAccount` tương ứng

5. **Gửi WebSocket Notification:**
   ```json
   {
     "event": "auction_closed",
     "data": {
       "auctionId": "673xyz789abc123456789012",
       "winner": "673user123456789abcdef",
       "winningBid": {
         "userId": "673user123456789abcdef",
         "price": 530000000,
         "timestamp": "2025-11-10T13:00:00Z"
       }
     }
   }
   ```

**WebSocket Channel:** `auction_${auctionId}`

---

## 🔵 GIAI ĐOẠN 5: WINNER TẠO LỊCH HẸN

### 5.0 Lấy Danh Sách Phiên Đã Thắng, Chưa Tạo Lịch Hẹn

**Endpoint:** `GET /api/auctions/won/pending-appointment`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Query Parameters:**

```
?page=1&limit=10
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Lấy danh sách phiên đấu giá đã thắng thành công",
  "data": [
    {
      "_id": "673xyz789abc123456789012",
      "listingId": {
        "_id": "673abc123def456789012345",
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023,
        "priceListed": 750000000,
        "photos": ["url1", "url2"],
        "batteryCapacity": 75,
        "range": 500,
        "sellerId": "673seller123456"
      },
      "startAt": "2025-11-10T10:00:00Z",
      "endAt": "2025-11-15T18:00:00Z",
      "startingPrice": 500000000,
      "status": "ended",
      "winnerId": "673user123456789abcdef",
      "winningBid": {
        "userId": "673user123456789abcdef",
        "price": 530000000,
        "createdAt": "2025-11-15T17:45:00Z"
      },
      "bids": [...],
      "hasAppointment": false,
      "appointment": null
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 1,
    "total": 1
  }
}
```

**Response Error (401):**

```json
{
  "success": false,
  "message": "Chưa đăng nhập"
}
```

**Mô tả:**

- API này trả về **TẤT CẢ phiên đấu giá** mà user đã thắng (`winnerId = userId`) và **CHƯA có lịch hẹn** (`hasAppointment = false`)
- Dùng để hiển thị danh sách phiên cần tạo appointment trong giao diện user
- Filter tự động loại bỏ những phiên đã có appointment

**Use Case:**

```
Frontend: "Bạn có 3 phiên đấu giá thắng cuộc chưa tạo lịch hẹn!"
→ User click vào → Tạo lịch hẹn
```

---

### 5.1 Tạo Lịch Hẹn Từ Phiên Đấu Giá

**Endpoint:** `POST /api/appointments/auction/:auctionId`

**Headers:**

```json
{
  "Authorization": "Bearer <winner_token>"
}
```

**Request Body:**

```json
{
  "scheduledDate": "2025-11-20T14:00:00Z",
  "location": "123 Nguyễn Huệ, Quận 1, TP.HCM",
  "notes": "Mang theo CMND và bằng lái xe"
}
```

**Note:** Tất cả fields đều optional. Mặc định:

- `scheduledDate`: +7 ngày từ khi tạo
- `location`: "Văn phòng công ty"
- `notes`: "Ký kết hợp đồng mua bán xe - Đấu giá thành công với giá XXX VNĐ"

**Response Success (200):**

```json
{
  "success": true,
  "message": "Đã tạo lịch hẹn ký hợp đồng từ phiên đấu giá",
  "appointment": {
    "_id": "673appt123456789abc",
    "auctionId": "673xyz789abc123456789012",
    "appointmentType": "AUCTION",
    "buyerId": {
      "_id": "673user123456789abcdef",
      "fullName": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "phone": "0901234567"
    },
    "sellerId": {
      "_id": "673seller123456",
      "fullName": "Trần Thị B",
      "email": "tranthib@gmail.com",
      "phone": "0912345678"
    },
    "scheduledDate": "2025-11-20T14:00:00Z",
    "location": "123 Nguyễn Huệ, Quận 1, TP.HCM",
    "status": "PENDING",
    "type": "CONTRACT_SIGNING",
    "notes": "Ký kết hợp đồng mua bán xe - Đấu giá thành công với giá 530,000,000 VNĐ",
    "buyerConfirmed": false,
    "sellerConfirmed": false,
    "rescheduledCount": 0,
    "maxReschedules": 3
  }
}
```

**Response Error - Không Phải Winner (403):**

```json
{
  "success": false,
  "message": "Chỉ người thắng cuộc mới được tạo lịch hẹn"
}
```

**Response Error - Auction Chưa Kết Thúc (400):**

```json
{
  "success": false,
  "message": "Phiên đấu giá chưa kết thúc"
}
```

**Response Error - Đã Có Lịch Hẹn (400):**

```json
{
  "success": false,
  "message": "Đã có lịch hẹn cho phiên đấu giá này"
}
```

**Business Rules:**

- ✅ Chỉ winner mới được tạo
- ✅ Auction phải đã kết thúc (`status = 'ended'`)
- ✅ **KHÔNG CẦN ĐẶT CỌC LẠI** (dùng 1 triệu từ đấu giá)
- ✅ Chỉ tạo được 1 lần

---

## 🟣 GIAI ĐOẠN 6: XÁC NHẬN LỊCH HẸN

### 6.1 Xác Nhận Lịch Hẹn (Buyer/Seller)

**Endpoint:** `POST /api/appointments/:appointmentId/confirm`

**Headers:**

```json
{
  "Authorization": "Bearer <buyer_or_seller_token>"
}
```

**Response Success - Chưa Đủ 2 Bên (200):**

```json
{
  "success": true,
  "message": "Xác nhận lịch hẹn thành công - Đang chờ bên còn lại",
  "appointment": {
    "_id": "673appt123456789abc",
    "status": "PENDING",
    "buyerConfirmed": true,
    "sellerConfirmed": false,
    "buyerConfirmedAt": "2025-11-16T10:00:00Z"
  }
}
```

**Response Success - Đủ 2 Bên (200):**

```json
{
  "success": true,
  "message": "Xác nhận lịch hẹn thành công - Cả hai bên đã xác nhận",
  "appointment": {
    "_id": "673appt123456789abc",
    "status": "CONFIRMED",
    "buyerConfirmed": true,
    "sellerConfirmed": true,
    "buyerConfirmedAt": "2025-11-16T10:00:00Z",
    "sellerConfirmedAt": "2025-11-16T11:00:00Z",
    "confirmedAt": "2025-11-16T11:00:00Z"
  }
}
```

**Business Rules:**

- ✅ Cả buyer và seller đều phải confirm
- ✅ Khi cả 2 confirm → status = `'CONFIRMED'`

---

### 6.2 Từ Chối Lịch Hẹn (Tự Động Dời 1 Tuần)

**Endpoint:** `POST /api/appointments/:appointmentId/reject`

**Headers:**

```json
{
  "Authorization": "Bearer <buyer_or_seller_token>"
}
```

**Request Body:**

```json
{
  "reason": "Không phù hợp thời gian"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Đã từ chối lịch hẹn. Hệ thống đã tự động dời lịch 1 tuần và gửi thông báo cho cả hai bên.",
  "appointment": {
    "_id": "673appt123456789abc",
    "scheduledDate": "2025-11-27T14:00:00Z",
    "status": "RESCHEDULED",
    "rescheduledCount": 1,
    "buyerConfirmed": false,
    "sellerConfirmed": false
  }
}
```

**Business Rules:**

- ✅ Tự động dời lịch +7 ngày
- ✅ Reset confirmation của cả 2 bên
- ✅ Tối đa dời 3 lần (`maxReschedules = 3`)

---

### 6.3 Hủy Lịch Hẹn (Hoàn Tiền)

**Endpoint:** `PUT /api/appointments/:appointmentId/cancel`

**Headers:**

```json
{
  "Authorization": "Bearer <buyer_or_seller_token>"
}
```

**Request Body:**

```json
{
  "reason": "Đã mua xe khác"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Hủy lịch hẹn thành công",
  "appointment": {
    "_id": "673appt123456789abc",
    "status": "CANCELLED",
    "cancelledAt": "2025-11-16T12:00:00Z"
  }
}
```

**Business Rules:**

- ✅ Hoàn lại tiền cọc 1 triệu cho buyer
- ✅ Hoàn lại tiền trong escrow (nếu có)

---

## 🟠 GIAI ĐOẠN 7: STAFF UPLOAD ẢNH HỢP ĐỒNG

### 7.1 Upload Ảnh Hợp Đồng Đã Ký

**Endpoint:** `POST /api/contracts/:appointmentId/upload-photos`

**Headers:**

```json
{
  "Authorization": "Bearer <staff_token>",
  "Content-Type": "multipart/form-data"
}
```

**Request Body (Form Data):**

```
photos: [file1.jpg, file2.jpg, file3.jpg]
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Upload ảnh hợp đồng thành công",
  "contract": {
    "_id": "673contract123456",
    "appointmentId": "673appt123456789abc",
    "photos": [
      "https://cloudinary.com/contract1.jpg",
      "https://cloudinary.com/contract2.jpg",
      "https://cloudinary.com/contract3.jpg"
    ],
    "uploadedAt": "2025-11-20T14:30:00Z"
  }
}
```

**Business Rules:**

- ✅ Chỉ staff/admin mới upload được
- ✅ Tối đa 10 ảnh
- ✅ Appointment phải ở status `CONFIRMED`

---

### 7.2 Xem Thông Tin Hợp Đồng

**Endpoint:** `GET /api/contracts/:appointmentId`

**Headers:**

```json
{
  "Authorization": "Bearer <user_token>"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "contract": {
    "_id": "673contract123456",
    "appointmentId": "673appt123456789abc",
    "buyerId": {
      "fullName": "Nguyễn Văn A",
      "phone": "0901234567"
    },
    "sellerId": {
      "fullName": "Trần Thị B",
      "phone": "0912345678"
    },
    "listingId": {
      "make": "Tesla",
      "model": "Model 3",
      "year": 2023
    },
    "finalPrice": 530000000,
    "depositAmount": 1000000,
    "photos": ["url1", "url2", "url3"],
    "status": "PENDING_COMPLETION"
  }
}
```

---

## ⚪ GIAI ĐOẠN 8: HOÀN THÀNH GIAO DỊCH

### 8.1 Staff Hoàn Thành Giao Dịch

**Endpoint:** `POST /api/contracts/:appointmentId/complete`

**Headers:**

```json
{
  "Authorization": "Bearer <staff_token>"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Giao dịch hoàn thành",
  "transaction": {
    "appointmentId": "673appt123456789abc",
    "auctionId": "673xyz789abc123456789012",
    "finalPrice": 530000000,
    "depositDeducted": 1000000,
    "platformFee": 10600000,
    "sellerReceived": 518400000,
    "listingStatus": "SOLD",
    "completedAt": "2025-11-20T15:00:00Z"
  }
}
```

**Hệ Thống Thực Hiện:**

1. **Tính toán tiền:**

   ```
   Giá thắng đấu giá:  530,000,000 VNĐ
   - Tiền cọc đã trừ:    1,000,000 VNĐ
   - Platform fee (2%):  10,600,000 VNĐ
   = Seller nhận:       518,400,000 VNĐ
   ```

2. **Chuyển tiền:**

   - Escrow → Wallet seller: 518,400,000 VNĐ
   - Escrow → System wallet: 10,600,000 VNĐ (fee)

3. **Cập nhật status:**

   - `Listing.status` = `'SOLD'`
   - `Appointment.status` = `'COMPLETED'`
   - `DepositRequest.status` = `'COMPLETED'`
   - `EscrowAccount.status` = `'RELEASED'`

4. **Unfreeze tiền cọc winner:**
   - Trừ 1 triệu từ wallet frozen amount
   - `AuctionDeposit.status` = `'DEDUCTED'`

**Business Rules:**

- ✅ Chỉ staff/admin mới thực hiện được
- ✅ Phải có ảnh hợp đồng
- ✅ Appointment phải `CONFIRMED`

---

## 📊 SUMMARY - TẤT CẢ API CẦN DÙNG

### 🔴 SELLER APIs

| #   | Endpoint        | Method | Mô Tả             |
| --- | --------------- | ------ | ----------------- |
| 1   | `/api/auctions` | POST   | Tạo phiên đấu giá |

### 🟡 USER/BUYER APIs

| #   | Endpoint                                  | Method | Mô Tả              |
| --- | ----------------------------------------- | ------ | ------------------ |
| 2   | `/api/auctions/deposit/fee`               | GET    | Lấy phí cọc        |
| 3   | `/api/auctions/:auctionId/deposit`        | POST   | Đặt cọc tham gia   |
| 4   | `/api/auctions/:auctionId/deposit/status` | GET    | Kiểm tra đã cọc    |
| 5   | `/api/auctions/:auctionId/deposit`        | DELETE | Hủy đặt cọc        |
| 6   | `/api/auctions/ongoing`                   | GET    | Phiên đang diễn ra |
| 7   | `/api/auctions/upcoming`                  | GET    | Phiên sắp diễn ra  |
| 8   | `/api/auctions/ended`                     | GET    | Phiên đã kết thúc  |
| 9   | `/api/auctions/:auctionId`                | GET    | Chi tiết phiên     |
| 10  | `/api/auctions/:auctionId/bid`            | POST   | Đấu giá            |

### 🔵 WINNER APIs

| #   | Endpoint                                | Method | Mô Tả                         |
| --- | --------------------------------------- | ------ | ----------------------------- |
| 11  | `/api/auctions/won/pending-appointment` | GET    | DS phiên thắng, chưa tạo lịch |
| 12  | `/api/appointments/auction/:auctionId`  | POST   | Tạo lịch hẹn từ phiên đấu giá |

### 🟣 BUYER & SELLER APIs

| #   | Endpoint                                   | Method | Mô Tả         |
| --- | ------------------------------------------ | ------ | ------------- |
| 13  | `/api/appointments/:appointmentId/confirm` | POST   | Xác nhận lịch |
| 14  | `/api/appointments/:appointmentId/reject`  | POST   | Từ chối lịch  |
| 15  | `/api/appointments/:appointmentId/cancel`  | PUT    | Hủy lịch hẹn  |
| 16  | `/api/appointments/user`                   | GET    | DS lịch hẹn   |
| 17  | `/api/appointments/:appointmentId`         | GET    | Chi tiết lịch |
| 18  | `/api/contracts/:appointmentId`            | GET    | Xem hợp đồng  |

### 🟠 STAFF/ADMIN APIs

| #   | Endpoint                                      | Method | Mô Tả               |
| --- | --------------------------------------------- | ------ | ------------------- |
| 19  | `/api/contracts/:appointmentId/upload-photos` | POST   | Upload ảnh HĐ       |
| 20  | `/api/contracts/:appointmentId/complete`      | POST   | Hoàn thành GD       |
| 21  | `/api/appointments/staff`                     | GET    | DS lịch hẹn (staff) |

---

## 🎯 BUSINESS RULES QUAN TRỌNG

### ❌ CẤM

1. **Seller KHÔNG ĐƯỢC:**

   - Đặt cọc cho sản phẩm của mình
   - Đấu giá sản phẩm của mình
   - Tạo 2+ phiên đấu giá cùng lúc

2. **User KHÔNG ĐƯỢC:**
   - Đấu giá khi chưa đặt cọc
   - Đặt giá ≤ giá cao nhất hiện tại
   - Đặt cọc 2 lần cho 1 phiên

### ✅ BẮT BUỘC

1. **Tiền cọc:** Fixed **1,000,000 VNĐ** cho tất cả
2. **Giá đấu:** Phải > `currentHighestBid`
3. **Winner:** Chỉ winner mới tạo được lịch hẹn
4. **Confirmation:** Cả buyer và seller đều phải confirm

### 💰 TIỀN BẠC

1. **Người thua:** Hoàn lại 100% (1 triệu)
2. **Winner:** Trừ 1 triệu từ giá cuối
3. **Platform fee:** 2% trên `winningBid.price`
4. **Seller nhận:** `winningBid.price - depositAmount - platformFee`

---

## 🔔 WEBSOCKET EVENTS

### Subscription

```javascript
socket.join(`auction_${auctionId}`);
```

### Events

```javascript
// Khi có bid mới
socket.on("new_bid", {
  auctionId,
  bid: { userId, price, timestamp },
  currentHighestBid,
});

// Khi auction kết thúc
socket.on("auction_closed", {
  auctionId,
  winner,
  winningBid,
});
```

---

## 🆘 ERROR CODES

| Code | Message                                             | Giải Pháp                 |
| ---- | --------------------------------------------------- | ------------------------- |
| 400  | "Giá đấu phải cao hơn..."                           | Tăng giá đấu              |
| 400  | "Bạn phải đặt cọc trước..."                         | Gọi API đặt cọc           |
| 400  | "Đã có lịch hẹn..."                                 | Kiểm tra lịch hiện tại    |
| 403  | "Bạn không thể đặt cọc cho sản phẩm của chính mình" | Seller không được đấu giá |
| 403  | "Chỉ người thắng cuộc..."                           | User không phải winner    |
| 404  | "Không tìm thấy..."                                 | Kiểm tra ID               |

---

## 📝 NOTES

1. **Tự động tạo DepositRequest:** Khi auction kết thúc, hệ thống tự động tạo DepositRequest ảo cho winner → Winner không cần đặt cọc lại
2. **Tương thích:** Appointment từ auction hoạt động giống hệt appointment thường từ giai đoạn 6 trở đi
3. **VNPay:** Nếu thiếu tiền khi đặt cọc, frontend cần redirect user đến `vnpayUrl` để nạp tiền
4. **WebSocket:** Frontend nên subscribe vào channel auction để nhận update realtime

---

**Tài liệu được tạo:** 2025-11-09  
**Phiên bản API:** v1.0  
**Branch:** auctionService
