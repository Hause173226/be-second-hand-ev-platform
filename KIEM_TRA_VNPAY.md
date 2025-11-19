# Kiểm tra VNPay với localhost

## Vấn đề
Appointment deposit vẫn bị lỗi Code 70 dù đã dùng cùng Return URL với wallet service.

## Cần kiểm tra

### 1. Test wallet service có hoạt động với localhost không?

**Gọi API nạp tiền vào ví:**
- Nếu **hoạt động** → Có sự khác biệt trong code appointment deposit
- Nếu **KHÔNG hoạt động** → VNPay không chấp nhận localhost → Phải dùng ngrok

### 2. So sánh Sign Data

Khi gọi API đặt cọc, log sẽ hiện:
```
Sign Data: vnp_Amount=450000000&vnp_Command=pay&vnp_CreateDate=20251119123610&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Dat coc 10 cho appointment 119ee179599a&vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A8081%2Fapi%2Fpayment%2Fwallet%2Fvnpay-return&vnp_TmnCode=UY28ABIO&vnp_TxnRef=119ee179599a_19123610&vnp_Version=2.1.0
Signed Hash: ...
```

**So sánh với wallet service** để tìm sự khác biệt.

### 3. Giải pháp

**Nếu wallet service KHÔNG hoạt động:**
- VNPay sandbox **KHÔNG chấp nhận localhost**
- **BẮT BUỘC** phải dùng ngrok hoặc public URL
- Hoặc đăng ký Return URL trong VNPay merchant portal

**Nếu wallet service hoạt động:**
- Kiểm tra sự khác biệt trong Sign Data
- Có thể do vnp_OrderInfo hoặc thứ tự parameters

## Test ngay

1. **Test wallet service:**
   - Gọi API nạp tiền vào ví
   - Xem có lỗi Code 70 không

2. **Nếu wallet service hoạt động:**
   - So sánh Sign Data giữa wallet và appointment deposit
   - Tìm sự khác biệt

3. **Nếu wallet service KHÔNG hoạt động:**
   - Phải dùng ngrok
   - Hoặc đăng ký Return URL trong VNPay merchant portal

