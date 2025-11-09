# [TRANSACTION_HISTORY_FEATURE] - Hướng dẫn xóa tính năng

File này hướng dẫn cách xóa tính năng lịch sử giao dịch nếu không muốn dùng nữa.

## Các file đã tạo/sửa

### 1. File mới (có thể xóa hoàn toàn):

- `src/services/transactionHistoryService.ts` - Service xử lý lịch sử giao dịch

### 2. File đã sửa (cần revert về code cũ):

#### `src/controllers/transactionController.ts`

- **Import mới** (dòng 7-9): Xóa import `transactionHistoryService`
- **Function `getUserTransactionHistory`** (dòng 204-279):
  - Xóa phần code mới (dòng 217-237)
  - Uncomment phần code cũ (dòng 239-269)
- **Function `getAdminTransactionHistory`** (dòng 281-382):
  - Xóa phần code mới (dòng 295-313)
  - Uncomment phần code cũ (dòng 315-372)
- **Function `getUserTransactionStats`** (dòng 384-429): Xóa toàn bộ function này

#### `src/routes/transactionRoutes.ts`

- **Import mới** (dòng 9-11): Xóa import `getUserTransactionStats`
- **Route `/user/history`** (dòng 166-189):
  - Xóa comment `[TRANSACTION_HISTORY_FEATURE]`
  - Cập nhật lại Swagger docs về format cũ
- **Route `/user/stats`** (dòng 169-254): Xóa toàn bộ route này
- **Route `/admin/history`** (dòng 256-332):
  - Xóa comment `[TRANSACTION_HISTORY_FEATURE]`
  - Cập nhật lại Swagger docs về format cũ

## Các bước xóa tính năng

### Bước 1: Xóa file service

```bash
rm src/services/transactionHistoryService.ts
```

### Bước 2: Revert controller

1. Mở `src/controllers/transactionController.ts`
2. Xóa dòng import `transactionHistoryService` (dòng 7-9)
3. Trong `getUserTransactionHistory`:
   - Xóa code từ dòng 217-237
   - Uncomment code từ dòng 239-269
4. Trong `getAdminTransactionHistory`:
   - Xóa code từ dòng 295-313
   - Uncomment code từ dòng 315-372
5. Xóa function `getUserTransactionStats` (dòng 384-429)

### Bước 3: Revert routes

1. Mở `src/routes/transactionRoutes.ts`
2. Xóa import `getUserTransactionStats` (dòng 9-11)
3. Xóa route `/user/stats` (dòng 169-254)
4. Xóa các comment `[TRANSACTION_HISTORY_FEATURE]` trong routes còn lại
5. Cập nhật lại Swagger docs về format cũ (xóa phần stats trong response)

### Bước 4: Xóa file hướng dẫn này

```bash
rm TRANSACTION_HISTORY_FEATURE_REMOVAL_GUIDE.md
```

## Lưu ý

- Tất cả code mới đều được đánh dấu bằng `[TRANSACTION_HISTORY_FEATURE]`
- Code cũ được giữ lại trong comment để dễ restore
- Sau khi xóa, các endpoint `/api/transactions/user/history` và `/api/transactions/admin/history` sẽ trả về format cũ (không có stats)
- Endpoint `/api/transactions/user/stats` sẽ không còn nữa

## Test sau khi xóa

Sau khi xóa, test lại các endpoint:

- `GET /api/transactions/user/history` - Phải trả về format cũ
- `GET /api/transactions/admin/history` - Phải trả về format cũ
- `GET /api/transactions/user/stats` - Phải trả về 404 (không tồn tại)
