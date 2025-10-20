# API Lịch Sử Tìm Kiếm - Hướng dẫn sử dụng

## Tổng quan
Đã tạo thành công các API quản lý lịch sử tìm kiếm cho hệ thống bán xe điện cũ. Các API này bao gồm:

1. **Lưu lịch sử tìm kiếm** - Tự động lưu khi user tìm kiếm với keyword
2. **Lấy lịch sử tìm kiếm của user** - Xem lịch sử cá nhân
3. **Xóa lịch sử tìm kiếm** - Xóa toàn bộ hoặc từng mục cụ thể
4. **Lịch sử tìm kiếm phổ biến** - Xem các từ khóa được tìm nhiều nhất
5. **Gợi ý tìm kiếm** - Autocomplete dựa trên lịch sử
6. **Thống kê tìm kiếm** - Thống kê hoạt động của user

## Các API Endpoints

### 1. Lưu lịch sử tìm kiếm
**POST** `/api/search/history/save`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "searchQuery": "Tesla Model 3",
  "searchType": "listing",
  "filters": {
    "make": "Tesla",
    "model": "Model 3",
    "minPrice": 500000000,
    "maxPrice": 2000000000,
    "city": "Hồ Chí Minh"
  },
  "resultsCount": 15
}
```

### 2. Lấy lịch sử tìm kiếm của user
**GET** `/api/search/history?limit=10&searchType=listing`

**Headers:**
```
Authorization: Bearer <token>
```

### 3. Xóa tất cả lịch sử tìm kiếm
**DELETE** `/api/search/history/clear`

**Headers:**
```
Authorization: Bearer <token>
```

### 4. Xóa một lịch sử cụ thể
**DELETE** `/api/search/history/{id}`

**Headers:**
```
Authorization: Bearer <token>
```

### 5. Lấy lịch sử tìm kiếm phổ biến
**GET** `/api/search/popular?limit=10&searchType=listing`

### 6. Lấy gợi ý tìm kiếm
**GET** `/api/search/suggestions?keyword=tesla&limit=10`

### 7. Lấy thống kê tìm kiếm
**GET** `/api/search/stats`

**Headers:**
```
Authorization: Bearer <token>
```

## Tích hợp tự động

API `/api/listings` đã được cập nhật để **tự động lưu lịch sử tìm kiếm** khi:
- User đã đăng nhập (có token)
- Có từ khóa tìm kiếm (keyword parameter)
- Tìm kiếm thành công

## Cấu trúc Database

### Model SearchHistory
```typescript
{
  userId: ObjectId,           // ID của user
  searchQuery: string,         // Từ khóa tìm kiếm
  searchType: string,          // Loại tìm kiếm (listing/user/general)
  filters: object,             // Các bộ lọc đã áp dụng
  resultsCount: number,       // Số kết quả tìm được
  searchDate: Date,           // Thời gian tìm kiếm
  isSuccessful: boolean,      // Tìm kiếm có thành công không
  createdAt: Date,
  updatedAt: Date
}
```

## Indexes được tạo
- `{ userId: 1, searchDate: -1 }` - Tối ưu query lịch sử user
- `{ searchQuery: 1, searchType: 1 }` - Tối ưu tìm kiếm từ khóa
- `{ searchDate: -1 }` - Tối ưu sắp xếp theo thời gian

## Swagger Documentation
Tất cả API đã được document đầy đủ trong Swagger UI tại `/api-docs`

## Cách sử dụng trong Frontend

### 1. Tự động lưu lịch sử khi tìm kiếm
```javascript
// API /api/listings sẽ tự động lưu lịch sử nếu user đã đăng nhập
const searchListings = async (keyword, filters) => {
  const response = await fetch(`/api/listings?keyword=${keyword}&${new URLSearchParams(filters)}`, {
    headers: {
      'Authorization': `Bearer ${token}` // Quan trọng: cần token để lưu lịch sử
    }
  });
  return response.json();
};
```

### 2. Lấy lịch sử tìm kiếm để hiển thị
```javascript
const getSearchHistory = async () => {
  const response = await fetch('/api/search/history?limit=10', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### 3. Lấy gợi ý cho autocomplete
```javascript
const getSuggestions = async (keyword) => {
  const response = await fetch(`/api/search/suggestions?keyword=${keyword}&limit=5`);
  return response.json();
};
```

### 4. Lấy từ khóa phổ biến
```javascript
const getPopularSearches = async () => {
  const response = await fetch('/api/search/popular?limit=10');
  return response.json();
};
```

## Lưu ý quan trọng

1. **Authentication**: Hầu hết API cần token để xác thực user
2. **Tự động lưu**: API `/api/listings` tự động lưu lịch sử nếu có keyword và user đã đăng nhập
3. **Performance**: Đã tạo indexes để tối ưu hóa performance
4. **Error Handling**: Lưu lịch sử không làm fail API chính nếu có lỗi
5. **Privacy**: User chỉ có thể xem/xóa lịch sử của chính mình

## Testing

Có thể test các API bằng:
1. Swagger UI tại `/api-docs`
2. Postman với các endpoint trên
3. Frontend integration như ví dụ trên

Tất cả API đã sẵn sàng để sử dụng!
