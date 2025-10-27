# ✅ DEPOSIT FLOW - FULL CHECKLIST

## 🎯 TỔNG QUAN LUỒNG ĐẶT CỌC

### **Bước 1: Buyer đặt cọc (Create Deposit Request)**
- **API**: `POST /api/deposits`
- **Controller**: `depositController.createDepositRequest`
- **Service**: `walletService.freezeAmount` - Freeze tiền trong ví
- **Notification**: 
  - ✅ **Database**: Lưu notification vào DB qua `depositNotificationService.sendDepositRequestNotification()`
  - ✅ **WebSocket**: Gửi real-time notification đến seller qua `wsService.sendToUser()`
  - **Event**: `deposit_notification`
  - **Receiver**: Seller

### **Bước 2: Seller xác nhận/từ chối (Seller Confirm/Reject)**
- **API**: `POST /api/deposits/:depositId/confirm`
- **Controller**: `depositController.sellerConfirmDeposit`
- **Service**: `walletService.transferToEscrow` - Chuyển tiền vào escrow
- **Notification**: 
  - ✅ **Database**: Lưu notification vào DB qua `depositNotificationService.sendDepositConfirmationNotification()`
  - ✅ **WebSocket**: Gửi real-time notification đến buyer qua `wsService.sendToUser()`
  - **Event**: `deposit_confirmation`
  - **Receiver**: Buyer

### **Bước 3: Staff upload ảnh hợp đồng (Upload Contract Photos)**
- **API**: `POST /api/contracts/:appointmentId/photos`
- **Controller**: `contractController.uploadContractPhotos`
- **Service**: `cloudinaryService.uploadFromBuffer` - Upload ảnh lên Cloudinary
- **Notification**: 
  - ✅ **Database**: Lưu notification vào DB qua `depositNotificationService.sendContractNotification()`
  - ✅ **WebSocket**: Gửi real-time notification đến buyer & seller qua `wsService.sendToUser()`
  - **Event**: `contract_notification`
  - **Receiver**: Buyer & Seller

### **Bước 4: Staff hoàn thành giao dịch (Complete Transaction)**
- **API**: `POST /api/contracts/:appointmentId/complete`
- **Controller**: `contractController.completeTransaction`
- **Service**: `walletService.completeTransaction` - Chuyển tiền từ escrow về seller
- **Notification**: 
  - ✅ **Database**: Lưu notification vào DB qua `depositNotificationService.sendTransactionCompleteNotification()`
  - ✅ **WebSocket**: Gửi real-time notification đến buyer & seller qua `wsService.sendToUser()`
  - **Event**: `transaction_complete`
  - **Receiver**: Buyer & Seller

---

## 📁 FILES LIÊN QUAN

### **Models:**
- ✅ `src/models/Notification.ts` - Model lưu thông báo vào database
- ✅ `src/models/DepositRequest.ts` - Model đặt cọc
- ✅ `src/models/Contract.ts` - Model hợp đồng

### **Services:**
- ✅ `src/services/depositNotificationService.ts` - Service xử lý notification cho đặt cọc (LƯU DATABASE)
- ✅ `src/services/notificationService.ts` - Service xử lý notification cho chat/appointment (KHÔNG LƯU DATABASE)
- ✅ `src/services/walletService.ts` - Service xử lý ví
- ✅ `src/services/cloudinaryService.ts` - Service upload ảnh

### **Controllers:**
- ✅ `src/controllers/depositController.ts` - Controller xử lý đặt cọc
- ✅ `src/controllers/contractController.ts` - Controller xử lý hợp đồng
- ✅ `src/controllers/notificationController.ts` - Controller API lấy notifications

### **Routes:**
- ✅ `src/routes/depositRoutes.ts` - Routes đặt cọc
- ✅ `src/routes/contractRoutes.ts` - Routes hợp đồng
- ✅ `src/routes/notificationRoutes.ts` - Routes notifications
- ✅ `src/app.ts` - Đã thêm notification routes

---

## 🔔 NOTIFICATION TYPES

### **1. Deposit Notification (`deposit`)**
- **Trigger**: Khi buyer đặt cọc
- **Receiver**: Seller
- **Database**: ✅ CÓ LƯU
- **WebSocket**: ✅ CÓ GỬI
- **Content**: 
```json
{
  "type": "deposit",
  "title": "Có yêu cầu đặt cọc mới",
  "message": "{buyerName} muốn đặt cọc {amount} VND cho sản phẩm của bạn",
  "metadata": {
    "depositId": "...",
    "listingId": "...",
    "amount": 1000000,
    "status": "pending"
  }
}
```

### **2. Deposit Confirmation (`deposit_confirmation`)**
- **Trigger**: Khi seller xác nhận/từ chối
- **Receiver**: Buyer
- **Database**: ✅ CÓ LƯU
- **WebSocket**: ✅ CÓ GỬI
- **Content**:
```json
{
  "type": "deposit_confirmation",
  "title": "Đặt cọc được chấp nhận" / "Đặt cọc bị từ chối",
  "message": "{sellerName} đã {chấp nhận/từ chối} yêu cầu đặt cọc",
  "metadata": {
    "depositId": "...",
    "status": "accepted" / "rejected",
    "amount": 1000000
  }
}
```

### **3. Contract Notification (`contract`)**
- **Trigger**: Khi staff upload hợp đồng
- **Receiver**: Buyer & Seller
- **Database**: ✅ CÓ LƯU
- **WebSocket**: ✅ CÓ GỬI
- **Content**:
```json
{
  "type": "contract",
  "title": "Hợp đồng mới",
  "message": "Hợp đồng đã được tạo cho giao dịch của bạn",
  "metadata": {
    "contractId": "...",
    "appointmentId": "...",
    "status": "signed"
  }
}
```

### **4. Transaction Complete (`transaction_complete`)**
- **Trigger**: Khi staff hoàn thành giao dịch
- **Receiver**: Buyer & Seller
- **Database**: ✅ CÓ LƯU
- **WebSocket**: ✅ CÓ GỬI
- **Content**:
```json
{
  "type": "transaction_complete",
  "title": "Giao dịch hoàn thành",
  "message": "Giao dịch mua/bán xe đã hoàn thành thành công",
  "metadata": {
    "transactionId": "...",
    "contractId": "...",
    "amount": 1000000,
    "status": "completed"
  }
}
```

---

## 🚀 API ENDPOINTS CHO FE

### **Notification APIs:**
```bash
# Lấy tất cả notifications
GET /api/notifications

# Lấy số notification chưa đọc
GET /api/notifications/unread-count

# Đánh dấu đã đọc
PATCH /api/notifications/:notificationId/read

# Đánh dấu tất cả đã đọc
PATCH /api/notifications/read-all

# Xóa notification
DELETE /api/notifications/:notificationId
```

### **Deposit APIs:**
```bash
# Đặt cọc
POST /api/deposits

# Seller xác nhận/từ chối
POST /api/deposits/:depositId/confirm
```

### **Contract APIs:**
```bash
# Upload ảnh hợp đồng
POST /api/contracts/:appointmentId/photos

# Hoàn thành giao dịch
POST /api/contracts/:appointmentId/complete
```

---

## ✅ KẾT LUẬN

### **TẤT CẢ NOTIFICATIONS ĐÃ ĐƯỢC LƯU VÀO DATABASE:**

✅ **Step 1** - Buyer đặt cọc → Seller nhận notification (`deposit`) → **LƯU DATABASE**
✅ **Step 2** - Seller xác nhận → Buyer nhận notification (`deposit_confirmation`) → **LƯU DATABASE**
✅ **Step 3** - Staff upload hợp đồng → Buyer & Seller nhận notification (`contract`) → **LƯU DATABASE**
✅ **Step 4** - Staff hoàn thành → Buyer & Seller nhận notification (`transaction_complete`) → **LƯU DATABASE**

### **NOTIFICATION FLOW:**
1. ✅ Tạo notification trong database (Model: `Notification`)
2. ✅ Gửi qua WebSocket real-time
3. ✅ FE có thể lấy notifications qua API
4. ✅ FE có thể đánh dấu đã đọc
5. ✅ FE có thể xóa notifications

### **MỖI NOTIFICATION CHỨA:**
- ✅ `userId` - Người nhận
- ✅ `type` - Loại notification
- ✅ `title` - Tiêu đề
- ✅ `message` - Nội dung
- ✅ `metadata` - Thông tin chi tiết
- ✅ `isRead` - Trạng thái đã đọc
- ✅ `createdAt` - Thời gian tạo
- ✅ `readAt` - Thời gian đọc (nếu có)

---

## 🎉 HOÀN THÀNH!

**TẤT CẢ NOTIFICATIONS TRONG LUỒNG ĐẶT CỌC ĐÃ ĐƯỢC LƯU VÀO DATABASE!**

