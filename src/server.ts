import app from "./app";
import { connectDB } from "./config/db";
import { createServer } from "http";
import { WebSocketService } from "./services/websocketService";
import "dotenv/config";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = createServer(app);

  // Initialize WebSocket service
  const wsService = new WebSocketService(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket service initialized`);
  });
});
