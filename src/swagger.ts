import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Second Hand EV Platform API",
      version: "1.0.0",
      description: "API documentation for BE Bus Ticket Sales System",
    },
    tags: [
      {
        name: "Auth",
        description: "Authentication endpoints",
      },
      {
        name: "User Profile",
        description: "User profile management endpoints",
      },
      {
        name: "Users",
        description: "User management endpoints (Admin only)",
      },
      {
        name: "Profile",
        description: "Profile management endpoints",
      description: `
      📘 **Tài liệu API - Nền tảng Mua Bán Xe Điện Cũ**
      
      Hệ thống bao gồm:
      - Đăng ký, đăng nhập, xác thực người dùng
      - Quản lý hồ sơ cá nhân
      - Đăng và quản lý tin rao bán xe điện
      - Quản lý lịch hẹn, tin nhắn, và đàm phán giá
      
      ⚡ Tất cả các endpoint (ngoại trừ đăng nhập, đăng ký) yêu cầu JWT Bearer Token.
      `,
      contact: {
        name: "HoiBK Developer Team",
        email: "support@evplatform.com",
      },
    },

    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local development server",
      },
      {
        url: "https://ev-platform-api.vercel.app/api",
        description: "Production server",
      },
    ],

    tags: [
      { name: "Auth", description: "Đăng ký, đăng nhập, xác minh email, OTP" },
      { name: "Users", description: "Quản lý tài khoản người dùng (Admin & User)" },
      { name: "Profile", description: "Cập nhật và lấy thông tin hồ sơ người dùng" },
      { name: "Listings", description: "Quản lý và tìm kiếm tin rao xe điện" },
      { name: "Appointments", description: "Lịch hẹn xem xe & xác nhận cuộc hẹn" },
      { name: "Offers", description: "Đề nghị giá và phản hồi đàm phán" },
      { name: "Chat", description: "Tin nhắn trực tiếp giữa người mua & người bán" },
      { name: "Search History", description: "Theo dõi từ khóa & lịch sử tìm kiếm" },
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
        User: {
          type: "object",
          required: ["fullName", "email", "phone"],
          properties: {
            _id: { type: "string", example: "64fb3c81a9c2c0a1b6a12345" },
            fullName: { type: "string", example: "Nguyễn Văn A" },
            email: { type: "string", example: "a.nguyen@example.com" },
            phone: { type: "string", example: "0912345678" },
            role: { type: "string", enum: ["user", "admin"], example: "user" },
            emailVerified: { type: "boolean", example: true },
            isActive: { type: "boolean", example: true },
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
            title: { type: "string", example: "Xe máy điện VinFast Klara" },
            description: { type: "string", example: "Xe còn rất mới, đi được 3000km" },
            price: { type: "number", example: 14500000 },
            images: { type: "array", items: { type: "string" } },
            location: { type: "string", example: "Hà Nội" },
            sellerId: { type: "string" },
            status: { type: "string", enum: ["available", "sold"], example: "available" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        Offer: {
          type: "object",
          properties: {
            _id: { type: "string" },
            listingId: { type: "string" },
            buyerId: { type: "string" },
            offerPrice: { type: "number", example: 14000000 },
            status: { type: "string", enum: ["pending", "accepted", "rejected"], example: "pending" },
          },
        },

        Appointment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            listingId: { type: "string" },
            buyerId: { type: "string" },
            date: { type: "string", format: "date-time", example: "2025-10-23T10:00:00Z" },
            status: { type: "string", enum: ["pending", "confirmed", "cancelled"], example: "pending" },
          },
        },
      },
    },

    security: [{ bearerAuth: [] }],
  },

  // quét các route và controller có comment @swagger
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
