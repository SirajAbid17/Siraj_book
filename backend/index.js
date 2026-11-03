
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
require("dotenv").config();

const dbconnect = require("./config/db");
const Users = require("./models/usermodels");

const authroute = require("./routes/authroutes");
const userrouter = require("./routes/userroutes");
const postroute = require("./routes/postroutes");
const reelsrouter = require("./routes/reelsroutes");
const storyrouter = require("./routes/storyroutes");
const messageRouter = require("./routes/messageRoutes");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const publicPath = path.join(__dirname, "public");
const indexPath = path.join(publicPath, "index.html");

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5000",
  process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.replace(/\/$/, "")
    : null,
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));

// --------------------------------------------------
// Database connection
// --------------------------------------------------

let databaseConnection;

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!databaseConnection) {
    databaseConnection = Promise.resolve(dbconnect()).catch((error) => {
      databaseConnection = null;
      throw error;
    });
  }

  await databaseConnection;
};

// Connect before handling API requests.
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
    });
  }
});

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Local development serves the frontend through Express.
// Vercel serves public/ files through its CDN.
if (!process.env.VERCEL) {
  app.use(express.static(publicPath));
}

// --------------------------------------------------
// API routes
// --------------------------------------------------

app.use("/api", authroute);
app.use("/api", userrouter);
app.use("/api", postroute);
app.use("/api", reelsrouter);
app.use("/api", storyrouter);
app.use("/api", messageRouter);

// --------------------------------------------------
// Existing cleanup endpoint
// IMPORTANT: Protect this endpoint with admin auth
// before using it in production.
// --------------------------------------------------

app.delete("/api/cleanup-conversations", async (req, res) => {
  try {
    const Conversation = require("./models/conversationModel");
    const Message = require("./models/messageModel");

    await Conversation.deleteMany({});
    await Message.deleteMany({});

    res.status(200).json({
      success: true,
      message: "All conversations reset successfully",
      note: "You can now start fresh with messaging",
    });
  } catch (error) {
    console.error("Cleanup error:", error);

    res.status(500).json({
      success: false,
      error: "Cleanup failed: " + error.message,
    });
  }
});

// --------------------------------------------------
// Online / offline API endpoints
// --------------------------------------------------

app.post("/api/user/online", (req, res) => {
  res.json({
    success: true,
    message: "Online status endpoint",
  });
});

app.post("/api/user/offline", (req, res) => {
  res.json({
    success: true,
    message: "Offline status endpoint",
  });
});

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SirajBook server is running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// --------------------------------------------------
// Socket.IO
// --------------------------------------------------

const io = new Server(server, {
  cors: corsOptions,

  // Vercel WebSocket deployment:
  // The frontend Socket.IO client must also use websocket transport.
  transports: ["websocket"],
});

const onlineUsers = new Map();

app.set("socketio", io);
app.set("onlineUsers", onlineUsers);

// --------------------------------------------------
// Socket connection
// --------------------------------------------------

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // USER ONLINE
  socket.on("user_online", async (userId) => {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.log("Invalid user ID:", userId);
        return;
      }

      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      await connectDatabase();

      await Users.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      console.log(`User ${userId} is online`);

      socket.broadcast.emit("user_status_changed", {
        userId,
        isOnline: true,
        lastSeen: new Date(),
      });

      const onlineUserIds = Array.from(onlineUsers.keys());

      socket.emit("online_users_list", onlineUserIds);
    } catch (error) {
      console.error("Error setting user online:", error);
    }
  });

  // JOIN CONVERSATION
  socket.on("join_conversation", (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);

      console.log(
        `User ${socket.id} joined conversation: ${conversationId}`
      );
    }
  });

  // LEAVE CONVERSATION
  socket.on("leave_conversation", (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);

      console.log(
        `User ${socket.id} left conversation: ${conversationId}`
      );
    }
  });

  // SEND MESSAGE
  socket.on("send_message", async (data) => {
    try {
      const {
        conversationId,
        message,
        senderId,
        receiverId,
      } = data || {};

      if (!conversationId || !message) {
        socket.emit("message_error", {
          error: "Missing conversation ID or message",
        });

        return;
      }

      console.log(
        `Socket message in ${conversationId} from ${senderId} to ${receiverId}`
      );

      io.to(conversationId).emit("receive_message", message);

      const receiverSocketId = onlineUsers.get(receiverId);

      if (receiverSocketId && receiverSocketId !== socket.id) {
        io.to(receiverSocketId).emit("new_message_notification", {
          message,
          conversationId,
          senderId,
        });
      }
    } catch (error) {
      console.error("Error sending message via socket:", error);

      socket.emit("message_error", {
        error: "Failed to send message",
      });
    }
  });

  // TYPING START
  socket.on("typing_start", (data) => {
    if (data?.conversationId) {
      socket.to(data.conversationId).emit("user_typing", {
        userId: data.userId,
        isTyping: true,
        conversationId: data.conversationId,
      });
    }
  });

  // TYPING STOP
  socket.on("typing_stop", (data) => {
    if (data?.conversationId) {
      socket.to(data.conversationId).emit("user_typing", {
        userId: data.userId,
        isTyping: false,
        conversationId: data.conversationId,
      });
    }
  });

  // MESSAGE READ
  socket.on("message_read", (data) => {
    if (data?.conversationId && data?.messageId) {
      socket.to(data.conversationId).emit(
        "message_read_confirmation",
        {
          messageId: data.messageId,
          readBy: data.userId,
          readAt: new Date(),
        }
      );
    }
  });

  // DISCONNECT
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    if (socket.userId) {
      // Avoid deleting a newer connection for the same user.
      if (onlineUsers.get(socket.userId) === socket.id) {
        onlineUsers.delete(socket.userId);

        try {
          await connectDatabase();

          await Users.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          socket.broadcast.emit("user_status_changed", {
            userId: socket.userId,
            isOnline: false,
            lastSeen: new Date(),
          });

          console.log(`User ${socket.userId} is offline`);
        } catch (error) {
          console.error("Error updating offline status:", error);
        }
      }
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Socket.IO engine errors
io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", error);
});

// --------------------------------------------------
// SPA fallback
// Existing React routes such as /messages and /reels
// should return the React index.html.
// --------------------------------------------------

app.get(/.*/, (req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path === "/api" ||
    req.path.startsWith("/socket.io/") ||
    req.path === "/socket.io" ||
    req.path === "/health"
  ) {
    return next();
  }

  res.sendFile(indexPath, (error) => {
    if (error) {
      next(error);
    }
  });
});

// API 404
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// General error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// --------------------------------------------------
// Local server
// Vercel receives the exported HTTP server instead.
// --------------------------------------------------

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`SirajBook server running on port ${PORT}`);
  });
}

// --------------------------------------------------
// Graceful shutdown for local development
// --------------------------------------------------

if (!process.env.VERCEL) {
  process.on("SIGINT", async () => {
    console.log("Server shutting down...");

    try {
      const onlineUserIds = Array.from(onlineUsers.keys());

      if (onlineUserIds.length > 0) {
        await Users.updateMany(
          { _id: { $in: onlineUserIds } },
          {
            isOnline: false,
            lastSeen: new Date(),
          }
        );
      }

      await new Promise((resolve) => {
        io.close(resolve);
      });

      await mongoose.connection.close();

      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });
}

// Export HTTP server for Vercel WebSocket support.
module.exports = server;
