# Hướng dẫn Test Transaction History API (Đơn giản)

## Yêu cầu

1. Server đang chạy (thường là `http://localhost:3000`)
2. JWT Token hợp lệ (đăng nhập để lấy token)
3. Có dữ liệu giao dịch trong database

---

## 1. Test User xem giao dịch của mình

### Endpoint: `GET /api/transactions/user/history`

#### Test cơ bản (lấy tất cả giao dịch của user)
```bash
curl -X GET "http://localhost:3000/api/transactions/user/history" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Test với filter status
```bash
curl -X GET "http://localhost:3000/api/transactions/user/history?status=COMPLETED" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test với pagination
```bash
curl -X GET "http://localhost:3000/api/transactions/user/history?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response mẫu:
```json
{
  "success": true,
  "data": [
    {
      "id": "appointment_id",
      "type": "buyer",
      "status": "COMPLETED",
      "listing": {
        "id": "listing_id",
        "title": "Xe điện ABC",
        "make": "Honda",
        "model": "Lead",
        "year": 2023,
        "priceListed": 50000000,
        "images": []
      },
      "contract": {
        "id": "contract_id",
        "status": "COMPLETED",
        "contractNumber": "CT-1234567890"
      },
      "depositRequest": {
        "id": "deposit_id",
        "depositAmount": 5000000,
        "status": "COMPLETED"
      },
      "counterparty": {
        "id": "seller_id",
        "name": "Nguyễn Văn A",
        "email": "seller@example.com"
      },
      "dates": {
        "createdAt": "2024-01-01T00:00:00.000Z",
        "scheduledDate": "2024-01-05T00:00:00.000Z",
        "completedAt": "2024-01-05T00:00:00.000Z"
      },
      "amount": {
        "deposit": 5000000,
        "total": 50000000
      },
      "appointmentId": "appointment_id"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 1,
    "total": 5,
    "limit": 10
  }
}
```

---

## 2. Test Admin xem tất cả giao dịch

### Endpoint: `GET /api/transactions/admin/history`

#### Test cơ bản (lấy tất cả giao dịch)
```bash
curl -X GET "http://localhost:3000/api/transactions/admin/history" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Test với filter status
```bash
curl -X GET "http://localhost:3000/api/transactions/admin/history?status=COMPLETED" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

#### Test với filter buyerId
```bash
curl -X GET "http://localhost:3000/api/transactions/admin/history?buyerId=USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

#### Test với filter sellerId
```bash
curl -X GET "http://localhost:3000/api/transactions/admin/history?sellerId=USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

#### Test với pagination
```bash
curl -X GET "http://localhost:3000/api/transactions/admin/history?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

#### Response mẫu:
```json
{
  "success": true,
  "data": [
    {
      "id": "appointment_id",
      "type": "buyer",
      "status": "COMPLETED",
      "listing": {...},
      "contract": {...},
      "depositRequest": {...},
      "counterparty": {...},
      "dates": {...},
      "amount": {...},
      "appointmentId": "..."
    }
    // ... nhiều giao dịch khác
  ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 100,
    "limit": 20
  }
}
```

---

## 3. Test xem chi tiết giao dịch

### Endpoint: `GET /api/transactions/:appointmentId`

#### Test
```bash
curl -X GET "http://localhost:3000/api/transactions/APPOINTMENT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Response mẫu:
```json
{
  "success": true,
  "data": {
    "appointment": {...},
    "contract": {...},
    "depositRequest": {...},
    "listing": {...}
  }
}
```

---

## Test với Postman

### Setup Postman

1. Tạo Collection mới: `Transaction History API`
2. Tạo Environment với variables:
   - `base_url`: `http://localhost:3000`
   - `token`: JWT token của bạn
   - `admin_token`: JWT token của admin

### Request 1: User History
- Method: `GET`
- URL: `{{base_url}}/api/transactions/user/history`
- Headers:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- Query Params (optional):
  - `status`: `COMPLETED`
  - `page`: `1`
  - `limit`: `10`

### Request 2: Admin History
- Method: `GET`
- URL: `{{base_url}}/api/transactions/admin/history`
- Headers:
  - `Authorization`: `Bearer {{admin_token}}`
  - `Content-Type`: `application/json`
- Query Params (optional):
  - `status`: `COMPLETED`
  - `buyerId`: `USER_ID`
  - `sellerId`: `USER_ID`
  - `page`: `1`
  - `limit`: `20`

### Request 3: Transaction Details
- Method: `GET`
- URL: `{{base_url}}/api/transactions/:appointmentId`
- Headers:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- Params:
  - `appointmentId`: `APPOINTMENT_ID`

---

## Test với JavaScript/Node.js

Tạo file `test-simple.js`:

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'YOUR_JWT_TOKEN';
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN';

// Test 1: User xem giao dịch của mình
async function testUserHistory() {
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/user/history`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        status: 'COMPLETED',
        page: 1,
        limit: 10
      }
    });
    
    console.log('✅ User History:', response.data);
    console.log(`   - Total: ${response.data.data.length} transactions`);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test 2: Admin xem tất cả giao dịch
async function testAdminHistory() {
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/admin/history`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 20
      }
    });
    
    console.log('✅ Admin History:', response.data);
    console.log(`   - Total: ${response.data.data.length} transactions`);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test 3: Xem chi tiết giao dịch
async function testTransactionDetails(appointmentId) {
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/${appointmentId}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Transaction Details:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Testing Transaction History API...\n');
  
  await testUserHistory();
  await testAdminHistory();
  // await testTransactionDetails('APPOINTMENT_ID');
  
  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);
```

Chạy test:
```bash
node test-simple.js
```

---

## Test với Swagger UI

1. Mở Swagger UI: `http://localhost:3000/api-docs`
2. Tìm section "Transactions"
3. Chọn endpoint cần test:
   - `GET /api/transactions/user/history`
   - `GET /api/transactions/admin/history`
   - `GET /api/transactions/{appointmentId}`
4. Click "Try it out"
5. Nhập parameters (nếu có)
6. Click "Authorize" và nhập JWT token
7. Click "Execute"

---

## Kiểm tra Response

### Response hợp lệ phải có:
- ✅ `success: true`
- ✅ `data`: Array các transaction objects
- ✅ `pagination`: Object chứa thông tin phân trang

### Mỗi transaction object phải có:
- ✅ `id`: Appointment ID
- ✅ `type`: "buyer" hoặc "seller"
- ✅ `status`: Trạng thái giao dịch
- ✅ `listing`: Thông tin listing
- ✅ `contract`: Thông tin contract (nếu có)
- ✅ `depositRequest`: Thông tin deposit request
- ✅ `counterparty`: Thông tin đối tác
- ✅ `dates`: Các ngày quan trọng
- ✅ `amount`: Số tiền (deposit và total)
- ✅ `appointmentId`: Appointment ID

---

## Lỗi thường gặp

### 401 Unauthorized
- **Nguyên nhân**: Token không hợp lệ hoặc đã hết hạn
- **Giải pháp**: Đăng nhập lại để lấy token mới

### 403 Forbidden
- **Nguyên nhân**: Không có quyền truy cập (admin endpoints cần role admin/staff)
- **Giải pháp**: Sử dụng token của admin/staff

### 404 Not Found
- **Nguyên nhân**: Endpoint không tồn tại hoặc appointmentId không tồn tại
- **Giải pháp**: Kiểm tra URL và appointmentId

### 500 Internal Server Error
- **Nguyên nhân**: Lỗi server
- **Giải pháp**: Kiểm tra logs server

---

## Tips

1. **Lưu token vào environment variables** trong Postman để không phải nhập lại
2. **Test từng endpoint một** để dễ debug
3. **Kiểm tra response structure** đúng với format mong đợi
4. **Test với dữ liệu thực** trong database để có kết quả chính xác
5. **Sử dụng Swagger UI** để test nhanh và xem response format

