# HƯỚNG DẪN API LẤY DANH SÁCH PHIÊN ĐẤU GIÁ

## 📋 TỔNG QUAN

API cung cấp 4 endpoints để lấy danh sách phiên đấu giá theo các trạng thái khác nhau:

1. **Đang diễn ra** - Phiên đang trong thời gian đấu giá
2. **Sắp diễn ra** - Phiên chưa bắt đầu
3. **Đã kết thúc** - Phiên đã hoàn thành
4. **Tất cả** - Lấy tất cả với bộ lọc tùy chỉnh

---

## 🔥 1. LẤY DANH SÁCH PHIÊN ĐANG DIỄN RA

**Endpoint:** `GET /api/auctions/ongoing`

**Điều kiện:**

- `status = "active"`
- `startAt <= now <= endAt`

**Query Parameters:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | integer | 1 | Trang hiện tại |
| `limit` | integer | 10 | Số lượng mỗi trang |

**Request Example:**

```bash
GET /api/auctions/ongoing?page=1&limit=10
```

**Response:**

```json
{
  "auctions": [
    {
      "_id": "auction123",
      "listingId": {
        "_id": "listing123",
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023,
        "priceListed": 800000000,
        "photos": ["url1", "url2"],
        "status": "Published"
      },
      "startAt": "2025-11-07T08:00:00.000Z",
      "endAt": "2025-11-10T18:00:00.000Z",
      "status": "active",
      "startingPrice": 500000000,
      "depositAmount": 50000000,
      "bids": [
        {
          "userId": "user123",
          "price": 520000000,
          "createdAt": "2025-11-07T09:00:00.000Z"
        }
      ],
      "winnerId": null,
      "winningBid": null,
      "createdAt": "2025-11-05T10:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 3,
    "total": 25
  }
}
```

**Sắp xếp:** Theo `startAt` giảm dần (phiên bắt đầu gần nhất lên đầu)

---

## ⏰ 2. LẤY DANH SÁCH PHIÊN SẮP DIỄN RA

**Endpoint:** `GET /api/auctions/upcoming`

**Điều kiện:**

- `status = "active"`
- `startAt > now` (chưa bắt đầu)

**Query Parameters:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | integer | 1 | Trang hiện tại |
| `limit` | integer | 10 | Số lượng mỗi trang |

**Request Example:**

```bash
GET /api/auctions/upcoming?page=1&limit=5
```

**Response:**

```json
{
  "auctions": [
    {
      "_id": "auction456",
      "listingId": {
        "_id": "listing456",
        "make": "BYD",
        "model": "Seal",
        "year": 2024,
        "priceListed": 900000000,
        "photos": ["url1", "url2"],
        "status": "Published"
      },
      "startAt": "2025-11-08T10:00:00.000Z",
      "endAt": "2025-11-12T18:00:00.000Z",
      "status": "active",
      "startingPrice": 600000000,
      "depositAmount": 60000000,
      "bids": [],
      "winnerId": null,
      "winningBid": null,
      "createdAt": "2025-11-05T15:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 2,
    "total": 15
  }
}
```

**Sắp xếp:** Theo `startAt` tăng dần (phiên sắp bắt đầu sớm nhất lên đầu)

---

## ✅ 3. LẤY DANH SÁCH PHIÊN ĐÃ KẾT THÚC

**Endpoint:** `GET /api/auctions/ended`

**Điều kiện:**

- `status = "ended"` HOẶC
- `status = "cancelled"` HOẶC
- `status = "active"` VÀ `endAt < now`

**Query Parameters:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | integer | 1 | Trang hiện tại |
| `limit` | integer | 10 | Số lượng mỗi trang |

**Request Example:**

```bash
GET /api/auctions/ended?page=1&limit=10
```

**Response:**

```json
{
  "auctions": [
    {
      "_id": "auction789",
      "listingId": {
        "_id": "listing789",
        "make": "VinFast",
        "model": "VF8",
        "year": 2023,
        "priceListed": 1000000000,
        "photos": ["url1", "url2"],
        "status": "Sold"
      },
      "startAt": "2025-11-01T10:00:00.000Z",
      "endAt": "2025-11-05T18:00:00.000Z",
      "status": "ended",
      "startingPrice": 700000000,
      "depositAmount": 70000000,
      "bids": [
        {
          "userId": "user123",
          "price": 750000000,
          "createdAt": "2025-11-02T10:00:00.000Z"
        },
        {
          "userId": "user456",
          "price": 800000000,
          "createdAt": "2025-11-03T14:00:00.000Z"
        }
      ],
      "winnerId": {
        "_id": "user456",
        "fullName": "Nguyễn Văn A",
        "avatar": "https://...",
        "email": "user@example.com"
      },
      "winningBid": {
        "userId": {
          "_id": "user456",
          "fullName": "Nguyễn Văn A",
          "avatar": "https://...",
          "email": "user@example.com"
        },
        "price": 800000000,
        "createdAt": "2025-11-03T14:00:00.000Z"
      },
      "createdAt": "2025-10-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 48
  }
}
```

**Sắp xếp:** Theo `endAt` giảm dần (phiên kết thúc gần nhất lên đầu)

---

## 🔍 4. LẤY TẤT CẢ PHIÊN (CÓ BỘ LỌC)

**Endpoint:** `GET /api/auctions/all`

**Query Parameters:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | integer | 1 | Trang hiện tại |
| `limit` | integer | 10 | Số lượng mỗi trang |
| `status` | string | - | Lọc theo status logic: `ongoing`, `upcoming`, `ended` |
| `listingId` | string | - | Lọc theo ID sản phẩm |

**Request Examples:**

### Lấy tất cả phiên đang diễn ra:

```bash
GET /api/auctions/all?status=ongoing&page=1&limit=10
```

### Lấy tất cả phiên sắp diễn ra:

```bash
GET /api/auctions/all?status=upcoming&page=1&limit=10
```

### Lấy tất cả phiên đã kết thúc:

```bash
GET /api/auctions/all?status=ended&page=1&limit=20
```

### Lấy tất cả phiên của 1 sản phẩm:

```bash
GET /api/auctions/all?listingId=673d8f9e5c9f4e0012345678
```

### Lấy tất cả phiên đã kết thúc:

```bash
GET /api/auctions/all?status=ended&page=1&limit=20
```

**Response:** (Tương tự các API trên)

```json
{
  "auctions": [...],
  "pagination": {
    "current": 1,
    "pages": 10,
    "total": 95
  }
}
```

**Filter Logic:**

- `status=ongoing` → `status='active'` AND `startAt <= now <= endAt`
- `status=upcoming` → `status='active'` AND `startAt > now`
- `status=ended` → `status='ended'` OR `status='cancelled'` OR (`status='active'` AND `endAt < now`)

**Sắp xếp:** Theo `createdAt` giảm dần (phiên tạo gần nhất lên đầu)

---

## 📊 SO SÁNH CÁC API

| API         | Điều kiện                                              | Sắp xếp          | Use Case                                      |
| ----------- | ------------------------------------------------------ | ---------------- | --------------------------------------------- |
| `/ongoing`  | `active` + `startAt <= now <= endAt`                   | `startAt DESC`   | Hiển thị phiên đang diễn ra cho user tham gia |
| `/upcoming` | `active` + `startAt > now`                             | `startAt ASC`    | Hiển thị phiên sắp diễn ra để user đăng ký    |
| `/ended`    | `ended` hoặc `cancelled` hoặc `active` + `endAt < now` | `endAt DESC`     | Hiển thị lịch sử đấu giá                      |
| `/all`      | Filter: `ongoing`, `upcoming`, `ended`                 | `createdAt DESC` | Admin xem tổng quan tất cả phiên              |

---

## 🎯 POPULATE FIELDS

Tất cả API đều populate các field sau:

### `listingId` (Thông tin sản phẩm)

```json
{
  "_id": "listing123",
  "make": "Tesla",
  "model": "Model 3",
  "year": 2023,
  "priceListed": 800000000,
  "photos": ["url1", "url2"],
  "status": "Published"
}
```

### `winnerId` (Người thắng cuộc) - Chỉ có ở API `/ended`

```json
{
  "_id": "user456",
  "fullName": "Nguyễn Văn A",
  "avatar": "https://...",
  "email": "user@example.com"
}
```

### `bids.userId` (Người đặt giá)

```json
{
  "_id": "user123",
  "fullName": "Trần Thị B",
  "avatar": "https://..."
}
```

---

## 💡 VÍ DỤ SỬ DỤNG TRONG FRONTEND

### 1. Trang chủ - Hiển thị phiên đang diễn ra:

```javascript
fetch("/api/auctions/ongoing?page=1&limit=6")
  .then((res) => res.json())
  .then((data) => {
    renderAuctionCards(data.auctions);
    renderPagination(data.pagination);
  });
```

### 2. Trang "Sắp diễn ra" - Để user đăng ký trước:

```javascript
fetch("/api/auctions/upcoming?page=1&limit=12")
  .then((res) => res.json())
  .then((data) => {
    renderUpcomingAuctions(data.auctions);
  });
```

### 3. Trang "Lịch sử" - Xem phiên đã kết thúc:

```javascript
fetch("/api/auctions/ended?page=1&limit=10")
  .then((res) => res.json())
  .then((data) => {
    renderEndedAuctions(data.auctions);
    data.auctions.forEach((auction) => {
      console.log(`Winner: ${auction.winnerId?.fullName}`);
      console.log(`Winning Price: ${auction.winningBid?.price}`);
    });
  });
```

### 4. Admin Dashboard - Xem tất cả:

```javascript
// Xem tất cả phiên đang diễn ra
fetch("/api/auctions/all?status=ongoing")
  .then((res) => res.json())
  .then((data) => renderAdminTable(data.auctions));

// Xem tất cả phiên sắp diễn ra
fetch("/api/auctions/all?status=upcoming")
  .then((res) => res.json())
  .then((data) => renderAdminTable(data.auctions));

// Xem tất cả phiên đã kết thúc
fetch("/api/auctions/all?status=ended")
  .then((res) => res.json())
  .then((data) => renderAdminTable(data.auctions));

// Xem tất cả phiên của 1 sản phẩm
fetch("/api/auctions/all?listingId=673d8f9e5c9f4e0012345678")
  .then((res) => res.json())
  .then((data) => renderProductAuctions(data.auctions));
```

---

## 🔧 PAGINATION

Tất cả API đều hỗ trợ pagination với format:

```json
{
  "pagination": {
    "current": 1, // Trang hiện tại
    "pages": 5, // Tổng số trang
    "total": 48 // Tổng số record
  }
}
```

**Cách tính:**

- `pages = Math.ceil(total / limit)`
- `skip = (page - 1) * limit`

---

## ⚠️ LƯU Ý

1. **API `/ongoing`** chỉ trả về phiên đang trong khoảng thời gian `[startAt, endAt]`
2. **API `/upcoming`** chỉ trả về phiên chưa bắt đầu (`startAt > now`)
3. **API `/ended`** bao gồm cả phiên `cancelled` và phiên `active` nhưng đã quá `endAt`
4. **API `/all`** không filter theo thời gian, chỉ theo `status` và `listingId`
5. Tất cả API đều **public** (không cần authentication)

---

## 📝 RESPONSE FIELDS

| Field           | Type        | Mô tả                            |
| --------------- | ----------- | -------------------------------- |
| `_id`           | string      | ID phiên đấu giá                 |
| `listingId`     | object      | Thông tin sản phẩm (populated)   |
| `startAt`       | date        | Thời gian bắt đầu                |
| `endAt`         | date        | Thời gian kết thúc               |
| `status`        | string      | `active`, `ended`, `cancelled`   |
| `startingPrice` | number      | Giá khởi điểm                    |
| `depositAmount` | number      | Tiền cọc yêu cầu                 |
| `bids`          | array       | Danh sách bid                    |
| `winnerId`      | object/null | Người thắng (nếu đã kết thúc)    |
| `winningBid`    | object/null | Bid thắng cuộc (nếu đã kết thúc) |
| `createdAt`     | date        | Thời gian tạo phiên              |

---

**Tài liệu hoàn chỉnh cho 4 API lấy danh sách phiên đấu giá!** 🚀
