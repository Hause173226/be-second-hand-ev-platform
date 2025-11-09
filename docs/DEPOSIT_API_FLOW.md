# Luồng API Đặt Cọc và Hợp Đồng

## Tổng quan luồng

```
1. Đặt cọc (Buyer)
   ↓
2. Xác nhận/Từ chối đặt cọc (Seller)
   ↓
3. Tạo lịch hẹn (Seller)
   ↓
4. Xác nhận/Từ chối lịch hẹn (Buyer)
   ↓
5. Đến ngày hẹn - Upload ảnh hợp đồng (Staff)
   ↓
6. Hoàn thành giao dịch (Staff)
```

---

## 📋 DANH SÁCH API CHÍNH

### 🔵 BƯỚC 1: ĐẶT CỌC (BUYER)

#### 1.1. Tạo yêu cầu đặt cọc
- **Endpoint**: `POST /api/deposits`
- **Method**: `POST`
- **Auth**: Required (Buyer)
- **Body**:
  ```json
  {
    "listingId": "string",
    "depositAmount": number
  }
  ```
- **Response**:
  - ✅ **Thành công**: Tạo deposit request, freeze tiền trong ví
  - ⚠️ **Thiếu tiền**: Trả về `vnpayUrl` để nạp số tiền còn thiếu
    ```json
    {
      "success": false,
      "message": "Số dư không đủ để đặt cọc",
      "vnpayUrl": "string",
      "requiredAmount": number,
      "currentBalance": number,
      "missingAmount": number
    }
    ```
- **Logic**:
  - Kiểm tra xe có đang trong giao dịch không
  - Kiểm tra đã có deposit active cho xe này chưa
  - Freeze tiền trong ví buyer
  - Gửi notification cho seller
  - Gửi email cho seller

---

### 🟢 BƯỚC 2: XÁC NHẬN/TỪ CHỐI ĐẶT CỌC (SELLER)

#### 2.1. Seller xác nhận hoặc từ chối đặt cọc
- **Endpoint**: `POST /api/deposits/:depositRequestId/confirm`
- **Method**: `POST`
- **Auth**: Required (Seller)
- **Body**:
  ```json
  {
    "action": "CONFIRM" | "REJECT"
  }
  ```
- **Response**:
  - ✅ **CONFIRM**: Chuyển tiền vào escrow, gửi notification + email cho buyer
  - ❌ **REJECT**: Unfreeze tiền, hoàn về ví buyer, gửi notification + email cho buyer
- **Logic khi CONFIRM**:
  - Chuyển tiền từ frozen → escrow
  - Cập nhật status deposit request: `SELLER_CONFIRMED` → `IN_ESCROW`
  - Gửi notification cho buyer: "Đã chấp nhận đặt cọc... xin hãy đợi lịch..."
  - Gửi email cho buyer

---

### 🟡 BƯỚC 3: TẠO LỊCH HẸN (SELLER)

#### 3.1. Tạo lịch hẹn ký hợp đồng
- **Endpoint**: `POST /api/appointments`
- **Method**: `POST`
- **Auth**: Required (Seller)
- **Body**:
  ```json
  {
    "depositRequestId": "string",
    "scheduledDate": "ISO date string (optional, default: 7 days later)",
    "location": "string",
    "notes": "string"
  }
  ```
- **Response**: Tạo appointment với status `PENDING`
- **Logic**:
  - Tạo appointment
  - Gửi notification cho buyer
  - Gửi email cho buyer

---

### 🟠 BƯỚC 4: XÁC NHẬN/TỪ CHỐI LỊCH HẸN (BUYER)

#### 4.1. Buyer xác nhận lịch hẹn
- **Endpoint**: `POST /api/appointments/:appointmentId/confirm`
- **Method**: `POST`
- **Auth**: Required (Buyer)
- **Response**:
  - ✅ **Cả 2 bên đã xác nhận**: Status → `CONFIRMED`, gửi email cho cả buyer và seller
  - ⏳ **Chỉ 1 bên xác nhận**: Chờ bên còn lại
- **Logic**:
  - Cập nhật `buyerConfirmed = true`
  - Nếu cả 2 bên đã confirm → status = `CONFIRMED`
  - Gửi email cho buyer: "Bạn đã xác nhận lịch hẹn..."
  - Gửi email cho seller: "Người mua đã xác nhận lịch hẹn..."

#### 4.2. Buyer từ chối lịch hẹn
- **Endpoint**: `POST /api/appointments/:appointmentId/reject`
- **Method**: `POST`
- **Auth**: Required (Buyer)
- **Body** (optional):
  ```json
  {
    "reason": "string"
  }
  ```
- **Logic**:
  - Tự động dời lịch 1 tuần
  - Status → `RESCHEDULED`
  - Reset `buyerConfirmed` và `sellerConfirmed` = false
  - Gửi notification cho cả 2 bên

---

### 🔴 BƯỚC 5: ĐẾN NGÀY HẸN - UPLOAD ẢNH HỢP ĐỒNG (STAFF)

#### 5.1. Lấy thông tin hợp đồng
- **Endpoint**: `GET /api/contracts/:appointmentId`
- **Method**: `GET`
- **Auth**: Required (Buyer/Seller/Staff)
- **Response**: Thông tin buyer, seller, vehicle, transaction để điền hợp đồng

#### 5.2. Upload ảnh hợp đồng đã ký
- **Endpoint**: `POST /api/contracts/:appointmentId/upload-photos`
- **Method**: `POST`
- **Auth**: Required (Staff/Admin)
- **Content-Type**: `multipart/form-data`
- **Body**: `photos` (array of files, max 10)
- **Logic**:
  - Upload ảnh lên Cloudinary
  - Tạo/update Contract với status `SIGNED`
  - Lưu URLs ảnh vào contract

---

### ✅ BƯỚC 6: HOÀN THÀNH GIAO DỊCH (STAFF)

#### 6.1. Xác nhận giao dịch hoàn thành
- **Endpoint**: `POST /api/contracts/:appointmentId/complete`
- **Method**: `POST`
- **Auth**: Required (Staff/Admin)
- **Logic**:
  - Chuyển tiền từ escrow → ví seller
  - Cập nhật status:
    - Contract: `SIGNED` → `COMPLETED`
    - Appointment: `CONFIRMED` → `COMPLETED`
    - DepositRequest: `IN_ESCROW` → `COMPLETED`
    - Listing: `InTransaction` → `Sold`
  - Gửi notification cho buyer và seller
  - Gửi email cho buyer và seller

#### 6.2. Hủy giao dịch tại cuộc hẹn (Staff)
- **Endpoint**: `POST /api/contracts/:appointmentId/cancel`
- **Method**: `POST`
- **Auth**: Required (Staff/Admin)
- **Body**:
  ```json
  {
    "reason": "string (required)"
  }
  ```
- **Logic**:
  - Hoàn 80% tiền đặt cọc về ví buyer
  - Chuyển 20% tiền đặt cọc vào ví hệ thống (phí hủy)
  - Cập nhật status:
    - Contract: → `CANCELLED`
    - Appointment: → `CANCELLED`
    - DepositRequest: → `CANCELLED`
  - Gửi email cho buyer và seller

---

## 📊 BẢNG TÓM TẮT API CHÍNH

| Bước | API | Method | Auth | Mô tả |
|------|-----|--------|------|-------|
| 1 | `POST /api/deposits` | POST | Buyer | Tạo yêu cầu đặt cọc |
| 2 | `POST /api/deposits/:id/confirm` | POST | Seller | Xác nhận/từ chối đặt cọc |
| 3 | `POST /api/appointments` | POST | Seller | Tạo lịch hẹn |
| 4 | `POST /api/appointments/:id/confirm` | POST | Buyer | Xác nhận lịch hẹn |
| 4 | `POST /api/appointments/:id/reject` | POST | Buyer | Từ chối lịch hẹn |
| 5 | `GET /api/contracts/:id` | GET | User | Lấy thông tin hợp đồng |
| 5 | `POST /api/contracts/:id/upload-photos` | POST | Staff | Upload ảnh hợp đồng |
| 6 | `POST /api/contracts/:id/complete` | POST | Staff | Hoàn thành giao dịch |
| 6 | `POST /api/contracts/:id/cancel` | POST | Staff | Hủy giao dịch tại cuộc hẹn |

**Tổng cộng: 9 API chính**

---

## 🔑 API QUAN TRỌNG NHẤT - LUỒNG HAPPY CASE

### **API nhận tiền đặt cọc rồi lên hợp đồng xác nhận các bước:**

1. **`POST /api/deposits/:depositRequestId/confirm`** (Seller xác nhận)
   - Chuyển tiền vào escrow
   - Status: `IN_ESCROW`

2. **`POST /api/appointments`** (Seller tạo lịch)
   - Tạo appointment
   - Status: `PENDING`

3. **`POST /api/appointments/:appointmentId/confirm`** (Buyer xác nhận)
   - Cả 2 bên xác nhận
   - Status: `CONFIRMED`

4. **`POST /api/contracts/:appointmentId/upload-photos`** (Staff upload ảnh)
   - Upload ảnh hợp đồng
   - Status: `SIGNED`

5. **`POST /api/contracts/:appointmentId/complete`** (Staff hoàn thành)
   - Chuyển tiền cho seller
   - Status: `COMPLETED`

---

## 📝 LƯU Ý

- Tất cả API đều yêu cầu authentication (Bearer token)
- Một số API yêu cầu role cụ thể (Staff/Admin)
- Các notification và email được gửi tự động ở mỗi bước
- Tiền được quản lý qua: Ví → Frozen → Escrow → Ví (seller hoặc buyer)

