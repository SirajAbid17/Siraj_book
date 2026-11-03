
require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const dbconnect = require("./config/db");

const app = express();
const server = http.createServer(app);

// ===============================
// CORS - Allow All Origins
// ===============================

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, origin || true);
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
app.options(/.*/, cors(corsOptions));

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ===============================
// FRONTEND BUILD
// ===============================

const publicPath = path.join(__dirname, "public");
const indexPath = path.join(publicPath, "index.html");

app.use(express.static(publicPath));

// ===============================
// DATABASE CONNECTION
// ===============================

let dbPromise = null;

const connectDB = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return next();
    }

    if (!dbPromise) {
      dbPromise = dbconnect().catch((error) => {
        dbPromise = null;
        throw error;
      });
    }

    await dbPromise;
    next();
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message,
    });
  }
};

// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SirajBook backend is running",
  });
});

// ===============================
// API DATABASE MIDDLEWARE
// ===============================

app.use("/api", connectDB);

// ===============================
// ROUTES
// ===============================

// Keep your existing route paths and filenames.
// Change these paths only if your project uses different names.

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/message", require("./routes/messageRoutes"));
app.use("/api/conversation", require("./routes/conversationRoutes"));

// ===============================
// SOCKET.IO
// ===============================

// Vercel serverless does not support persistent Socket.IO
// connections reliably. Run Socket.IO on a separate
// persistent server for production realtime messaging.

let io = null;
const onlineUsers = new Map();

if (!process.env.VERCEL) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, origin || true);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("addUser", (userId) => {
      if (!userId) return;

      onlineUsers.set(String(userId), socket.id);

      io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));
    });

    socket.on("sendMessage", (message) => {
      if (!message) return;

      const receiverId = String(
        message.receiverId || message.recipientId || ""
      );

      const receiverSocket = onlineUsers.get(receiverId);

      if (receiverSocket) {
        io.to(receiverSocket).emit("getMessage", message);
      }
    });

    socket.on("typing", ({ receiverId, senderId }) => {
      const receiverSocket = onlineUsers.get(String(receiverId));

      if (receiverSocket) {
        io.to(receiverSocket).emit("typing", { senderId });
      }
    });

    socket.on("stopTyping", ({ receiverId, senderId }) => {
      const receiverSocket = onlineUsers.get(String(receiverId));

      if (receiverSocket) {
        io.to(receiverSocket).emit("stopTyping", { senderId });
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
        }
      }

      io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));

      console.log("Socket disconnected:", socket.id);
    });
  });
}

// ===============================
// FRONTEND ROUTING
// ===============================

app.get("/", (req, res) => {
  res.sendFile(indexPath, (error) => {
    if (error) {
      res.status(404).send("Frontend build not found in backend/public");
    }
  });
});

// React/Vite SPA fallback
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(indexPath, (error) => {
    if (error) {
      next(error);
    }
  });
});

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

// ===============================
// LOCAL SERVER
// ===============================

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// ===============================
// EXPORT
// ===============================

module.exports = app;
