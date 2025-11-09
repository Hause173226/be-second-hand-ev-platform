# Luồng Hủy Lịch Hẹn / Hủy Giao Dịch

## L4. Người mua/người bán hủy lịch hẹn hoặc hủy giao dịch

### Luồng chi tiết:

1. **Người dùng đặt cọc** → Đủ tiền → **(noti + mail)** Gửi thông báo có yêu cầu đặt cọc cho người bán
   - Function: `sendDepositRequestNotification()`
   - Gửi: Notification (database + WebSocket) + Email cho seller

2. **Người bán chấp nhận** → **(noti)** Gửi thông báo chấp nhận đặt cọc cho người mua
   - Function: `sendDepositConfirmationNotification(action: 'accept')`
   - Gửi: Notification (database + WebSocket) cho buyer

3. **Người bán tạo lịch** → **(noti)** Gửi lịch cho người mua
   - Function: `sendAppointmentCreatedNotification()`
   - Gửi: Notification (database + WebSocket) cho buyer

4. **Người mua/người bán hủy lịch** → **(noti + mail)** Cả 2 bên nhận thông báo
   - Function: `sendAppointmentCancelledNotification()`
   - Gửi: Notification (database + WebSocket) + Email cho **cả buyer và seller**
   - Logic: 
     - Appointment status = `CANCELLED`
     - Nếu buyer hủy và tiền đã vào escrow (`IN_ESCROW`):
       - Hoàn 100% tiền đặt cọc về ví buyer
       - Listing status: `InTransaction` → `Published`
       - Deposit request status: `IN_ESCROW` → `CANCELLED`
       - `isTransactionCancelled = true` → Thông báo "Giao dịch đã bị hủy"
     - Nếu chỉ hủy lịch (tiền chưa vào escrow hoặc seller hủy):
       - `isTransactionCancelled = false` → Thông báo "Lịch hẹn đã bị hủy"
       - Seller có thể tạo lịch mới

---

## API Endpoint

**PUT** `/api/appointments/:appointmentId/cancel`

### Request Body:
```json
{
  "reason": "string (optional)"
}
```

### Response:
```json
{
  "success": true,
  "message": "Đã hủy giao dịch thành công, tiền đã hoàn về ví của bạn" 
           // hoặc "Hủy lịch hẹn thành công",
  "appointment": {
    "id": "string",
    "status": "CANCELLED",
    "cancelledAt": "ISO date string"
  },
  "refunded": true/false  // true nếu có hoàn tiền
}
```

---

## Notification & Email Details

### Khi hủy lịch hẹn (isTransactionCancelled = false):

#### Notification cho Buyer:
- **Type**: `appointment_cancelled`
- **Title**: "Lịch hẹn đã bị hủy"
- **Message**: "Lịch hẹn cho [Tên xe] đã bị hủy. Lý do: [reason]"
- **Email**: Thông tin lịch hẹn, lý do, lưu ý liên hệ seller để thỏa thuận lại

#### Notification cho Seller:
- **Type**: `appointment_cancelled`
- **Title**: "Lịch hẹn đã bị hủy"
- **Message**: "Lịch hẹn cho [Tên xe] đã bị hủy. Lý do: [reason]"
- **Email**: Thông tin lịch hẹn, lý do, lưu ý có thể tạo lịch mới

---

### Khi hủy giao dịch (isTransactionCancelled = true):

#### Notification cho Buyer:
- **Type**: `transaction_cancelled`
- **Title**: "Giao dịch đã bị hủy"
- **Message**: "Giao dịch mua [Tên xe] đã bị hủy. Lý do: [reason]. Tiền đặt cọc đã được hoàn về ví của bạn."
- **Email**: 
  - Thông tin lịch hẹn đã hủy
  - Lý do hủy
  - **Thông tin hoàn tiền**: 100% tiền đặt cọc đã hoàn về ví
  - Lưu ý có thể tiếp tục tìm kiếm xe khác

#### Notification cho Seller:
- **Type**: `transaction_cancelled`
- **Title**: "Giao dịch đã bị hủy"
- **Message**: "Giao dịch bán [Tên xe] đã bị hủy. Lý do: [reason]"
- **Email**: 
  - Thông tin lịch hẹn đã hủy
  - Lý do hủy
  - **Lưu ý**: Xe đã chuyển về trạng thái "Đang bán", có thể nhận đặt cọc từ người mua khác

---

## WebSocket Events

### Event cho Buyer:
```json
{
  "type": "appointment_cancelled" | "transaction_cancelled",
  "notificationId": "string",
  "title": "Lịch hẹn đã bị hủy" | "Giao dịch đã bị hủy",
  "message": "string",
  "appointmentId": "string",
  "metadata": {
    "appointmentId": "string",
    "listingId": "string",
    "listingTitle": "string",
    "buyerId": "string",
    "sellerId": "string",
    "reason": "string",
    "isTransactionCancelled": boolean
  },
  "timestamp": "ISO date string"
}
```

### Event cho Seller:
```json
{
  "type": "appointment_cancelled" | "transaction_cancelled",
  "notificationId": "string",
  "title": "Lịch hẹn đã bị hủy" | "Giao dịch đã bị hủy",
  "message": "string",
  "appointmentId": "string",
  "metadata": {
    "appointmentId": "string",
    "listingId": "string",
    "listingTitle": "string",
    "buyerId": "string",
    "sellerId": "string",
    "reason": "string",
    "isTransactionCancelled": boolean
  },
  "timestamp": "ISO date string"
}
```

---

## So sánh với L3 (Reject Appointment)

| Tiêu chí | L3: Reject Appointment | L4: Cancel Appointment |
|----------|------------------------|----------------------|
| **Người thực hiện** | Chỉ Buyer | Buyer hoặc Seller |
| **Người nhận thông báo** | Chỉ Seller | Cả Buyer và Seller |
| **Appointment Status** | `REJECTED` | `CANCELLED` |
| **Có hoàn tiền?** | Không | Có (nếu buyer hủy và tiền đã vào escrow) |
| **Có hủy giao dịch?** | Không | Có thể (nếu buyer hủy và tiền đã vào escrow) |
| **Seller có thể tạo lịch mới?** | Có | Có (nếu chỉ hủy lịch) |
| **Listing Status** | Không đổi | `InTransaction` → `Published` (nếu hủy giao dịch) |

---

## Lưu ý

1. **Phân biệt hủy lịch vs hủy giao dịch**:
   - Hủy lịch: Chỉ đánh dấu appointment = `CANCELLED`, không hoàn tiền
   - Hủy giao dịch: Hoàn tiền, cập nhật listing, deposit request = `CANCELLED`

2. **Điều kiện hủy giao dịch**:
   - Chỉ khi **buyer hủy** VÀ `depositRequest.status === 'IN_ESCROW'`
   - Nếu seller hủy → Chỉ hủy lịch, không hoàn tiền

3. **Notification & Email**:
   - Luôn gửi cho cả 2 bên
   - Nội dung khác nhau tùy theo vai trò (buyer/seller)
   - Phân biệt rõ "hủy lịch" vs "hủy giao dịch"

