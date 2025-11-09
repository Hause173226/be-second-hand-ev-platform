# Luồng Từ Đấu Giá Đến Hợp Đồng (Auction to Contract Flow)

## Tổng Quan

Sau khi phiên đấu giá kết thúc, người thắng cuộc sẽ sử dụng **tiền cọc tham gia đấu giá** (1 triệu VND) làm tiền đặt cọc để tiếp tục quy trình ký hợp đồng, **không cần đặt cọc lại**.

---

## So Sánh 2 Luồng

### Luồng Đặt Cọc Thông Thường (Normal Deposit Flow)

```
Buyer tạo yêu cầu đặt cọc
    ↓
Seller xác nhận/từ chối
    ↓
Seller tạo lịch hẹn
    ↓
Buyer xác nhận lịch hẹn
    ↓
Staff upload ảnh hợp đồng
    ↓
Staff hoàn thành giao dịch
```

### Luồng Đấu Giá (Auction Flow)

```
Seller tạo phiên đấu giá
    ↓
Các buyer đặt cọc 1 triệu để tham gia
    ↓
Các buyer đấu giá
    ↓
Phiên đấu giá kết thúc (tự động)
    ├─> Người thua: Hoàn tiền cọc
    └─> Người thắng: Giữ tiền cọc → Chuyển thành tiền đặt cọc chính thức
            ↓
    Winner tạo lịch hẹn (KHÔNG CẦN ĐẶT CỌC LẠI)
            ↓
    Seller xác nhận lịch hẹn
            ↓
    Staff upload ảnh hợp đồng
            ↓
    Staff hoàn thành giao dịch
```

---

## API Endpoints

### 1. Tạo Lịch Hẹn Từ Auction (Winner Only)

**Endpoint:** `POST /api/appointments/auction/:auctionId`

**Authentication:** Required (Bearer Token)

**Quyền truy cập:** Chỉ người thắng cuộc (winner)

**Request Body:**

```json
{
  "scheduledDate": "2025-11-20T10:00:00Z", // Optional, mặc định 7 ngày sau
  "location": "123 Đường ABC, Quận 1, TP.HCM", // Optional
  "notes": "Mang theo CMND và bằng lái xe" // Optional
}
```

**Response Success (200):**

```json
{
  "success": true,
  "message": "Đã tạo lịch hẹn ký hợp đồng từ phiên đấu giá",
  "appointment": {
    "_id": "673d1234567890abcdef",
    "auctionId": "673c9876543210fedcba",
    "appointmentType": "AUCTION",
    "buyerId": "user123",
    "sellerId": "user456",
    "scheduledDate": "2025-11-20T10:00:00.000Z",
    "status": "PENDING",
    "type": "CONTRACT_SIGNING",
    "location": "123 Đường ABC, Quận 1, TP.HCM",
    "notes": "Ký kết hợp đồng mua bán xe - Đấu giá thành công với giá 850,000,000 VNĐ",
    "buyerConfirmed": false,
    "sellerConfirmed": false,
    "rescheduledCount": 0,
    "maxReschedules": 3
  }
}
```

**Response Error:**

- **400:** Phiên đấu giá chưa kết thúc hoặc không có người thắng

  ```json
  {
    "success": false,
    "message": "Phiên đấu giá chưa kết thúc"
  }
  ```

- **403:** Không phải người thắng cuộc

  ```json
  {
    "success": false,
    "message": "Chỉ người thắng cuộc mới được tạo lịch hẹn"
  }
  ```

- **400:** Đã có lịch hẹn
  ```json
  {
    "success": false,
    "message": "Đã có lịch hẹn cho phiên đấu giá này"
  }
  ```

---

## Cơ Chế Hoạt Động

### 1. Khi Auction Kết Thúc

Hệ thống tự động thực hiện:

```typescript
async function autoCloseAuction(auctionId) {
  // 1. Xác định người thắng
  auction.winnerId = highestBidder;
  auction.status = "ended";

  // 2. Hoàn tiền cọc cho người thua
  await auctionDepositService.refundNonWinners(auctionId, winnerId);

  // 3. Tạo DepositRequest ảo cho winner (để tương thích với luồng thường)
  await DepositRequest.create({
    listingId: auction.listingId,
    buyerId: auction.winnerId,
    sellerId: listing.sellerId,
    depositAmount: 1000000, // 1 triệu từ auction deposit
    status: "IN_ESCROW", // Đã có tiền sẵn
    sellerConfirmedAt: new Date(), // Tự động xác nhận
  });

  // 4. Tạo EscrowAccount ảo
  await EscrowAccount.create({
    buyerId: auction.winnerId,
    sellerId: listing.sellerId,
    amount: 1000000,
    status: "LOCKED",
  });
}
```

### 2. Winner Tạo Lịch Hẹn

- Winner gọi API `POST /api/appointments/auction/:auctionId`
- Hệ thống kiểm tra:
  - ✅ Auction đã kết thúc
  - ✅ User là người thắng cuộc
  - ✅ Chưa có lịch hẹn nào
- Tạo `Appointment` với `appointmentType: 'AUCTION'`

### 3. Tiếp Tục Luồng Thông Thường

Từ đây, các bước giống với luồng đặt cọc thông thường:

1. **Xác nhận lịch hẹn:** `POST /api/appointments/:id/confirm`
2. **Upload ảnh hợp đồng:** `POST /api/contracts/:id/upload-photos`
3. **Hoàn thành giao dịch:** `POST /api/contracts/:id/complete`

---

## Database Schema

### Appointment Model (Updated)

```typescript
interface IAppointment {
  // Có thể là depositRequestId (luồng thường) hoặc auctionId (luồng đấu giá)
  depositRequestId?: string; // Optional - cho luồng thường
  auctionId?: string; // Optional - cho luồng đấu giá
  appointmentType: "NORMAL_DEPOSIT" | "AUCTION"; // Required

  buyerId: string;
  sellerId: string;
  scheduledDate: Date;
  status: "PENDING" | "CONFIRMED" | "RESCHEDULED" | "COMPLETED" | "CANCELLED";
  // ... other fields
}
```

### Virtual DepositRequest (Created Automatically)

Khi auction kết thúc, hệ thống tự động tạo:

```json
{
  "_id": "auto-generated",
  "listingId": "listing123",
  "buyerId": "winner-user-id",
  "sellerId": "seller-user-id",
  "depositAmount": 1000000,
  "status": "IN_ESCROW", // Đã có tiền từ auction
  "sellerConfirmedAt": "2025-11-09T10:00:00Z", // Auto confirmed
  "escrowAccountId": "escrow-account-id"
}
```

**Mục đích:** Để các bước sau (Contract, Payment) có thể hoạt động với logic hiện có.

---

## Testing Flow

### 1. Tạo và Hoàn Thành Auction

```bash
# 1. Tạo auction
POST /api/auctions
{
  "listingId": "listing123",
  "startAt": "2025-11-09T10:00:00Z",
  "endAt": "2025-11-09T11:00:00Z",
  "startingPrice": 500000000
}

# 2. Users đặt cọc 1 triệu để tham gia
POST /api/auctions/:auctionId/deposit

# 3. Users đấu giá
POST /api/auctions/:auctionId/bid
{
  "price": 850000000
}

# 4. Đợi auction tự động kết thúc (hoặc force close)
# → Hệ thống tự động hoàn tiền cho người thua
# → Tạo DepositRequest ảo cho winner
```

### 2. Winner Tạo Lịch Hẹn

```bash
# Winner tạo lịch hẹn (không cần đặt cọc lại)
POST /api/appointments/auction/673c9876543210fedcba
{
  "scheduledDate": "2025-11-16T14:00:00Z",
  "location": "Văn phòng công ty",
  "notes": "Mang theo giấy tờ cần thiết"
}

# Response:
{
  "success": true,
  "message": "Đã tạo lịch hẹn ký hợp đồng từ phiên đấu giá",
  "appointment": {
    "appointmentType": "AUCTION",
    "auctionId": "673c9876543210fedcba",
    "status": "PENDING",
    // ...
  }
}
```

### 3. Tiếp Tục Luồng Thông Thường

```bash
# Seller xác nhận lịch hẹn
POST /api/appointments/:appointmentId/confirm

# Buyer xác nhận lịch hẹn
POST /api/appointments/:appointmentId/confirm

# Staff upload ảnh hợp đồng tại cuộc hẹn
POST /api/contracts/:appointmentId/upload-photos

# Staff hoàn thành giao dịch
POST /api/contracts/:appointmentId/complete
```

---

## Lợi Ích Của Cách Tiếp Cận Này

### ✅ Tái Sử Dụng Code

- Không cần viết lại logic Contract, Payment
- Sử dụng lại toàn bộ API appointments, contracts hiện có

### ✅ Trải Nghiệm Người Dùng Tốt

- Winner không cần đặt cọc 2 lần
- Tiền cọc đấu giá (1 triệu) được chuyển thành tiền đặt cọc chính thức
- Giảm friction trong quá trình mua xe

### ✅ Tương Thích Ngược

- Không làm ảnh hưởng đến luồng đặt cọc thông thường
- Có thể phân biệt appointment từ auction hoặc deposit thường qua `appointmentType`

### ✅ Đơn Giản Hóa Logic

- Staff không cần biết appointment từ nguồn nào
- Quy trình ký hợp đồng, upload ảnh, hoàn thành giao dịch hoàn toàn giống nhau

---

## Notes

1. **Tiền cọc đấu giá (1 triệu) sẽ được trừ vào tổng giá khi thanh toán cuối:**

   ```
   Tổng cần thanh toán = Giá đấu giá thắng - 1,000,000 VND (tiền cọc)
   ```

2. **DepositRequest ảo** chỉ để tương thích với hệ thống hiện tại, không ảnh hưởng đến logic wallet

3. **Winner phải tạo appointment trong vòng X ngày**, nếu không sẽ bị hủy và mất tiền cọc (có thể implement sau)

4. **appointmentType field** giúp phân biệt nguồn gốc appointment để tracking/analytics

---

## Frontend Integration

```typescript
// Kiểm tra user có phải winner không
const checkIsWinner = async (auctionId: string) => {
  const auction = await getAuctionById(auctionId);
  return auction.winnerId === currentUserId && auction.status === "ended";
};

// Tạo lịch hẹn từ auction
const createAuctionAppointment = async (
  auctionId: string,
  data: AppointmentData
) => {
  const response = await fetch(`/api/appointments/auction/${auctionId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
};

// UI Flow
if (isWinner && auctionEnded) {
  // Show button: "Tạo lịch hẹn ký hợp đồng"
  // Không hiển thị form đặt cọc
}
```

---

## Tóm Tắt

| Bước | Luồng Thông Thường             | Luồng Đấu Giá                                       |
| ---- | ------------------------------ | --------------------------------------------------- |
| 1    | Buyer đặt cọc                  | Buyer đặt cọc tham gia đấu giá (1 triệu)            |
| 2    | Seller xác nhận                | Đấu giá + Tự động hoàn tiền cho người thua          |
| 3    | Seller tạo lịch hẹn            | **Winner tạo lịch hẹn (dùng lại tiền cọc đấu giá)** |
| 4-7  | Xác nhận → Upload → Hoàn thành | **Giống luồng thông thường**                        |

**Key Difference:** Ở luồng đấu giá, tiền cọc 1 triệu từ bước đầu được giữ lại và chuyển thành tiền đặt cọc chính thức, không cần đặt cọc lại!
