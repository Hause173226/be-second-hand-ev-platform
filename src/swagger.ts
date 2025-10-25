import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Second Hand EV Platform API",
      version: "1.0.0",
      description: "Tài liệu API cho nền tảng mua bán xe điện cũ",
    },
    tags: [
      {
        name: "Auth",
        description: "Các endpoint xác thực và đăng nhập"
      },
      {
        name: "User Profile",
        description: "Các endpoint quản lý thông tin cá nhân"
      },
      {
        name: "Users",
        description: "Các endpoint quản lý người dùng (chỉ dành cho Admin)"
      },
      {
        name: "Listings",
        description: "Các endpoint quản lý và tìm kiếm danh sách xe"
      },
      {
        name: "Search History",
        description: "Các endpoint quản lý lịch sử tìm kiếm"
      },
      {
        name: "Appointments",
        description: "Các endpoint quản lý lịch hẹn xem xe"
      },
      {
        name: "Chat",
        description: "Các endpoint chat và tin nhắn"
      },
      {
        name: "Offers",
        description: "Các endpoint quản lý đề nghị giá và đàm phán"
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
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID người dùng"
            },
            fullName: {
              type: "string",
              description: "Họ và tên"
            },
            phone: {
              type: "string",
              description: "Số điện thoại"
            },
            email: {
              type: "string",
              description: "Địa chỉ email"
            },
            role: {
              type: "string",
              enum: ["user", "admin"],
              description: "Vai trò người dùng"
            },
            avatar: {
              type: "string",
              description: "URL ảnh đại diện"
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Ngày tạo"
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Ngày cập nhật"
            }
          }
        },
        Listing: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID danh sách xe"
            },
            sellerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người bán"
            },
            type: {
              type: "string",
              enum: ["Car", "Battery"],
              description: "Loại sản phẩm"
            },
            make: {
              type: "string",
              description: "Thương hiệu"
            },
            model: {
              type: "string",
              description: "Mẫu xe"
            },
            year: {
              type: "number",
              description: "Năm sản xuất"
            },
            batteryCapacityKWh: {
              type: "number",
              description: "Dung lượng pin (kWh)"
            },
            mileageKm: {
              type: "number",
              description: "Số km đã đi"
            },
            chargeCycles: {
              type: "number",
              description: "Số lần sạc"
            },
            condition: {
              type: "string",
              enum: ["New", "LikeNew", "Used", "Worn"],
              description: "Tình trạng xe"
            },
            photos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "URL ảnh"
                  },
                  kind: {
                    type: "string",
                    enum: ["photo", "doc"],
                    description: "Loại file"
                  }
                }
              },
              description: "Danh sách ảnh"
            },
            location: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "Thành phố"
                },
                district: {
                  type: "string",
                  description: "Quận/Huyện"
                },
                address: {
                  type: "string",
                  description: "Địa chỉ"
                }
              },
              description: "Location information"
            },
            priceListed: {
              type: "number",
              description: "Listed price"
            },
            tradeMethod: {
              type: "string",
              enum: ["meet", "ship", "consignment"],
              description: "Trade method"
            },
            status: {
              type: "string",
              enum: ["Draft", "PendingReview", "Published", "InTransaction", "Sold", "Expired", "Rejected"],
              description: "Listing status"
            },
            notes: {
              type: "string",
              description: "Additional notes"
            },
            publishedAt: {
              type: "string",
              format: "date-time",
              description: "Publication date"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        SearchHistory: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID lịch sử tìm kiếm"
            },
            userId: {
              type: "string",
              description: "ID người dùng"
            },
            searchQuery: {
              type: "string",
              description: "Từ khóa tìm kiếm"
            },
            searchType: {
              type: "string",
              enum: ["listing", "user", "general"],
              description: "Loại tìm kiếm"
            },
            filters: {
              type: "object",
              description: "Bộ lọc đã áp dụng",
              properties: {
                make: { type: "string" },
                model: { type: "string" },
                year: { type: "number" },
                batteryCapacityKWh: { type: "number" },
                mileageKm: { type: "number" },
                minPrice: { type: "number" },
                maxPrice: { type: "number" },
                city: { type: "string" },
                district: { type: "string" },
                condition: { type: "string" },
                sortBy: { type: "string" }
              }
            },
            resultsCount: {
              type: "number",
              description: "Số kết quả tìm được"
            },
            searchDate: {
              type: "string",
              format: "date-time",
              description: "Ngày tìm kiếm"
            },
            isSuccessful: {
              type: "boolean",
              description: "Tìm kiếm có thành công không"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Appointment: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID lịch hẹn"
            },
            listingId: {
              $ref: "#/components/schemas/Listing",
              description: "Thông tin xe"
            },
            buyerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người mua"
            },
            sellerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người bán"
            },
            chatId: {
              type: "string",
              description: "ID chat"
            },
            scheduledDate: {
              type: "string",
              format: "date-time",
              description: "Ngày giờ hẹn xem xe"
            },
            location: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Địa chỉ đầy đủ"
                },
                city: {
                  type: "string",
                  description: "Thành phố"
                },
                district: {
                  type: "string",
                  description: "Quận/Huyện"
                },
                coordinates: {
                  type: "object",
                  properties: {
                    lat: {
                      type: "number",
                      description: "Vĩ độ"
                    },
                    lng: {
                      type: "number",
                      description: "Kinh độ"
                    }
                  },
                  description: "GPS coordinates"
                }
              },
              required: ["address", "city", "district"],
              description: "Địa điểm hẹn"
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "cancelled", "completed"],
              description: "Trạng thái lịch hẹn"
            },
            notes: {
              type: "string",
              description: "Additional notes"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        CreateAppointmentRequest: {
          type: "object",
          required: ["listingId", "chatId", "scheduledDate", "location"],
          properties: {
            listingId: {
              type: "string",
              description: "ID danh sách xe"
            },
            chatId: {
              type: "string",
              description: "ID chat"
            },
            scheduledDate: {
              type: "string",
              format: "date-time",
              description: "Ngày giờ hẹn xem xe"
            },
            location: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Địa chỉ đầy đủ"
                },
                city: {
                  type: "string",
                  description: "Thành phố"
                },
                district: {
                  type: "string",
                  description: "Quận/Huyện"
                },
                coordinates: {
                  type: "object",
                  properties: {
                    lat: {
                      type: "number",
                      description: "Vĩ độ"
                    },
                    lng: {
                      type: "number",
                      description: "Kinh độ"
                    }
                  },
                  description: "GPS coordinates"
                }
              },
              required: ["address", "city", "district"],
              description: "Địa điểm hẹn"
            },
            notes: {
              type: "string",
              description: "Additional notes"
            }
          }
        },
        UpdateAppointmentStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["pending", "confirmed", "cancelled", "completed"],
              description: "New appointment status"
            },
            notes: {
              type: "string",
              description: "Additional notes"
            }
          }
        },
        AppointmentListResponse: {
          type: "object",
          properties: {
            appointments: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Appointment"
              }
            },
            totalPages: {
              type: "number",
              description: "Total number of pages"
            },
            currentPage: {
              type: "number",
              description: "Current page number"
            },
            total: {
              type: "number",
              description: "Total number of appointments"
            }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Thông báo lỗi"
            }
          }
        },
        SuccessResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Thông báo thành công"
            }
          }
        },
        Chat: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID chat"
            },
            listingId: {
              $ref: "#/components/schemas/Listing",
              description: "Thông tin xe"
            },
            buyerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người mua"
            },
            sellerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người bán"
            },
            lastMessage: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "Last message content"
                },
                senderId: {
                  type: "string",
                  description: "Sender ID"
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                  description: "Thời gian tin nhắn"
                }
              },
              description: "Last message in the chat"
            },
            isActive: {
              type: "boolean",
              description: "Whether chat is active"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Message: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Message ID"
            },
            chatId: {
              type: "string",
              description: "ID chat"
            },
            senderId: {
              $ref: "#/components/schemas/User",
              description: "Sender information"
            },
            content: {
              type: "string",
              description: "Nội dung tin nhắn"
            },
            messageType: {
              type: "string",
              enum: ["text", "image", "file", "offer", "appointment"],
              description: "Type of message"
            },
            isRead: {
              type: "boolean",
              description: "Whether message has been read"
            },
            metadata: {
              type: "object",
              properties: {
                offerId: {
                  type: "string",
                  description: "ID đề nghị liên quan"
                },
                appointmentId: {
                  type: "string",
                  description: "ID lịch hẹn liên quan"
                },
                imageUrl: {
                  type: "string",
                  description: "Image URL"
                },
                fileName: {
                  type: "string",
                  description: "File name"
                }
              },
              description: "Metadata tin nhắn"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Offer: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "ID đề nghị giá"
            },
            listingId: {
              $ref: "#/components/schemas/Listing",
              description: "Thông tin xe"
            },
            buyerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người mua"
            },
            sellerId: {
              $ref: "#/components/schemas/User",
              description: "Thông tin người bán"
            },
            chatId: {
              type: "string",
              description: "ID chat"
            },
            offeredPrice: {
              type: "number",
              description: "Giá đề nghị"
            },
            message: {
              type: "string",
              description: "Tin nhắn đề nghị"
            },
            status: {
              type: "string",
              enum: ["pending", "accepted", "rejected", "countered", "expired"],
              description: "Trạng thái đề nghị"
            },
            counterOffer: {
              type: "object",
              properties: {
                price: {
                  type: "number",
                  description: "Counter offer price"
                },
                message: {
                  type: "string",
                  description: "Counter offer message"
                },
                offeredBy: {
                  type: "string",
                  description: "User who made the counter offer"
                },
                offeredAt: {
                  type: "string",
                  format: "date-time",
                  description: "Counter offer timestamp"
                }
              },
              description: "Counter offer details"
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              description: "Offer expiration date"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        CreateOfferRequest: {
          type: "object",
          required: ["listingId", "chatId", "offeredPrice"],
          properties: {
            listingId: {
              type: "string",
              description: "ID danh sách xe"
            },
            chatId: {
              type: "string",
              description: "ID chat"
            },
            offeredPrice: {
              type: "number",
              minimum: 0,
              description: "Giá đề nghị"
            },
            message: {
              type: "string",
              description: "Tin nhắn đề nghị"
            },
            expiresInDays: {
              type: "number",
              minimum: 1,
              maximum: 30,
              default: 7,
              description: "Days until offer expires"
            }
          }
        },
        RespondToOfferRequest: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["accept", "reject", "counter"],
              description: "Response action"
            },
            counterPrice: {
              type: "number",
              minimum: 0,
              description: "Counter offer price (required for counter action)"
            },
            message: {
              type: "string",
              description: "Response message"
            }
          }
        },
        RespondToCounterOfferRequest: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["accept", "reject"],
              description: "Response action"
            }
          }
        },
        SendMessageRequest: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "string",
              description: "Nội dung tin nhắn"
            },
            messageType: {
              type: "string",
              enum: ["text", "image", "file", "offer", "appointment"],
              default: "text",
              description: "Type of message"
            },
            metadata: {
              type: "object",
              properties: {
                offerId: {
                  type: "string",
                  description: "ID đề nghị liên quan"
                },
                appointmentId: {
                  type: "string",
                  description: "ID lịch hẹn liên quan"
                },
                imageUrl: {
                  type: "string",
                  description: "Image URL"
                },
                fileName: {
                  type: "string",
                  description: "File name"
                }
              },
              description: "Metadata tin nhắn"
            }
          }
        },
        ChatListResponse: {
          type: "object",
          properties: {
            chats: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Chat"
              }
            },
            totalPages: {
              type: "number",
              description: "Total number of pages"
            },
            currentPage: {
              type: "number",
              description: "Current page number"
            },
            total: {
              type: "number",
              description: "Total number of chats"
            }
          }
        },
        MessageListResponse: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Message"
              }
            },
            totalPages: {
              type: "number",
              description: "Total number of pages"
            },
            currentPage: {
              type: "number",
              description: "Current page number"
            },
            total: {
              type: "number",
              description: "Total number of messages"
            }
          }
        },
        OfferListResponse: {
          type: "object",
          properties: {
            offers: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Offer"
              }
            },
            totalPages: {
              type: "number",
              description: "Total number of pages"
            },
            currentPage: {
              type: "number",
              description: "Current page number"
            },
            total: {
              type: "number",
              description: "Total number of offers"
            }
          }
        },
        UnreadCountResponse: {
          type: "object",
          properties: {
            unreadCount: {
              type: "number",
              description: "Number of unread messages"
            }
          }
        }
      }
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
import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Second Hand EV Platform API",
      version: "1.0.0",
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

