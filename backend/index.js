
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

require("dotenv").config();

const dbconnect = require("./config/db");

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

const isProduction = process.env.NODE_ENV === "production";

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, origin || true);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));


app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.use(cookieParser());

app.use(express.static(publicPath));

let databaseConnection = null;

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!databaseConnection) {
    databaseConnection = dbconnect().catch((error) => {
      databaseConnection = null;
      throw error;
    });
  }

  await databaseConnection;
};

app.get("/health", async (req, res) => {
  try {
    await connectDatabase();

    return res.status(200).json({
      success: true,
      message: "SirajBook server is running",
      database: "connected",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("Health check database error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      database: "disconnected",
    });
  }
});


app.use("/api", async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("MongoDB connection error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database connection unavailable",
    });
  }
});

app.use("/api", authroute);
app.use("/api", userrouter);
app.use("/api", postroute);
app.use("/api", reelsrouter);
app.use("/api", storyrouter);
app.use("/api", messageRouter);


if (!process.env.VERCEL) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: corsOptions,
    transports: ["websocket", "polling"],
  });

  const onlineUsers = new Map();

  app.set("socketio", io);
  app.set("onlineUsers", onlineUsers);

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

   
    socket.on("user_online", async (userId) => {
      try {
        if (
          !userId ||
          !mongoose.Types.ObjectId.isValid(userId)
        ) {
          return;
        }

        await connectDatabase();

        onlineUsers.set(userId, socket.id);
        socket.userId = userId;

        await require("./models/usermodels").findByIdAndUpdate(
          userId,
          {
            isOnline: true,
            lastSeen: new Date(),
          }
        );

        socket.broadcast.emit("user_status_changed", {
          userId,
          isOnline: true,
          lastSeen: new Date(),
        });

        socket.emit(
          "online_users_list",
          Array.from(onlineUsers.keys())
        );
      } catch (error) {
        console.error("User online error:", error);
      }
    });

  
    socket.on("join_conversation", (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
      }
    });

    
    socket.on("leave_conversation", (conversationId) => {
      if (conversationId) {
        socket.leave(conversationId);
      }
    });

    
    socket.on("send_message", (data) => {
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

        io.to(conversationId).emit(
          "receive_message",
          message
        );

        const receiverSocketId = onlineUsers.get(receiverId);

        if (
          receiverSocketId &&
          receiverSocketId !== socket.id
        ) {
          io.to(receiverSocketId).emit(
            "new_message_notification",
            {
              message,
              conversationId,
              senderId,
            }
          );
        }
      } catch (error) {
        console.error("Socket message error:", error);

        socket.emit("message_error", {
          error: "Failed to send message",
        });
      }
    });

    
    socket.on("typing_start", (data) => {
      if (data?.conversationId) {
        socket.to(data.conversationId).emit("user_typing", {
          userId: data.userId,
          isTyping: true,
          conversationId: data.conversationId,
        });
      }
    });

  
    socket.on("typing_stop", (data) => {
      if (data?.conversationId) {
        socket.to(data.conversationId).emit("user_typing", {
          userId: data.userId,
          isTyping: false,
          conversationId: data.conversationId,
        });
      }
    });

  
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

    
    socket.on("disconnect", async () => {
      if (!socket.userId) return;

      if (onlineUsers.get(socket.userId) !== socket.id) {
        return;
      }

      onlineUsers.delete(socket.userId);

      try {
        await connectDatabase();

        await require("./models/usermodels").findByIdAndUpdate(
          socket.userId,
          {
            isOnline: false,
            lastSeen: new Date(),
          }
        );

        socket.broadcast.emit("user_status_changed", {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error("User offline error:", error);
      }
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  io.engine.on("connection_error", (error) => {
    console.error("Socket.IO connection error:", error);
  });
}

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


app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found",
  });
});


app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: isProduction
      ? "Internal server error"
      : error.message,
  });
});


if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`SirajBook running on port ${PORT}`);
  });
}


if (!process.env.VERCEL) {
  process.on("SIGINT", async () => {
    console.log("Server shutting down...");

    try {
      await new Promise((resolve) => {
        server.close(resolve);
      });

      await mongoose.connection.close();

      console.log("Server closed successfully");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });
}


module.exports = app;
