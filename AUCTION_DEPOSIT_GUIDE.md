# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG ĐẶT CỌC ĐẤU GIÁ

## 📋 MÔ TẢ HỆ THỐNG

Hệ thống đặt cọc đấu giá cho phép:

- **Seller** tạo phiên đấu giá với yêu cầu tiền cọc
- **Bidder** phải đặt cọc trước khi tham gia đấu giá
- Tự động **hoàn tiền cọc** cho người không thắng khi đấu giá kết thúc
- **Chiết khấu tiền cọc** của người thắng vào giá bán xe

---

## 🔄 QUY TRÌNH SỬ DỤNG

### 1️⃣ SELLER TẠO PHIÊN ĐẤU GIÁ (có yêu cầu cọc)

**Endpoint:** `POST /api/auctions`

```json
{
  "listingId": "673d8f9e5c9f4e0012345678",
  "startAt": "2025-11-10T10:00:00.000Z",
  "endAt": "2025-11-15T18:00:00.000Z",
  "startingPrice": 500000000,
  "depositAmount": 50000000
}
```

**Response:**

```json
{
  "_id": "auction123",
  "listingId": "673d8f9e5c9f4e0012345678",
  "startAt": "2025-11-10T10:00:00.000Z",
  "endAt": "2025-11-15T18:00:00.000Z",
  "startingPrice": 500000000,
  "depositAmount": 50000000,
  "status": "active",
  "bids": []
}
```

---

### 2️⃣ BIDDER ĐẶT CỌC ĐỂ THAM GIA ĐẤU GIÁ

**Endpoint:** `POST /api/auctions/:auctionId/deposit`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (Đủ tiền):**

```json
{
  "success": true,
  "message": "Đặt cọc thành công",
  "data": {
    "depositId": "deposit123",
    "auctionId": "auction123",
    "depositAmount": 50000000,
    "status": "FROZEN",
    "frozenAt": "2025-11-05T10:30:00.000Z"
  }
}
```

**Response (Không đủ tiền - trả về link VNPay):**

```json
{
  "success": false,
  "message": "Số dư không đủ để đặt cọc",
  "vnpayUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "requiredAmount": 50000000,
  "currentBalance": 30000000
}
```

**Luồng xử lý:**

1. Kiểm tra số dư ví
2. Nếu **đủ tiền**: Freeze tiền từ ví → Tạo record `AuctionDeposit`
3. Nếu **không đủ**: Trả về link VNPay để nạp tiền

---

### 3️⃣ KIỂM TRA TRẠNG THÁI ĐẶT CỌC

**Endpoint:** `GET /api/auctions/:auctionId/deposit/status`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hasDeposited": true,
    "deposit": {
      "_id": "deposit123",
      "auctionId": "auction123",
      "userId": "user123",
      "depositAmount": 50000000,
      "status": "FROZEN",
      "frozenAt": "2025-11-05T10:30:00.000Z"
    }
  }
}
```

---

### 4️⃣ BIDDER ĐẶT GIÁ

**Endpoint:** `POST /api/auctions/:auctionId/bid`

```json
{
  "price": 520000000
}
```

**Kiểm tra:**

- ✅ User đã đặt cọc chưa? (Nếu `depositAmount > 0`)
- ✅ Giá đặt có cao hơn giá hiện tại?
- ✅ Thời gian còn trong khoảng `startAt` - `endAt`?

**Response:**

```json
{
  "message": "Bid thành công",
  "auction": {
    "_id": "auction123",
    "bids": [
      {
        "userId": "user123",
        "price": 520000000,
        "createdAt": "2025-11-05T11:00:00.000Z"
      }
    ]
  }
}
```

**Response (Nếu chưa đặt cọc):**

```json
{
  "message": "Bạn cần đặt cọc 50,000,000 VNĐ để tham gia đấu giá"
}
```

---

### 5️⃣ HỦY ĐẶT CỌC (Trước khi đấu giá bắt đầu)

**Endpoint:** `DELETE /api/auctions/:auctionId/deposit`

**Điều kiện:** Chỉ được hủy **TRƯỚC** khi `startAt`

**Response:**

```json
{
  "success": true,
  "message": "Hủy cọc thành công, tiền đã hoàn về ví",
  "data": {
    "depositId": "deposit123",
    "refundedAmount": 50000000,
    "status": "CANCELLED"
  }
}
```

---

### 6️⃣ KẾT THÚC ĐẤU GIÁ (Tự động hoặc Thủ công)

#### A. Tự động khi hết hạn (`endAt`)

Hệ thống tự động:

1. Xác định người thắng (bid cao nhất)
2. **Hoàn tiền cọc** cho tất cả người không thắng
3. Gửi thông báo qua WebSocket

```javascript
// Trong autoCloseAuction()
await auctionDepositService.refundNonWinners(
  auctionId,
  auction.winnerId?.toString()
);
```

#### B. Thủ công bởi Seller

**Endpoint:** `POST /api/auctions/:auctionId/end`

**Response:**

```json
{
  "message": "Đã đóng phiên đấu giá"
}
```

---

### 7️⃣ CHIẾT KHẤU TIỀN CỌC CHO NGƯỜI THẮNG

**Endpoint:** `POST /api/auctions/:auctionId/deposit/deduct`

**Body:**

```json
{
  "winnerId": "user123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Đã chiết khấu tiền cọc của người thắng",
  "data": {
    "depositId": "deposit123",
    "deductedAmount": 50000000,
    "status": "DEDUCTED",
    "deductedAt": "2025-11-05T15:00:00.000Z"
  }
}
```

**Luồng xử lý:**

1. Giảm `frozenAmount` trong ví người thắng
2. Cập nhật `AuctionDeposit.status` → `DEDUCTED`
3. Khi tạo Order/Payment, giá cuối = `winningBid.price - depositAmount`

---

### 8️⃣ LẤY DANH SÁCH NGƯỜI ĐÃ ĐẶT CỌC

**Endpoint:** `GET /api/auctions/:auctionId/deposits`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "deposit123",
      "auctionId": "auction123",
      "userId": {
        "_id": "user123",
        "fullName": "Nguyễn Văn A",
        "email": "user@example.com",
        "avatar": "https://..."
      },
      "depositAmount": 50000000,
      "status": "FROZEN",
      "frozenAt": "2025-11-05T10:30:00.000Z"
    }
  ],
  "total": 5
}
```

---

## 📊 TRẠNG THÁI DEPOSIT

| Status      | Mô tả                                          |
| ----------- | ---------------------------------------------- |
| `FROZEN`    | Tiền đang bị đóng băng (người dùng đã đặt cọc) |
| `REFUNDED`  | Tiền đã được hoàn lại (người không thắng)      |
| `DEDUCTED`  | Tiền đã chiết khấu vào giá bán (người thắng)   |
| `CANCELLED` | Người dùng hủy cọc trước khi đấu giá bắt đầu   |

---

## 🔐 LUỒNG TIỀN

### Khi đặt cọc:

```
Wallet.balance (100M) → Freeze 50M
→ Wallet.balance = 50M
→ Wallet.frozenAmount = 50M
```

### Khi hoàn cọc (Không thắng):

```
Wallet.frozenAmount (50M) → Unfreeze 50M
→ Wallet.balance = 100M
→ Wallet.frozenAmount = 0
```

### Khi chiết khấu (Thắng cuộc):

```
Wallet.frozenAmount (50M) → Deduct 50M
→ Wallet.frozenAmount = 0
→ Giá cuối = winningBid.price - 50M
```

---

## 🧪 VÍ DỤ TÍCH HỢP VÀO ORDER

Khi người thắng thanh toán xe:

```javascript
// Trong orderController hoặc paymentController
const auction = await Auction.findById(auctionId);
const deposit = await auctionDepositService.getUserDeposit(auctionId, winnerId);

let finalPrice = auction.winningBid.price;

if (deposit && deposit.status === "FROZEN") {
  // Chiết khấu tiền cọc
  await auctionDepositService.deductWinnerDeposit(auctionId, winnerId);
  finalPrice = auction.winningBid.price - deposit.depositAmount;
}

// Tạo Order với finalPrice
const order = await Order.create({
  listingId: auction.listingId,
  buyerId: winnerId,
  totalPrice: finalPrice,
  depositDeducted: deposit?.depositAmount || 0,
});
```

---

## ⚠️ LƯU Ý

1. **Không được bid nếu chưa đặt cọc** (khi `depositAmount > 0`)
2. **Chỉ hủy cọc được trước khi đấu giá bắt đầu**
3. **Tự động hoàn tiền** cho người không thắng khi auction kết thúc
4. **Tiền cọc của người thắng** phải được chiết khấu thủ công qua API `/deposit/deduct`
5. **Seller không cần đặt cọc** cho xe của chính mình

---

## 📝 CHECKLIST TRIỂN KHAI

- [x] Model `Auction` thêm `depositAmount`
- [x] Model `AuctionDeposit` quản lý cọc tiền
- [x] Service `auctionDepositService` xử lý logic
- [x] Controller `auctionDepositController` với 5 endpoints
- [x] Routes `auctionDepositRoutes` đăng ký vào app
- [x] Tích hợp vào `placeBid()` - kiểm tra đã đặt cọc
- [x] Tích hợp vào `autoCloseAuction()` - hoàn tiền tự động
- [ ] Tích hợp vào Order/Payment - chiết khấu tiền cọc

---

## 🎯 ENDPOINT SUMMARY

| Method   | Endpoint                           | Mô tả                                |
| -------- | ---------------------------------- | ------------------------------------ |
| `POST`   | `/api/auctions`                    | Tạo phiên đấu giá (có depositAmount) |
| `POST`   | `/api/auctions/:id/deposit`        | Đặt cọc tham gia đấu giá             |
| `DELETE` | `/api/auctions/:id/deposit`        | Hủy cọc (trước startAt)              |
| `GET`    | `/api/auctions/:id/deposit/status` | Kiểm tra trạng thái cọc              |
| `GET`    | `/api/auctions/:id/deposits`       | Danh sách người đã đặt cọc           |
| `POST`   | `/api/auctions/:id/deposit/deduct` | Chiết khấu cọc người thắng           |
| `POST`   | `/api/auctions/:id/bid`            | Đặt giá (cần có deposit)             |

---

**Tài liệu này mô tả đầy đủ quy trình đặt cọc đấu giá từ A-Z!** 🚀
