import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BE Bus Ticket Sales System API",
      version: "1.0.0",
      description: "API documentation for BE Bus Ticket Sales System",
    },
    tags: [
      {
        name: "Auth",
        description: "Authentication endpoints"
      },
      {
        name: "User Profile",
        description: "User profile management endpoints"
      },
      {
        name: "Users",
        description: "User management endpoints (Admin only)"
      },
      {
        name: "Listings",
        description: "Listing management and search endpoints"
      },
      {
        name: "Search History",
        description: "Search history management endpoints"
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
              description: "User ID"
            },
            fullName: {
              type: "string",
              description: "Full name"
            },
            phone: {
              type: "string",
              description: "Phone number"
            },
            email: {
              type: "string",
              description: "Email address"
            },
            role: {
              type: "string",
              enum: ["user", "admin"],
              description: "User role"
            },
            avatar: {
              type: "string",
              description: "Avatar URL"
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
        Listing: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Listing ID"
            },
            sellerId: {
              $ref: "#/components/schemas/User",
              description: "Seller information"
            },
            type: {
              type: "string",
              enum: ["Car", "Battery"],
              description: "Type of listing"
            },
            make: {
              type: "string",
              description: "Brand/Make"
            },
            model: {
              type: "string",
              description: "Model"
            },
            year: {
              type: "number",
              description: "Manufacturing year"
            },
            batteryCapacityKWh: {
              type: "number",
              description: "Battery capacity in kWh"
            },
            mileageKm: {
              type: "number",
              description: "Mileage in kilometers"
            },
            chargeCycles: {
              type: "number",
              description: "Number of charge cycles"
            },
            condition: {
              type: "string",
              enum: ["New", "LikeNew", "Used", "Worn"],
              description: "Condition of the item"
            },
            photos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "Photo URL"
                  },
                  kind: {
                    type: "string",
                    enum: ["photo", "doc"],
                    description: "Media type"
                  }
                }
              },
              description: "List of photos"
            },
            location: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "City"
                },
                district: {
                  type: "string",
                  description: "District"
                },
                address: {
                  type: "string",
                  description: "Address"
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
              description: "Search history ID"
            },
            userId: {
              type: "string",
              description: "User ID"
            },
            searchQuery: {
              type: "string",
              description: "Search keyword"
            },
            searchType: {
              type: "string",
              enum: ["listing", "user", "general"],
              description: "Type of search"
            },
            filters: {
              type: "object",
              description: "Applied filters",
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
              description: "Number of results found"
            },
            searchDate: {
              type: "string",
              format: "date-time",
              description: "Date of search"
            },
            isSuccessful: {
              type: "boolean",
              description: "Whether search was successful"
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
