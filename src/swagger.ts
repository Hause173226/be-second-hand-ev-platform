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
      },
      {
        name: "KYC",
        description: "KYC verification endpoints",
      },
      {
        name: "Address",
        description: "Address management endpoints",
      },
      {
        name: "Payment",
        description: "Payment method management endpoints",
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
