# Hướng dẫn cấu hình VNPay để fix lỗi Code 71

## Vấn đề
Lỗi VNPay Code 71 "Website này chưa được phê duyệt" xảy ra vì:
- Return URL dùng `localhost` không được VNPay sandbox chấp nhận
- Hoặc Return URL chưa được đăng ký trong VNPay merchant portal

## Giải pháp

### Cách 1: Dùng Ngrok (Khuyến nghị cho development)

1. **Cài đặt ngrok:**
   ```bash
   npm install -g ngrok
   # hoặc
   npx ngrok http 8081
   ```

2. **Chạy ngrok:**
   ```bash
   ngrok http 8081
   ```

3. **Copy URL từ ngrok** (ví dụ: `https://abc123.ngrok.io`)

4. **Thêm vào file `.env`:**
   ```env
   VNPAY_BASE_URL=https://abc123.ngrok.io
   ```

5. **Restart server**

### Cách 2: Đăng ký Return URL trong VNPay Merchant Portal

1. Đăng nhập vào VNPay Merchant Portal (sandbox)
2. Vào phần **Cấu hình** → **Return URL**
3. Đăng ký các Return URL sau:
   - `http://localhost:8081/api/payment/wallet/vnpay-return`
   - `http://localhost:8081/api/payment/deposit/vnpay-return`
   - `http://localhost:8081/api/payment/full/vnpay-return`
   - `http://localhost:8081/api/payment/vnpay-return`

### Cách 3: Dùng Public Domain (Production)

1. Deploy backend lên server có public domain
2. Thêm vào file `.env`:
   ```env
   VNPAY_BASE_URL=https://your-domain.com
   ```

## Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# VNPay Configuration
VNPAY_BASE_URL=http://localhost:8081
# Hoặc dùng ngrok:
# VNPAY_BASE_URL=https://abc123.ngrok.io
# Hoặc production domain:
# VNPAY_BASE_URL=https://api.yourdomain.com

# VNPay Credentials (nếu cần thay đổi)
VNPAY_TMN_CODE=UY28ABIO
VNPAY_HASH_SECRET=L5CM7EQC41E7JFZWJIRP7XKGRDFTIIMP
```

## Lưu ý

- **Development**: Dùng ngrok hoặc đăng ký localhost trong VNPay portal
- **Production**: Dùng domain thật và đăng ký trong VNPay merchant portal
- Sau khi thay đổi `VNPAY_BASE_URL`, cần **restart server** để áp dụng

## Test

Sau khi config xong, test lại API:
```bash
POST /api/appointments/{appointmentId}/deposit
```

Nếu vẫn lỗi, kiểm tra:
1. URL trong `VNPAY_BASE_URL` có accessible từ internet không
2. Return URL đã được đăng ký trong VNPay merchant portal chưa
3. Merchant account có quyền sử dụng sandbox không

