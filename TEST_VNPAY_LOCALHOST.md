# Test VNPay với localhost

## Vấn đề
Appointment deposit vẫn bị lỗi Code 70 "Invalid signature" dù đã dùng cùng Return URL với wallet service.

## Kiểm tra

### 1. Test wallet service có hoạt động với localhost không?

Gọi API nạp tiền vào ví và xem có lỗi Code 70 không:
- Nếu wallet service **KHÔNG hoạt động** → VNPay không chấp nhận localhost
- Nếu wallet service **hoạt động** → Có thể có sự khác biệt trong code

### 2. So sánh Sign Data

Khi gọi API đặt cọc, check log:
```
Sign Data: vnp_Amount=...&vnp_Command=...&...
```

So sánh với wallet service để xem có khác biệt không.

### 3. Giải pháp

**Nếu wallet service KHÔNG hoạt động:**
- Phải dùng ngrok hoặc public URL
- Hoặc đăng ký Return URL trong VNPay merchant portal

**Nếu wallet service hoạt động:**
- Kiểm tra sự khác biệt trong code
- Có thể do vnp_OrderInfo hoặc thứ tự parameters

## Debug

Check log khi gọi API:
```
=== Deposit 10% Payment Debug ===
vnp_TmnCode: UY28ABIO
vnp_ReturnUrl: http%3A%2F%2Flocalhost%3A8081%2Fapi%2Fpayment%2Fwallet%2Fvnpay-return
vnp_Amount: 450000000
vnp_TxnRef: 119ee179599a_19123610
vnp_OrderInfo: Dat coc 10 cho appointment 119ee179599a
Sign Data: ... (toàn bộ)
Signed Hash: ... (toàn bộ)
```

So sánh với wallet service để tìm sự khác biệt.

