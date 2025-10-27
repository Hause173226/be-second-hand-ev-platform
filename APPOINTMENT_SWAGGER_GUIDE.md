# 📘 Swagger API Documentation - Appointments

## 🚀 Truy cập Swagger UI

Sau khi chạy server, truy cập:

```
http://localhost:8081/api-docs
```

## 📋 Danh sách Endpoints đã tạo

### **1. POST /api/appointments**

**Tạo lịch hẹn mới**

- Yêu cầu: `depositRequestId`, `scheduledDate` (optional), `location`, `notes`
- Trả về: Thông tin lịch hẹn đã tạo
- Status: `PENDING`

### **2. POST /api/appointments/{appointmentId}/confirm**

**Xác nhận lịch hẹn**

- Buyer confirm → `buyerConfirmed = true`
- Seller confirm → `sellerConfirmed = true`
- Cả 2 confirm → `status = CONFIRMED`

### **3. POST /api/appointments/{appointmentId}/reject**

**Từ chối và tự động dời lịch 1 tuần**

- Tự động dời sang 1 tuần sau
- Reset trạng thái confirm
- Tăng `rescheduledCount`

### **4. PUT /api/appointments/{appointmentId}/reschedule**

**Dời lịch hẹn (Tối đa 3 lần)**

- Body: `newDate`, `reason`
- Reset trạng thái confirm
- Nếu > 3 lần → Tự động hủy + hoàn tiền

### **5. PUT /api/appointments/{appointmentId}/cancel**

**Hủy lịch hẹn**

- Body: `reason`
- Status → `CANCELLED`
- Hoàn tiền cọc về wallet

### **6. GET /api/appointments/user**

**Lấy danh sách lịch hẹn của user**

- Query: `status`, `type`, `page`, `limit`
- Trả về: Danh sách + pagination

### **7. GET /api/appointments/staff**

**Lấy danh sách cho Staff/Admin**

- Query: `status`, `search`, `page`, `limit`
- Chỉ staff/admin mới truy cập được

### **8. GET /api/appointments/{appointmentId}**

**Lấy chi tiết lịch hẹn**

- Trả về: Thông tin đầy đủ về appointment, buyer, seller, listing

---

## 🧪 Test với Swagger UI

### **Bước 1: Đăng nhập để lấy token**

1. Vào `/api-docs`
2. Tìm endpoint `POST /api/users/login`
3. Nhập email/password
4. Copy `accessToken` từ response

### **Bước 2: Authorize**

1. Click nút **Authorize** (🔒) ở góc phải trên cùng
2. Nhập: `Bearer {accessToken}` (có khoảng trắng sau "Bearer")
3. Click **Authorize** → **Close**

### **Bước 3: Test các endpoint**

#### **Test 1: Tạo appointment**

```json
POST /api/appointments
{
  "depositRequestId": "673c1234567890abcdef1234",
  "scheduledDate": "2025-10-30T10:00:00Z",
  "location": "123 Đường ABC, Q1",
  "notes": "Mang CMND"
}
```

#### **Test 2: Confirm appointment**

```
POST /api/appointments/{appointmentId}/confirm
(Không cần body)
```

#### **Test 3: Reschedule**

```json
PUT /api/appointments/{appointmentId}/reschedule
{
  "newDate": "2025-10-31T14:00:00Z",
  "reason": "Bận việc"
}
```

#### **Test 4: Get user appointments**

```
GET /api/appointments/user?status=PENDING&page=1&limit=10
```

#### **Test 5: Get appointment details**

```
GET /api/appointments/{appointmentId}
```

---

## 📊 Response Status Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 200  | Success                        |
| 400  | Bad Request (validation error) |
| 401  | Unauthorized (chưa đăng nhập)  |
| 403  | Forbidden (không có quyền)     |
| 404  | Not Found (không tìm thấy)     |
| 500  | Internal Server Error          |

---

## 🔐 Authentication

Tất cả endpoints đều yêu cầu JWT token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 💡 Tips

1. **Thứ tự test logic:**

   - Đăng nhập → Lấy token
   - Tạo deposit request (nếu chưa có)
   - Tạo appointment
   - Confirm appointment (cả buyer và seller)
   - Test reschedule/cancel

2. **Lưu ý về dữ liệu:**

   - `depositRequestId` phải tồn tại và có status `IN_ESCROW`
   - `scheduledDate` phải là thời gian tương lai
   - Chỉ buyer/seller mới confirm được appointment của mình

3. **Xử lý lỗi:**
   - Check response message để biết lý do lỗi
   - Kiểm tra token còn hạn không (401)
   - Verify quyền truy cập (403)

---

## 🎯 Example Flow

```
1. User A (Buyer) đăng nhập
   POST /api/users/login
   → Lấy token

2. User A đặt cọc cho listing
   POST /api/deposits
   → Lấy depositRequestId

3. User A tạo appointment
   POST /api/appointments
   {
     "depositRequestId": "...",
     "scheduledDate": "2025-10-30T10:00:00Z"
   }
   → appointmentId = "abc123"

4. User A confirm
   POST /api/appointments/abc123/confirm
   → buyerConfirmed = true

5. User B (Seller) đăng nhập
   POST /api/users/login
   → Lấy token

6. User B confirm
   POST /api/appointments/abc123/confirm
   → status = CONFIRMED ✅

7. Lấy chi tiết
   GET /api/appointments/abc123
   → Xem full thông tin
```

---

## 🛠️ Troubleshooting

### Lỗi 401 Unauthorized

- Token hết hạn → Đăng nhập lại
- Token sai format → Phải có "Bearer " trước token
- Chưa authorize trong Swagger UI

### Lỗi 403 Forbidden

- Không phải buyer/seller của appointment này
- Không có role staff/admin (cho endpoint /staff)

### Lỗi 404 Not Found

- appointmentId không tồn tại
- depositRequestId không tồn tại

### Lỗi 400 Bad Request

- Thiếu field required
- Format dữ liệu sai (date format)
- Đã vượt quá số lần reschedule

---

## 📝 Notes

- Swagger UI tự động validate schema trước khi gửi request
- Có thể download API spec (JSON/YAML) để import vào Postman
- Mỗi endpoint có ví dụ request/response để tham khảo
- Click "Try it out" để test trực tiếp trên Swagger UI

---

**Happy Testing! 🚀**
