import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "EV Platform API",
      version: "1.0.0",
      description: "API documentation for Second-hand EV Platform System",
    },

    servers: [
      {
        url: "http://localhost:8081",
        description: "Local development server",
      },
      {
        url: "https://ev-platform-api.vercel.app/api",
        description: "Production server",
      },
    ],

    tags: [
      { name: "Auth", description: "Đăng ký, đăng nhập, xác minh email, OTP" },
      {
        name: "Users",
        description: "Quản lý tài khoản người dùng (Admin & User)",
      },
      {
        name: "Profile",
        description: "Cập nhật và lấy thông tin hồ sơ người dùng",
      },
      { name: "Listings", description: "Quản lý và tìm kiếm tin rao xe điện" },
      {
        name: "Appointments",
        description: "Lịch hẹn xem xe & xác nhận cuộc hẹn",
      },
      { name: "Offers", description: "Đề nghị giá và phản hồi đàm phán" },
      {
        name: "Chat",
        description: "Tin nhắn trực tiếp giữa người mua & người bán",
      },
      {
        name: "Search History",
        description: "Theo dõi từ khóa & lịch sử tìm kiếm",
      },
      {
        name: "Deposits",
        description: "Đặt cọc và quản lý giao dịch",
      },
      {
        name: "Contracts",
        description: "Tạo và quản lý hợp đồng mua bán",
      },
      {
        name: "Wallet",
        description: "Quản lý ví điện tử và thanh toán",
      },
      {
        name: "Transactions",
        description: "Quản lý giao dịch và xác nhận hoàn thành",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      schemas: {
        Address: {
          type: "object",
          properties: {
            _id: { type: "string" },
            fullAddress: {
              type: "string",
              example: "123 Đường ABC, Phường 1",
            },
            ward: { type: "string", example: "Phường 1" },
            district: { type: "string", example: "Quận 1" },
            city: { type: "string", example: "TP.HCM" },
            province: { type: "string", example: "Hồ Chí Minh" },
            coordinates: {
              type: "object",
              properties: {
                lat: { type: "number", example: 10.762622 },
                lng: { type: "number", example: 106.660172 },
              },
            },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        User: {
          type: "object",
          required: ["fullName", "email", "phone"],
          properties: {
            _id: { type: "string", example: "64fb3c81a9c2c0a1b6a12345" },
            fullName: { type: "string", example: "Nguyễn Văn A" },
            email: { type: "string", example: "a.nguyen@example.com" },
            phone: { type: "string", example: "0912345678" },
            role: {
              type: "string",
              enum: ["user", "staff", "admin"],
              example: "user",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "SUSPENDED", "DELETED"],
              example: "ACTIVE",
            },
            emailVerified: { type: "boolean", example: true },
            gender: {
              type: "string",
              enum: ["male", "female", "other"],
              example: "male",
            },
            dateOfBirth: {
              type: "string",
              format: "date",
              example: "1990-01-01",
            },
            avatar: {
              type: "string",
              example: "https://example.com/avatar.jpg",
            },
            address: { $ref: "#/components/schemas/Address" },
            citizenId: { type: "string", example: "001234567890" },
            rating: { type: "number", example: 4.5 },
            stats: {
              type: "object",
              properties: {
                soldCount: { type: "number", example: 5 },
                buyCount: { type: "number", example: 3 },
                cancelRate: { type: "number", example: 0.1 },
                responseTime: { type: "number", example: 2.5 },
                completionRate: { type: "number", example: 0.95 },
              },
            },
            lastLoginAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },

        Listing: {
          type: "object",
          required: ["title", "price", "location"],
          properties: {
            _id: { type: "string" },
            title: { type: "string", example: "VinFast VF8 2023" },
            description: {
              type: "string",
              example: "Xe còn rất mới, đi được 3000km",
            },
            price: { type: "number", example: 500000000 },
            images: { type: "array", items: { type: "string" } },
            location: { type: "string", example: "Hà Nội" },
            sellerId: { type: "string" },
            brand: { type: "string", example: "VinFast" },
            model: { type: "string", example: "VF8" },
            year: { type: "number", example: 2023 },
            color: { type: "string", example: "Đen" },
            licensePlate: { type: "string", example: "30A-12345" },
            status: {
              type: "string",
              enum: ["Published", "Sold", "Draft"],
              example: "Published",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        Appointment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            depositRequestId: { type: "string" },
            buyerId: { type: "string" },
            sellerId: { type: "string" },
            scheduledDate: {
              type: "string",
              format: "date-time",
              example: "2024-11-02T10:00:00Z",
            },
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED"],
              example: "PENDING",
            },
            type: {
              type: "string",
              enum: ["CONTRACT_SIGNING", "VEHICLE_INSPECTION", "DELIVERY"],
              example: "CONTRACT_SIGNING",
            },
            location: { type: "string", example: "Văn phòng giao dịch" },
            rescheduledCount: { type: "number", example: 0 },
            maxReschedules: { type: "number", example: 3 },
            buyerConfirmed: { type: "boolean", example: false },
            sellerConfirmed: { type: "boolean", example: false },
          },
        },

        DepositRequest: {
          type: "object",
          properties: {
            _id: { type: "string" },
            listingId: { type: "string" },
            buyerId: { type: "string" },
            sellerId: { type: "string" },
            depositAmount: { type: "number", example: 50000000 },
            status: {
              type: "string",
              enum: ["PENDING_SELLER_CONFIRMATION", "SELLER_CONFIRMED", "IN_ESCROW", "COMPLETED", "CANCELLED"],
              example: "PENDING_SELLER_CONFIRMATION",
            },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        Contract: {
          type: "object",
          properties: {
            appointmentId: { type: "string" },
            buyer: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                idNumber: { type: "string" },
                address: { type: "string" },
              },
            },
            seller: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                idNumber: { type: "string" },
                address: { type: "string" },
              },
            },
            vehicle: {
              type: "object",
              properties: {
                title: { type: "string" },
                brand: { type: "string" },
                model: { type: "string" },
                year: { type: "number" },
                price: { type: "number" },
                licensePlate: { type: "string" },
              },
            },
            transaction: {
              type: "object",
              properties: {
                depositAmount: { type: "number" },
                appointmentDate: { type: "string", format: "date-time" },
                location: { type: "string" },
              },
            },
          },
        },

        Wallet: {
          type: "object",
          properties: {
            _id: { type: "string" },
            userId: { type: "string" },
            balance: { type: "number", example: 1000000 },
            frozenAmount: { type: "number", example: 500000 },
            totalDeposited: { type: "number", example: 2000000 },
            totalWithdrawn: { type: "number", example: 500000 },
            currency: { type: "string", example: "VND" },
            status: { type: "string", example: "ACTIVE" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"], // Đường dẫn tới các file có comment swagger
};

export const swaggerSpec = swaggerJSDoc(options);