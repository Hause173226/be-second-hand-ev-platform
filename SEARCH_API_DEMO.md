# Search API Demo - Hướng dẫn sử dụng API tìm kiếm

## Tổng quan
API này cung cấp các chức năng để lưu lịch sử tìm kiếm và gợi ý kết quả cho người dùng trong hệ thống bán xe điện cũ.

## Các API Endpoints

### 1. Lưu lịch sử tìm kiếm
**POST** `/api/search/history/save`

Lưu lịch sử tìm kiếm của người dùng.

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
  "resultsCount": 15,
  "filters": {
    "brand": "Tesla",
    "model": "Model 3",
    "priceMin": 500000000,
    "priceMax": 2000000000,
    "location": "Hồ Chí Minh"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Search history saved successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "userId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "searchQuery": "Tesla Model 3",
    "searchType": "listing",
    "filters": {
      "brand": "Tesla",
      "model": "Model 3",
      "priceMin": 500000000,
      "priceMax": 2000000000,
      "location": "Hồ Chí Minh"
    },
    "resultsCount": 15,
    "searchDate": "2024-01-15T10:30:00.000Z",
    "isSuccessful": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Lấy lịch sử tìm kiếm của user
**GET** `/api/search/history?limit=10&searchType=listing`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Số lượng kết quả trả về (default: 10)
- `searchType` (optional): Lọc theo loại tìm kiếm (listing, user, general)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "userId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "searchQuery": "Tesla Model 3",
      "searchType": "listing",
      "resultsCount": 15,
      "searchDate": "2024-01-15T10:30:00.000Z",
      "isSuccessful": true
    }
  ]
}
```

### 3. Lấy gợi ý tìm kiếm phổ biến
**GET** `/api/search/suggestions/popular?limit=10`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "query": "Tesla Model 3",
      "count": 150,
      "lastSearched": "2024-01-15T10:30:00.000Z",
      "category": "popular"
    },
    {
      "query": "VinFast VF8",
      "count": 120,
      "lastSearched": "2024-01-15T09:15:00.000Z",
      "category": "popular"
    }
  ]
}
```

### 4. Lấy gợi ý tìm kiếm gần đây của user
**GET** `/api/search/suggestions/recent?limit=5`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "query": "Tesla Model 3",
      "count": 1,
      "lastSearched": "2024-01-15T10:30:00.000Z",
      "category": "recent"
    },
    {
      "query": "VinFast VF8",
      "count": 1,
      "lastSearched": "2024-01-15T09:15:00.000Z",
      "category": "recent"
    }
  ]
}
```

### 5. Tìm kiếm gợi ý dựa trên từ khóa
**GET** `/api/search/suggestions/keyword?keyword=tesla&limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "query": "Tesla Model 3",
      "count": 150,
      "lastSearched": "2024-01-15T10:30:00.000Z",
      "category": "trending"
    },
    {
      "query": "Tesla Model S",
      "count": 80,
      "lastSearched": "2024-01-15T08:45:00.000Z",
      "category": "trending"
    }
  ]
}
```

### 6. Lấy tất cả gợi ý (kết hợp popular, recent, trending)
**GET** `/api/search/suggestions?keyword=tesla&limit=10`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "query": "Tesla Model 3",
      "count": 150,
      "lastSearched": "2024-01-15T10:30:00.000Z",
      "category": "popular"
    },
    {
      "query": "Tesla Model S",
      "count": 80,
      "lastSearched": "2024-01-15T08:45:00.000Z",
      "category": "trending"
    }
  ]
}
```

### 7. Lấy thống kê tìm kiếm
**GET** `/api/search/stats`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSearches": 1250,
    "successfulSearches": 1100,
    "successRate": 88.0,
    "averageResults": 12.5,
    "uniqueQueryCount": 450
  }
}
```

### 8. Xóa lịch sử tìm kiếm của user
**DELETE** `/api/search/history/clear`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Cleared 25 search history records",
  "data": {
    "deletedCount": 25
  }
}
```

## Cách tích hợp vào Frontend

### 1. Lưu lịch sử tìm kiếm khi user tìm kiếm
```javascript
// Khi user thực hiện tìm kiếm
const saveSearchHistory = async (searchQuery, filters, resultsCount) => {
  try {
    await fetch('/api/search/history/save', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        searchQuery,
        searchType: 'listing',
        resultsCount,
        filters
      })
    });
  } catch (error) {
    console.error('Error saving search history:', error);
  }
};
```

### 2. Lấy gợi ý tìm kiếm cho autocomplete
```javascript
// Lấy gợi ý khi user gõ
const getSuggestions = async (keyword) => {
  try {
    const response = await fetch(`/api/search/suggestions?keyword=${keyword}&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }
};
```

### 3. Hiển thị lịch sử tìm kiếm
```javascript
// Lấy lịch sử tìm kiếm gần đây
const getRecentSearches = async () => {
  try {
    const response = await fetch('/api/search/history?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return [];
  }
};
```

## Lưu ý quan trọng

1. **Authentication**: Hầu hết các API đều yêu cầu xác thực (Bearer token)
2. **Rate Limiting**: Nên implement rate limiting để tránh spam
3. **Data Privacy**: Lịch sử tìm kiếm được lưu theo userId, đảm bảo privacy
4. **Performance**: API sử dụng MongoDB aggregation để tối ưu hiệu suất
5. **Cleanup**: Có thể setup cron job để xóa lịch sử cũ (older than 90 days)

## Swagger Documentation

Truy cập `/api-docs` để xem documentation đầy đủ với Swagger UI.
