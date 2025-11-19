# 🔧 Hướng dẫn sửa lỗi Code 70 - VNPay Invalid Signature

## ⚠️ Vấn đề
Lỗi Code 70 "Sai chữ ký" do VNPay sandbox **KHÔNG chấp nhận localhost** trong Return URL.

## ✅ Giải pháp: Dùng Ngrok

### Bước 1: Cài đặt Ngrok (nếu chưa có)

```bash
npm install -g ngrok
```

Hoặc dùng npx (không cần cài):
```bash
npx ngrok http 8081
```

### Bước 2: Chạy Ngrok

**Mở Terminal mới** (giữ nguyên terminal đang chạy server):

```bash
npx ngrok http 8081
```

**Kết quả sẽ hiện:**
```
Session Status                online
Account                       (Plan: Free)
Version                       3.x.x
Region                        Asia Pacific (ap)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8081
```

**Copy URL ngrok** (dòng `Forwarding`):
```
https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

⚠️ **LƯU Ý:** Không đóng terminal này! Giữ ngrok chạy khi test.

### Bước 3: Cập nhật file .env

1. Mở file `.env` trong root project
2. Tìm hoặc thêm dòng:
   ```env
   VNPAY_BASE_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
   ```

**Ví dụ:**
```env
# Trước (sai)
VNPAY_BASE_URL=http://localhost:8081

# Sau (đúng)
VNPAY_BASE_URL=https://a1b2c3d4-5678-90ab-cdef-1234567890ab.ngrok-free.app
```

**Lưu ý:**
- ✅ Dùng `https://` (không phải `http://`)
- ✅ Không có dấu `/` ở cuối URL
- ✅ Copy đúng URL từ ngrok (bao gồm `https://`)

### Bước 4: Restart Server

**Dừng server hiện tại** (Ctrl+C) và chạy lại:

```bash
npm run dev
```

### Bước 5: Test lại

1. Gọi API đặt cọc 10% từ Swagger
2. Kiểm tra log console - phải thấy:
   ```
   vnp_ReturnUrl (original): https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/payment/appointment-deposit-return
   ```
   ✅ **KHÔNG còn warning về localhost!**

3. Mở `paymentUrl` từ response → Thanh toán test
4. ✅ **Sẽ không còn lỗi Code 70!**

## 📋 Checklist

- [ ] Đã chạy ngrok: `npx ngrok http 8081`
- [ ] Đã copy URL ngrok (dạng `https://xxxx-xx-xx-xx-xx.ngrok-free.app`)
- [ ] Đã cập nhật `.env` với `VNPAY_BASE_URL=https://...`
- [ ] Đã restart server: `npm run dev`
- [ ] Đã test lại API đặt cọc
- [ ] Log không còn warning về localhost
- [ ] Thanh toán thành công (không còn Code 70)

## 🚨 Lưu ý quan trọng

1. **Ngrok URL thay đổi mỗi lần chạy** (trừ khi dùng account có tên miền cố định)
   - Mỗi lần restart ngrok → URL mới → Cần cập nhật lại `.env`

2. **Giữ ngrok chạy khi test**
   - Đóng terminal ngrok → URL không hoạt động → Lỗi lại

3. **Production**
   - Không dùng ngrok cho production
   - Dùng domain thật và đăng ký Return URL trong VNPay merchant portal

## 🔍 Debug

Nếu vẫn lỗi sau khi dùng ngrok:

1. Kiểm tra `.env`:
   ```bash
   cat .env | grep VNPAY
   ```

2. Kiểm tra log console khi gọi API:
   - `vnp_ReturnUrl (original)` phải là ngrok URL
   - Không còn warning về localhost

3. Kiểm tra ngrok đang chạy:
   - Mở http://127.0.0.1:4040 (ngrok web interface)
   - Xem requests có đến không

## 📞 Hỗ trợ

Nếu vẫn không được:
- Email VNPay: hotrovnpay@vnpay.vn
- Cung cấp: vnp_TmnCode, vnp_ReturnUrl, vnp_TxnRef từ log

