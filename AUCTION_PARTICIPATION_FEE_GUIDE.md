# HƯỚNG DẪN PHÍ CỌC THAM GIA ĐẤU GIÁ

## 💰 PHÍ CỌC CỐ ĐỊNH

**Mọi user muốn tham gia đấu giá đều phải đặt cọc trước:**

- **Phí cọc:** `1,000,000 VNĐ` (Cố định)
- **Bắt buộc:** Phải đặt cọc mới được bid
- **Không đủ tiền:** Hệ thống tạo link VNPay để nạp

---

## 🔄 QUY TRÌNH

### **1️⃣ User muốn tham gia đấu giá**

**Bước 1: Kiểm tra phí cọc**

```bash
GET /api/auctions/deposit/fee
```

**Response:**

```json
{
  "success": true,
  "data": {
    "participationFee": 1000000,
    "description": "Phí cọc bắt buộc để tham gia đấu giá"
  }
}
```

**Bước 2: Đặt cọc**

```bash
POST /api/auctions/:auctionId/deposit
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
    "depositAmount": 1000000,
    "status": "FROZEN",
    "frozenAt": "2025-11-08T10:00:00.000Z"
  }
}
```

**Response (Không đủ tiền - Yêu cầu nạp):**

```json
{
  "success": false,
  "message": "Số dư không đủ để đặt cọc",
  "vnpayUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "requiredAmount": 1000000,
  "currentBalance": 500000
}
```

---

### **2️⃣ User đấu giá**

**Kiểm tra:** Hệ thống tự động kiểm tra đã đặt cọc chưa

```bash
POST /api/auctions/:auctionId/bid
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 500000000
}
```

**Response (Chưa đặt cọc):**

```json
{
  "message": "Bạn cần đặt cọc 1,000,000 VNĐ để tham gia đấu giá"
}
```

**Response (Đã đặt cọc - Bid thành công):**

```json
{
  "message": "Bid thành công",
  "auction": {
    "_id": "auction123",
    "bids": [
      {
        "userId": "user123",
        "price": 500000000,
        "createdAt": "2025-11-08T10:30:00.000Z"
      }
    ]
  }
}
```

---

### **3️⃣ Kết thúc đấu giá**

#### **A. Người THUA cuộc:**

- ✅ **Hoàn tiền cọc 1 triệu VNĐ về ví**
- Tự động khi auction kết thúc

```typescript
// Trong autoCloseAuction()
await auctionDepositService.refundNonWinners(auctionId, winnerId);
```

#### **B. Người THẮNG cuộc:**

- ✅ **Trừ 1 triệu VNĐ vào tiền đặt cọc xe**
- Gọi API khi tạo Order/Payment

```bash
POST /api/auctions/:auctionId/deposit/deduct
Authorization: Bearer <token>
Content-Type: application/json

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
    "deductedAmount": 1000000,
    "status": "DEDUCTED",
    "deductedAt": "2025-11-08T15:00:00.000Z"
  }
}
```

---

## 💡 VÍ DỤ ĐẦY ĐỦ

### **Scenario: User A tham gia đấu giá xe Tesla**

**1. Kiểm tra phí cọc:**

```bash
GET /api/auctions/deposit/fee
→ Response: participationFee = 1,000,000 VNĐ
```

**2. Kiểm tra số dư:**

```
Ví hiện tại: 5,000,000 VNĐ
Cần: 1,000,000 VNĐ
→ ✅ Đủ tiền
```

**3. Đặt cọc:**

```bash
POST /api/auctions/auction123/deposit
→ Freeze 1,000,000 VNĐ
→ Wallet: balance = 4,000,000 | frozenAmount = 1,000,000
```

**4. Đấu giá:**

```bash
POST /api/auctions/auction123/bid
Body: { "price": 500000000 }
→ ✅ Bid thành công (đã có cọc)
```

**5. Kết thúc đấu giá:**

**Trường hợp A: User A THẮNG**

```bash
POST /api/auctions/auction123/deposit/deduct
Body: { "winnerId": "userA" }

→ frozenAmount giảm 1,000,000
→ Tiền cọc được trừ vào giá xe
→ Giá cuối = winningBid.price - 1,000,000 (chưa tính tiền cọc xe)
```

**Trường hợp B: User A THUA**

```
→ Tự động hoàn 1,000,000 về ví
→ Wallet: balance = 5,000,000 | frozenAmount = 0
```

---

## 📊 LUỒNG TIỀN

### **Khi đặt cọc tham gia:**

```
Wallet.balance: 5,000,000 → 4,000,000
Wallet.frozenAmount: 0 → 1,000,000
AuctionDeposit.status: FROZEN
```

### **Khi THUA cuộc (Hoàn tiền):**

```
Wallet.balance: 4,000,000 → 5,000,000
Wallet.frozenAmount: 1,000,000 → 0
AuctionDeposit.status: FROZEN → REFUNDED
```

### **Khi THẮNG cuộc (Trừ vào cọc xe):**

```
Wallet.frozenAmount: 1,000,000 → 0
AuctionDeposit.status: FROZEN → DEDUCTED

Tính tiền thanh toán:
- Giá thắng: 500,000,000 VNĐ
- Trừ phí cọc tham gia: -1,000,000 VNĐ
- Cần thanh toán: 499,000,000 VNĐ (chưa tính tiền cọc xe)
```

---

## 🚫 GIỚI HẠN

### **Seller KHÔNG THỂ:**

1. ❌ Đặt cọc cho phiên đấu giá của chính mình
2. ❌ Bid cho sản phẩm của chính mình

### **Bidder PHẢI:**

1. ✅ Đặt cọc 1 triệu VNĐ trước khi bid
2. ✅ Có đủ tiền trong ví (hoặc nạp qua VNPay)

---

## 🔍 CÁC API

| Endpoint                           | Method | Mô tả                   |
| ---------------------------------- | ------ | ----------------------- |
| `/api/auctions/deposit/fee`        | GET    | Lấy phí cọc (1 triệu)   |
| `/api/auctions/:id/deposit`        | POST   | Đặt cọc tham gia        |
| `/api/auctions/:id/deposit`        | DELETE | Hủy cọc (trước startAt) |
| `/api/auctions/:id/deposit/status` | GET    | Kiểm tra đã cọc chưa    |
| `/api/auctions/:id/deposits`       | GET    | Danh sách người đặt cọc |
| `/api/auctions/:id/deposit/deduct` | POST   | Trừ cọc người thắng     |
| `/api/auctions/:id/bid`            | POST   | Đấu giá (cần có cọc)    |

---

## ⚠️ LƯU Ý

1. **PHÍ CỐ ĐỊNH:** Tất cả phiên đấu giá đều yêu cầu cọc 1 triệu VNĐ
2. **BẮT BUỘC:** Không thể bid nếu chưa đặt cọc
3. **TỰ ĐỘNG HOÀN:** Người thua được hoàn tiền ngay khi auction kết thúc
4. **CHIẾT KHẤU:** Người thắng được trừ 1 triệu vào tiền thanh toán
5. **HỦY CỌC:** Chỉ được hủy trước khi đấu giá bắt đầu

---

## 🎯 CÔNG THỨC TÍNH GIÁ CUỐI

```typescript
// Người thắng thanh toán
const finalPrice = winningBid.price - PARTICIPATION_FEE;

// Ví dụ:
// Giá thắng: 500,000,000 VNĐ
// Phí cọc: -1,000,000 VNĐ
// Phải trả: 499,000,000 VNĐ

// (Chưa tính tiền cọc xe nếu có)
```

---

**Hệ thống phí cọc bắt buộc 1 triệu VNĐ cho tất cả phiên đấu giá!** 🎉
