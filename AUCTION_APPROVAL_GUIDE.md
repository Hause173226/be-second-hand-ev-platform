# 🎯 AUCTION APPROVAL SYSTEM - HƯỚNG DẪN

## 📋 Tổng quan

Hệ thống phê duyệt phiên đấu giá với flow hoàn chỉnh:

1. Người bán tạo phiên → Chờ staff duyệt
2. Staff phê duyệt → Gửi thông báo toàn hệ thống
3. Kiểm tra số người tham gia trước khi bắt đầu
4. Tự động hủy nếu không đủ người

---

## 🔄 Flow hoạt động

### 1. Người bán tạo phiên đấu giá

**Endpoint:** `POST /api/auctions`

```json
{
  "listingId": "...",
  "startAt": "2025-11-20T10:00:00Z",
  "endAt": "2025-11-20T12:00:00Z",
  "startingPrice": 500000000,
  "depositAmount": 1000000
}
```

**Kết quả:**

- Status: `pending`
- ApprovalStatus: `pending`
- Chưa được hiển thị công khai
- Người bán chờ staff duyệt

---

### 2. Staff duyệt phiên đấu giá

#### ✅ Phê duyệt (Approve)

**Endpoint:** `POST /api/auctions/:auctionId/approve`

```json
{
  "minParticipants": 3,
  "maxParticipants": 50
}
```

**Điều gì xảy ra:**

1. Auction status → `approved`
2. ApprovalStatus → `approved`
3. Set min/maxParticipants
4. **Gửi thông báo cho người bán:**
   - Type: `auction_approved`
   - Title: "Phiên đấu giá đã được phê duyệt"
   - Message: Chi tiết phiên đấu giá
5. **Broadcast toàn bộ hệ thống:**
   - Type: `new_auction`
   - Title: "Phiên đấu giá mới"
   - Gửi cho TẤT CẢ buyers
6. **Emit WebSocket:**
   - Event `auction_approved` → Seller
   - Event `new_auction_available` → All users

---

#### ❌ Từ chối (Reject)

**Endpoint:** `POST /api/auctions/:auctionId/reject`

```json
{
  "reason": "Thông tin sản phẩm chưa đầy đủ, cần bổ sung giấy tờ..."
}
```

**Điều gì xảy ra:**

1. Auction status → `cancelled`
2. ApprovalStatus → `rejected`
3. **Gửi thông báo cho người bán:**
   - Type: `auction_rejected`
   - Title: "Phiên đấu giá bị từ chối"
   - Message: Lý do từ chối
4. **Emit WebSocket:**
   - Event `auction_rejected` → Seller

---

### 3. Kiểm tra số người tham gia (Tự động)

**Cron Job:** Chạy mỗi phút

**Logic:**

```
- Tìm các phiên: approvalStatus = 'approved', startAt trong 5 phút tới
- Đếm số người đã đặt cọc (AuctionDeposit.status = 'LOCKED')
- Nếu depositCount < minParticipants:
  → Hủy phiên
  → Hoàn tiền tất cả
  → Gửi thông báo
```

**Khi phiên bị hủy do không đủ người:**

1. Auction status → `cancelled`
2. cancellationReason → "Không đủ số lượng người tham gia tối thiểu (X/Y người)"
3. Hoàn tiền cọc cho TẤT CẢ người đã đặt (refundNonWinners)
4. **Gửi thông báo cho người bán:**
   - Type: `auction_cancelled`
   - Message: Lý do hủy
5. **Gửi thông báo cho người đã đặt cọc:**
   - Type: `auction_cancelled`
   - Message: "Phiên đấu giá đã bị hủy. Tiền cọc đã được hoàn lại."
6. **Emit WebSocket:**
   - Event `auction_cancelled` → Seller
   - Event `auction_cancelled` → Depositors

---

### 4. Cập nhật min/max participants

**Endpoint:** `PATCH /api/auctions/:auctionId/participants`

```json
{
  "minParticipants": 5,
  "maxParticipants": 30
}
```

---

## 📊 Auction Model (Các trường mới)

```typescript
{
  status: "pending" | "approved" | "active" | "ended" | "cancelled";
  approvalStatus: "pending" | "approved" | "rejected";
  minParticipants: number; // Tối thiểu người tham gia
  maxParticipants: number; // Tối đa người tham gia
  approvedBy: ObjectId; // Staff đã duyệt
  approvedAt: Date;
  rejectionReason: string; // Lý do từ chối
  cancellationReason: string; // Lý do hủy
}
```

---

## 🔐 API Endpoints

### Public APIs (Không cần quyền đặc biệt)

| Method | Endpoint                 | Mô tả                            |
| ------ | ------------------------ | -------------------------------- |
| POST   | `/api/auctions`          | Tạo phiên đấu giá (Seller)       |
| GET    | `/api/auctions/upcoming` | Lấy phiên sắp diễn ra (approved) |
| GET    | `/api/auctions/ongoing`  | Lấy phiên đang diễn ra (active)  |
| GET    | `/api/auctions/ended`    | Lấy phiên đã kết thúc            |
| GET    | `/api/auctions/:id`      | Chi tiết phiên                   |

### User APIs (Cần đăng nhập)

| Method | Endpoint                                | Mô tả                             |
| ------ | --------------------------------------- | --------------------------------- |
| GET    | `/api/auctions/my-auctions`             | Lấy phiên của user với filter     |
| GET    | `/api/auctions/won/pending-appointment` | Phiên đã thắng, chưa tạo lịch hẹn |

**Filter cho `/api/auctions/my-auctions`:**

- `pending` - Đang chờ duyệt
- `approved` - Đã được duyệt, chưa bắt đầu
- `upcoming` - Sắp diễn ra (trong 24h)
- `ongoing` - Đang diễn ra
- `ended` - Đã kết thúc
- `rejected` - Bị từ chối

### Admin/Staff APIs (Cần role staff/admin)

| Method | Endpoint                         | Mô tả                         |
| ------ | -------------------------------- | ----------------------------- |
| GET    | `/api/auctions/admin/pending`    | Lấy danh sách phiên chờ duyệt |
| POST   | `/api/auctions/:id/approve`      | Phê duyệt phiên               |
| POST   | `/api/auctions/:id/reject`       | Từ chối phiên                 |
| PATCH  | `/api/auctions/:id/participants` | Cập nhật min/max              |

---

## 🔔 Thông báo (Notifications)

### Loại thông báo

1. **auction_approved** (Seller only)

   - Khi staff approve
   - Gửi cho người bán

2. **auction_rejected** (Seller only)

   - Khi staff reject
   - Gửi cho người bán + lý do

3. **new_auction** (Broadcast all buyers)

   - Khi staff approve
   - Gửi cho TẤT CẢ buyers trong hệ thống

4. **auction_cancelled** (Seller + Depositors)
   - Khi không đủ người tham gia
   - Gửi cho seller + tất cả người đã đặt cọc

---

## 📱 WebSocket Events

### Events từ Server

```javascript
// 1. Auction được approve
{
  event: 'auction_approved',
  data: {
    auctionId: '...',
    title: 'Phiên đấu giá đã được phê duyệt',
    message: '...',
    auction: { ... }
  }
}

// 2. Auction mới (broadcast)
{
  event: 'new_auction_available',
  data: {
    auctionId: '...',
    title: 'Phiên đấu giá mới',
    message: 'Phiên đấu giá cho xe Tesla Model 3 sắp bắt đầu',
    auction: { ... }
  }
}

// 3. Auction bị reject
{
  event: 'auction_rejected',
  data: {
    auctionId: '...',
    title: 'Phiên đấu giá bị từ chối',
    message: '...',
    reason: 'Lý do từ chối'
  }
}

// 4. Auction bị hủy (không đủ người)
{
  event: 'auction_cancelled',
  data: {
    auctionId: '...',
    title: 'Phiên đấu giá bị hủy',
    message: 'Không đủ số lượng người tham gia',
    reason: '...'
  }
}
```

---

## 🎬 Ví dụ Flow hoàn chỉnh

### Scenario: Phiên đấu giá thành công

1. **11:00** - Seller tạo phiên → Status: `pending`
2. **11:05** - Staff approve, set min=3, max=50 → Status: `approved`
3. **11:06** - Broadcast thông báo đến all buyers
4. **11:10** - User A đặt cọc
5. **11:15** - User B đặt cọc
6. **11:20** - User C đặt cọc
7. **11:55** - Cron check: 3 người ≥ 3 → OK!
8. **12:00** - Auction bắt đầu → Status: `active`
9. **14:00** - Auction kết thúc → Status: `ended`

### Scenario: Phiên bị hủy do không đủ người

1. **11:00** - Seller tạo phiên → Status: `pending`
2. **11:05** - Staff approve, set min=5, max=50 → Status: `approved`
3. **11:06** - Broadcast thông báo đến all buyers
4. **11:10** - User A đặt cọc
5. **11:15** - User B đặt cọc
6. **11:55** - Cron check: 2 người < 5 → HỦY!
   - Hoàn tiền cho A và B
   - Gửi thông báo hủy
   - Status: `cancelled`

---

## ⚙️ Migration Script

Cần chạy migration để cập nhật các auction cũ:

```javascript
// scripts/update-auction-approval.js
db.auctions.updateMany(
  { status: "active" },
  {
    $set: {
      approvalStatus: "approved",
      minParticipants: 1,
      maxParticipants: 100,
    },
  }
);
```

---

## 🧪 Testing

### Test Case 1: Approve Auction

```bash
# Login as staff
POST /api/user/login
{
  "email": "staff@example.com",
  "password": "..."
}

# Get pending auctions
GET /api/auctions/admin/pending

# Approve auction
POST /api/auctions/AUCTION_ID/approve
{
  "minParticipants": 3,
  "maxParticipants": 50
}

# Verify notifications sent
GET /api/notifications
```

### Test Case 2: Auto-cancel due to insufficient participants

```bash
# Create auction with startAt in 10 minutes
# Approve with minParticipants: 5
# Deposit only 2 users
# Wait for cron to run (before 5 min to startAt)
# Verify auction cancelled
# Verify refunds processed
# Verify notifications sent
```

### Test Case 3: User xem các phiên của mình

```bash
# Login as seller
POST /api/user/login

# Xem tất cả phiên đang chờ duyệt
GET /api/auctions/my-auctions?filter=pending

# Xem phiên đã được duyệt, chưa bắt đầu
GET /api/auctions/my-auctions?filter=approved

# Xem phiên sắp diễn ra (trong 24h)
GET /api/auctions/my-auctions?filter=upcoming

# Xem phiên đang diễn ra
GET /api/auctions/my-auctions?filter=ongoing

# Xem phiên đã kết thúc
GET /api/auctions/my-auctions?filter=ended

# Xem phiên bị từ chối
GET /api/auctions/my-auctions?filter=rejected

# Xem tất cả phiên (không filter)
GET /api/auctions/my-auctions
```

---

## 📝 Notes

1. **Cron job** chạy mỗi phút để:
   - Đóng phiên hết hạn
   - Kiểm tra phiên sắp bắt đầu (5 phút trước)
2. **Thông báo** được lưu vào `NotificationMessage` collection

3. **WebSocket** real-time cho trải nghiệm tốt hơn

4. **Min/Max participants:**

   - Default: min=1, max=100
   - Staff có thể điều chỉnh khi approve hoặc sau đó

5. **Hoàn tiền:**
   - Dùng `refundNonWinners()` để hoàn tất cả
   - Automatic khi auction cancelled

---

## 🚀 Ready to use!

Hệ thống đã sẵn sàng với:

- ✅ Auction approval flow
- ✅ Staff APIs
- ✅ User My Auctions API với filters
- ✅ Notification system
- ✅ Auto-cancel logic
- ✅ WebSocket real-time
- ✅ Min/Max participants validation

---

## 📊 Filter Status Chi tiết

### User My Auctions Filters

| Filter     | Điều kiện                                    | Use Case                      |
| ---------- | -------------------------------------------- | ----------------------------- |
| `pending`  | approvalStatus = pending                     | Phiên đang chờ staff duyệt    |
| `approved` | approvalStatus = approved, chưa bắt đầu      | Phiên đã duyệt, đợi đến giờ   |
| `upcoming` | approvalStatus = approved, bắt đầu < 24h     | Phiên sắp diễn ra (chuẩn bị)  |
| `ongoing`  | status = active, đang trong khoảng thời gian | Phiên đang đấu giá            |
| `ended`    | status = ended hoặc cancelled                | Phiên đã kết thúc hoặc bị hủy |
| `rejected` | approvalStatus = rejected                    | Phiên bị staff từ chối        |
| (none)     | Tất cả                                       | Xem toàn bộ phiên của mình    |

### Response Fields

```json
{
  "success": true,
  "message": "Lấy danh sách phiên đấu giá thành công",
  "data": [
    {
      "_id": "...",
      "listingId": { "make": "Tesla", "model": "Model 3", ... },
      "startAt": "2025-11-20T10:00:00Z",
      "endAt": "2025-11-20T12:00:00Z",
      "status": "approved",
      "approvalStatus": "approved",
      "minParticipants": 3,
      "maxParticipants": 50,
      "depositCount": 5,        // Số người đã đặt cọc
      "currentBidCount": 12,    // Số lượt bid
      "highestBid": 520000000,  // Giá cao nhất
      "rejectionReason": null,
      "cancellationReason": null
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 3,
    "total": 25,
    "limit": 10
  }
}
```
