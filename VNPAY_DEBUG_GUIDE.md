# Hướng dẫn Debug VNPay Code 70 "Invalid Signature"

## ✅ Vấn đề đã xác định

Từ log debug, vấn đề rõ ràng là:
- **Return URL là localhost**: `http://localhost:8081/api/payment/appointment-deposit-return`
- **VNPay sandbox KHÔNG chấp nhận localhost** trong Return URL
- Hash secret và cách tính hash đều **ĐÚNG**
- Vấn đề là VNPay không thể redirect về localhost từ server của họ

## Nguyên nhân

### 1. Return URL localhost không được chấp nhận
VNPay sandbox có thể reject localhost trong Return URL, dẫn đến lỗi "Invalid signature" ngay cả khi hash đúng.

### 2. Hash Secret không đúng
Kiểm tra `.env` file có đúng:
```
VNPAY_TMN_CODE=UY28ABIO
VNPAY_HASH_SECRET=L5CM7EQC41E7JFZWJIRP7XKGRDFTIIMP
```

### 3. Cách tính hash sai
Đã kiểm tra và code giống với wallet service (đã hoạt động).

## Giải pháp

### Bước 1: Dùng Ngrok (KHUYẾN NGHỊ - BẮT BUỘC)

**Cách 1: Dùng script (nhanh nhất)**
```bash
# Windows
setup-ngrok.bat

# Linux/Mac
chmod +x setup-ngrok.sh
./setup-ngrok.sh
```

**Cách 2: Chạy thủ công**
```bash
# Terminal mới (KHÔNG đóng terminal này)
npx ngrok http 8081
```

**Kết quả sẽ hiện:**
```
Forwarding: https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8081
```

**Copy URL ngrok** (dạng: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`)

### Bước 2: Cập nhật .env

Mở file `.env` và thêm/sửa dòng:
```env
VNPAY_BASE_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

**Lưu ý quan trọng:**
- ✅ Dùng `https://` (không phải `http://`)
- ✅ Không có dấu `/` ở cuối URL
- ✅ Copy đúng URL từ ngrok (bao gồm `https://`)

**Ví dụ đúng:**
```env
VNPAY_BASE_URL=https://a1b2c3d4-5678-90ab-cdef-1234567890ab.ngrok-free.app
```

**Ví dụ sai:**
```env
VNPAY_BASE_URL=http://a1b2c3d4...ngrok-free.app  ❌ (thiếu s)
VNPAY_BASE_URL=https://a1b2c3d4...ngrok-free.app/  ❌ (có dấu / ở cuối)
```

### Bước 3: Restart server

```bash
npm run dev
```

### Bước 4: Test lại

1. **Gọi API đặt cọc 10%** từ Swagger hoặc Postman

2. **Kiểm tra log console** - phải thấy:
```
vnp_ReturnUrl (original): https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/payment/appointment-deposit-return
```
✅ **KHÔNG còn warning về localhost!**

3. **Kiểm tra paymentUrl** trong response - mở URL đó trong browser

4. **Thanh toán test** - sẽ không còn lỗi Code 70

**Log mẫu khi thành công:**
```
=== Deposit 10% Payment Debug ===
vnp_TmnCode: UY28ABIO
vnp_ReturnUrl (encoded): https%3A%2F%2Fxxxx-xx-xx-xx-xx.ngrok-free.app%2Fapi%2Fpayment%2Fappointment-deposit-return
vnp_ReturnUrl (original): https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/payment/appointment-deposit-return
vnp_Amount: 450000000
vnp_TxnRef: 119ee179599a_19122743
Sign Data (first 100 chars): vnp_Amount=450000000&vnp_Command=pay&vnp_CreateDate=20251119122743...
Hash Secret (first 10 chars): L5CM7EQC41...
Signed Hash (first 20 chars): 1ae2292a89bd827d4f08...
```

## Kiểm tra Hash Secret

Nếu vẫn lỗi sau khi dùng ngrok:

1. Kiểm tra `.env` file:
   ```bash
   cat .env | grep VNPAY
   ```

2. Đảm bảo không có khoảng trắng thừa:
   ```
   VNPAY_TMN_CODE=UY28ABIO
   VNPAY_HASH_SECRET=L5CM7EQC41E7JFZWJIRP7XKGRDFTIIMP
   ```

3. Restart server sau khi sửa `.env`

## So sánh với Wallet Service

Wallet service đang hoạt động vì:
- Dùng cùng hash secret
- Dùng cùng cách tính hash
- Return URL có thể đã được đăng ký trong VNPay merchant portal

## Debug Log

Khi gọi API đặt cọc, check console log:
- `vnp_ReturnUrl` phải là ngrok URL (không phải localhost)
- `Hash Secret` phải đúng
- `Signed Hash` phải được tính đúng

## Liên hệ VNPay Support

Nếu vẫn lỗi sau khi dùng ngrok:
- Email: hotrovnpay@vnpay.vn
- Mã tra cứu: (xem trong error page)
- Cung cấp: vnp_TmnCode, vnp_ReturnUrl, vnp_TxnRef

