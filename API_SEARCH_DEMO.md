# API Search & Filter Demo

## 🎯 API Endpoints mới đã tạo

### 1. **GET /api/listings** - Tìm kiếm và lọc sản phẩm
API công khai để tìm kiếm sản phẩm đã được admin duyệt với các bộ lọc và phân trang.

#### Query Parameters:
- `keyword` (string): Từ khóa tìm kiếm (hãng, model, ghi chú)
- `make` (string): Hãng xe
- `model` (string): Model xe  
- `year` (number): Năm sản xuất
- `batteryCapacityKWh` (number): Dung lượng pin (kWh)
- `mileageKm` (number): Số km đã chạy (tối đa)
- `minPrice` (number): Giá tối thiểu
- `maxPrice` (number): Giá tối đa
- `city` (string): Thành phố
- `district` (string): Quận/huyện
- `condition` (string): Tình trạng xe (New, LikeNew, Used, Worn)
- `sortBy` (string): Sắp xếp (newest, oldest, price_low, price_high, reputation)
- `page` (number): Trang hiện tại (default: 1)
- `limit` (number): Số sản phẩm mỗi trang (default: 12)

#### Response:
```json
{
  "listings": [
    {
      "_id": "...",
      "sellerId": {
        "_id": "...",
        "fullName": "Nguyễn Văn A",
        "phone": "0123456789",
        "avatar": "..."
      },
      "type": "Car",
      "make": "Tesla",
      "model": "Model 3",
      "year": 2022,
      "batteryCapacityKWh": 75,
      "mileageKm": 15000,
      "condition": "LikeNew",
      "photos": [...],
      "location": {
        "city": "Hồ Chí Minh",
        "district": "Quận 1",
        "address": "123 Nguyễn Huệ"
      },
      "priceListed": 25000,
      "tradeMethod": "meet",
      "status": "Published",
      "publishedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 50,
    "hasNextPage": true,
    "hasPrevPage": false,
    "limit": 12
  },
  "filters": {
    "keyword": "tesla",
    "make": "Tesla",
    "sortBy": "newest"
  }
}
```

### 2. **GET /api/listings/{id}** - Lấy chi tiết sản phẩm
API công khai để xem chi tiết một sản phẩm đã được duyệt.

#### Path Parameters:
- `id` (string): ID của sản phẩm (MongoDB ObjectId)

#### Response:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "sellerId": {
    "_id": "507f1f77bcf86cd799439012",
    "fullName": "Nguyễn Văn A",
    "phone": "0123456789",
    "email": "nguyenvana@email.com",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "type": "Car",
  "make": "Tesla",
  "model": "Model 3",
  "year": 2022,
  "batteryCapacityKWh": 75,
  "mileageKm": 15000,
  "chargeCycles": 200,
  "condition": "LikeNew",
  "photos": [
    {
      "url": "/uploads/photo1.jpg",
      "kind": "photo"
    },
    {
      "url": "/uploads/photo2.jpg", 
      "kind": "photo"
    }
  ],
  "documents": [
    {
      "url": "/uploads/registration.pdf",
      "kind": "doc"
    }
  ],
  "location": {
    "city": "Hồ Chí Minh",
    "district": "Quận 1",
    "address": "123 Nguyễn Huệ"
  },
  "priceListed": 25000,
  "tradeMethod": "meet",
  "status": "Published",
  "notes": "Xe được bảo dưỡng định kỳ",
  "publishedAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-10T08:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### Error Responses:
- **400**: ID không hợp lệ
- **404**: Sản phẩm không tồn tại hoặc chưa được duyệt

### 3. **GET /api/listings/filter-options** - Lấy danh sách filter options
API để lấy các giá trị có thể chọn cho dropdown filter.

#### Response:
```json
{
  "makes": ["Tesla", "BMW", "Mercedes", "Audi"],
  "models": ["Model 3", "Model S", "Model X", "i3", "iX"],
  "years": [2024, 2023, 2022, 2021, 2020],
  "batteryCapacities": [40, 50, 60, 75, 100],
  "conditions": ["New", "LikeNew", "Used", "Worn"],
  "cities": ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng"],
  "districts": ["Quận 1", "Quận 2", "Quận 3"],
  "priceRange": {
    "min": 5000,
    "max": 100000
  }
}
```

## 🚀 Cách sử dụng

### Ví dụ 1: Tìm kiếm cơ bản
```bash
GET /api/listings?keyword=tesla&page=1&limit=10
```

### Ví dụ 2: Lọc theo hãng và giá
```bash
GET /api/listings?make=Tesla&minPrice=20000&maxPrice=50000&sortBy=price_low
```

### Ví dụ 3: Lọc theo vị trí và tình trạng
```bash
GET /api/listings?city=Hồ Chí Minh&district=Quận 1&condition=LikeNew&sortBy=newest
```

### Ví dụ 4: Lọc theo dung lượng pin và số km
```bash
GET /api/listings?batteryCapacityKWh=75&mileageKm=20000&year=2022
```

### Ví dụ 5: Lấy chi tiết sản phẩm
```bash
GET /api/listings/507f1f77bcf86cd799439011
```

## ✨ Tính năng đã implement

### 🔍 **Tìm kiếm:**
- Tìm kiếm theo từ khóa trong hãng, model, ghi chú
- Case-insensitive search

### 🎛️ **Bộ lọc:**
- **Hãng xe** (make)
- **Model xe** (model)  
- **Năm sản xuất** (year)
- **Dung lượng pin** (batteryCapacityKWh)
- **Số km đã chạy** (mileageKm) - tối đa
- **Phạm vi giá** (minPrice, maxPrice)
- **Vị trí** (city, district)
- **Tình trạng** (condition)

### 📊 **Sắp xếp:**
- **Mới nhất** (newest) - theo publishedAt
- **Cũ nhất** (oldest) - theo publishedAt
- **Giá thấp** (price_low) - theo priceListed tăng dần
- **Giá cao** (price_high) - theo priceListed giảm dần  
- **Độ uy tín** (reputation) - tạm thời theo publishedAt

### 📄 **Phân trang:**
- Pagination với thông tin đầy đủ
- Có thể tùy chỉnh số items per page
- Thông tin hasNextPage, hasPrevPage

### 🔒 **Bảo mật:**
- Chỉ hiển thị sản phẩm có status = "Published"
- Populate thông tin seller (fullName, phone, avatar)
- API công khai (không cần authentication)

## 🛠️ **Cách test:**

1. **Khởi động server:**
```bash
npm run dev
```

2. **Truy cập Swagger UI:**
```
http://localhost:5000/api-docs
```

3. **Test API trực tiếp:**
```bash
# Lấy filter options
curl http://localhost:5000/api/listings/filter-options

# Tìm kiếm cơ bản
curl "http://localhost:5000/api/listings?keyword=tesla&page=1&limit=5"

# Lọc theo hãng và giá
curl "http://localhost:5000/api/listings?make=Tesla&minPrice=20000&maxPrice=50000"

# Lấy chi tiết sản phẩm (thay ID bằng ID thật)
curl "http://localhost:5000/api/listings/507f1f77bcf86cd799439011"
```

## 📝 **Ghi chú:**
- API chỉ trả về sản phẩm đã được admin duyệt (status = "Published")
- Tất cả filter đều là optional
- Default sort là "newest"
- Default pagination: page=1, limit=12
- Response bao gồm thông tin pagination và filters đã áp dụng
- API chi tiết sản phẩm bao gồm đầy đủ thông tin seller (fullName, phone, email, avatar)
- Validation ObjectId format cho API chi tiết
- Có thể mở rộng thêm view count tracking trong tương lai
