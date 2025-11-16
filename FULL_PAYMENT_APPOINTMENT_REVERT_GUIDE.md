# Hướng dẫn Revert Code Tạo Appointment Khi Thanh Toán Toàn Bộ

File này lưu lại các đoạn code mới thêm để có thể revert lại nếu cần.

## File đã thay đổi:
- `src/services/depositPaymentService.ts`

## Các thay đổi:

### 1. Import statements (dòng 8-10)
**Xóa các dòng này:**
```typescript
// [FULL_PAYMENT_APPOINTMENT] - Import để tạo Appointment và DepositRequest khi thanh toán toàn bộ thành công
import Appointment from "../models/Appointment";
import DepositRequest from "../models/DepositRequest";
```

### 2. Logic tạo Appointment và DepositRequest (dòng 517-570)
**Xóa toàn bộ đoạn code từ `// [FULL_PAYMENT_APPOINTMENT]` đến `// END: Code mới thêm`:**

```typescript
        // [FULL_PAYMENT_APPOINTMENT] - Tạo Appointment và DepositRequest để hiển thị trong Transaction History
        // START: Code mới thêm - có thể revert bằng cách xóa từ đây đến END
        if (paymentTransaction.listingId && listing) {
          try {
            const sellerId = listing.sellerId?.toString() || listing.sellerId;
            
            // Tạo DepositRequest với depositAmount = 0 để Transaction History có thể lấy listingId
            const depositRequest = await DepositRequest.create({
              listingId: paymentTransaction.listingId,
              buyerId: userId,
              sellerId: sellerId,
              depositAmount: 0, // Thanh toán toàn bộ nên không có đặt cọc
              status: "COMPLETED", // Đã thanh toán toàn bộ
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
            });

            console.log(
              `✅ [Full Payment] Created DepositRequest ${depositRequest._id} for Transaction History`
            );

            // Tạo Appointment với status = "COMPLETED" để hiển thị trong Transaction History
            const appointment = await Appointment.create({
              depositRequestId: depositRequest._id.toString(),
              appointmentType: "NORMAL_DEPOSIT",
              buyerId: userId,
              sellerId: sellerId,
              createdBy: "BUYER",
              scheduledDate: new Date(), // Ngày thanh toán
              status: "COMPLETED", // Đã thanh toán toàn bộ
              type: "DELIVERY",
              buyerConfirmed: true,
              sellerConfirmed: true,
              buyerConfirmedAt: new Date(),
              sellerConfirmedAt: new Date(),
              confirmedAt: new Date(),
              completedAt: new Date(),
            });

            console.log(
              `✅ [Full Payment] Created Appointment ${appointment._id} for Transaction History`
            );
          } catch (appointmentError: any) {
            console.error(
              `❌ [Full Payment] Error creating Appointment/DepositRequest:`,
              appointmentError.message
            );
            // Không throw error vì thanh toán đã thành công, chỉ log
          }
        } else {
          console.log(
            `⚠️ [Full Payment] No listingId or listing not found, skipping Appointment creation`
          );
        }
        // END: Code mới thêm
```

### 3. Thay đổi biến `listing` (dòng 482)
**Đổi lại từ:**
```typescript
        let listing: any = null;
        if (paymentTransaction.listingId) {
```
**Về:**
```typescript
        if (paymentTransaction.listingId) {
```

Và trong block `if`, đổi lại từ:
```typescript
            listing = await Listing.findById(paymentTransaction.listingId);
```
**Về:**
```typescript
            const listing = await Listing.findById(paymentTransaction.listingId);
```

## Cách revert:
1. Mở file `src/services/depositPaymentService.ts`
2. Xóa các dòng import (dòng 8-10)
3. Xóa toàn bộ đoạn code từ dòng 517 đến dòng 570
4. Sửa lại biến `listing` như hướng dẫn ở mục 3

## Mục đích code mới:
- Tạo `DepositRequest` với `depositAmount = 0` để Transaction History API có thể lấy `listingId`
- Tạo `Appointment` với `status = "COMPLETED"` để hiển thị trong Transaction History
- Giúp user có thể xem lịch sử giao dịch mua/bán sau khi thanh toán toàn bộ thành công

