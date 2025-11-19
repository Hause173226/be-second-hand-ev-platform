# Cập nhật VNPay Config

## ✅ Đã cập nhật Hash Secret mới

Từ email VNPay, Hash Secret mới là:
```
HCE60T7GQYDZUJJ216XKP1Z8KHZN69PX
```

## Cần cập nhật file .env

Thêm hoặc sửa trong file `.env`:

```env
VNPAY_TMN_CODE=UY28ABIO
VNPAY_HASH_SECRET=HCE60T7GQYDZUJJ216XKP1Z8KHZN69PX
```

## Sau khi cập nhật

1. **Restart server:**
   ```bash
   npm run dev
   ```

2. **Test lại API đặt cọc 10%**

3. **Kiểm tra log:**
   ```
   Hash Secret (first 10 chars): HCE60T7GQY...
   ```

## Thông tin từ VNPay

- **Terminal ID:** UY28ABIO ✅ (đã đúng)
- **Hash Secret:** HCE60T7GQYDZUJJ216XKP1Z8KHZN69PX ✅ (đã cập nhật)
- **URL:** https://sandbox.vnpayment.vn/paymentv2/vpcpay.html ✅ (đã đúng)

## Lưu ý

- Hash Secret cũ: `L5CM7EQC41E7JFZWJIRP7XKGRDFTIIMP` ❌
- Hash Secret mới: `HCE60T7GQYDZUJJ216XKP1Z8KHZN69PX` ✅

**Đây chính là nguyên nhân lỗi Code 70 "Invalid signature"!**

