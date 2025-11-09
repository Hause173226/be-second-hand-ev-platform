# Giải thích: Cách API lấy userId từ JWT Token

## ❓ Câu hỏi: Tại sao API không có userId trong URL mà vẫn biết user nào đang gọi?

## ✅ Trả lời: JWT Token chứa userId

### Flow hoạt động:

```
1. User đăng nhập → Server tạo JWT token chứa userId
   ↓
2. Client lưu JWT token (localStorage, cookie, ...)
   ↓
3. Client gọi API → Gửi JWT token trong header Authorization
   ↓
4. Middleware authenticate → Decode JWT token → Lấy userId → Set vào req.user.id
   ↓
5. Controller → Lấy userId từ req.user.id → Filter giao dịch theo userId
```

## 📋 Chi tiết từng bước:

### Bước 1: User đăng nhập
```javascript
// Khi user đăng nhập thành công, server tạo JWT token:
const token = jwt.sign(
  { 
    _id: user._id,        // ← userId được encode vào token
    role: user.role,
    email: user.email
  },
  JWT_SECRET
);
// Trả về token cho client
```

### Bước 2: Client gửi request với JWT token
```bash
# Client gửi request với JWT token trong header Authorization
curl -X GET "http://localhost:3000/api/transactions/user/history" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
  # ↑ JWT token chứa userId bên trong
```

### Bước 3: Middleware authenticate decode token
```typescript
// src/middlewares/authenticate.ts
export const authenticate: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Lấy token từ header
  const decoded = jwt.verify(token, JWT_SECRET); // Decode token
  
  // Set userId vào req.user.id
  (req as any).user = {
    id: decoded._id ?? decoded.userId,  // ← userId được lấy từ token
    role: decoded.role,
    ...
  };
  
  next(); // Cho phép request tiếp tục
};
```

### Bước 4: Controller lấy userId từ req.user.id
```typescript
// src/controllers/transactionController.ts
export const getUserTransactionHistory = async (req: Request, res: Response) => {
  // Lấy userId từ req.user.id (đã được set bởi authenticate middleware)
  const userId = req.user?.id || req.user?._id;
  
  // Filter giao dịch theo userId này
  const result = await transactionHistoryService.getUserTransactionHistory(
    userId,  // ← userId từ JWT token
    { status, page, limit }
  );
};
```

### Bước 5: Service filter giao dịch theo userId
```typescript
// src/services/transactionHistoryService.ts
async getUserTransactionHistory(userId: string, filters) {
  // Chỉ lấy giao dịch của user này (buyer hoặc seller)
  const filter = {
    $or: [
      { buyerId: userId },   // ← userId từ JWT token
      { sellerId: userId }   // ← userId từ JWT token
    ]
  };
  
  const appointments = await Appointment.find(filter);
  // ...
}
```

## 🔒 Bảo mật:

1. **JWT token được ký bằng secret key** → Không thể giả mạo
2. **Token có thời hạn** → Tự động hết hạn sau một thời gian
3. **Middleware authenticate bắt buộc** → Không có token = 401 Unauthorized
4. **User chỉ xem được giao dịch của mình** → Filter theo userId từ token

## 🧪 Cách test:

### 1. Đăng nhập để lấy JWT token:
```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  }
}
```

### 2. Dùng token để gọi API:
```bash
curl -X GET "http://localhost:3000/api/transactions/user/history" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Xem log trong console:
```
[Transaction History] User ID từ JWT token: 507f1f77bcf86cd799439011
[Transaction History] Full req.user: {
  "id": "507f1f77bcf86cd799439011",
  "role": "user",
  "email": "user@example.com"
}
```

## 📝 Tóm tắt:

- ✅ **Không cần truyền userId trong URL** vì userId đã có trong JWT token
- ✅ **JWT token được gửi trong header Authorization**
- ✅ **Middleware authenticate tự động decode token và set req.user.id**
- ✅ **Controller lấy userId từ req.user.id để filter giao dịch**
- ✅ **Bảo mật hơn** vì userId không bị lộ trong URL

## ⚠️ Lưu ý:

- Phải gửi JWT token trong header `Authorization: Bearer <token>`
- Token phải còn hiệu lực (chưa hết hạn)
- Token phải được ký bằng đúng JWT_SECRET

