/**
 * STAGE 2: Notification Service with MongoDB persistence
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Log = require("../logging_middleware/logger");
const loggerMiddleware = require("../logging_middleware/middleware");
const { connectDatabase } = require("./db");
const Notification = require("./models/notificationModel");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;

const validTypes = ["placement", "interview", "selection", "rejection", "event", "announcement"];
const validPriorities = ["low", "medium", "high", "urgent"];

app.use(express.json());
app.use(loggerMiddleware);

const userConnections = new Map();

function broadcastToUser(userId, payload) {
  const connections = userConnections.get(userId);
  if (!connections) return;
  const message = JSON.stringify(payload);
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("[WebSocket] New connection");
  let userId = null;

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === "subscribe" && message.userId) {
        userId = message.userId;
        if (!userConnections.has(userId)) {
          userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(ws);

        await Log("backend", "info", "service", `User ${userId} subscribed to notifications`);
        ws.send(
          JSON.stringify({
            event: "subscribed",
            userId,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (err) {
      console.error("[WebSocket Error]", err.message);
    }
  });

  ws.on("close", () => {
    if (userId) {
      userConnections.get(userId)?.delete(ws);
      console.log(`[WebSocket] User ${userId} disconnected`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WebSocket Error]", err.message);
  });
});

app.post("/api/v1/notifications", async (req, res) => {
  try {
    const { userId, type, title, message, priority = "medium", expiresAt, metadata } = req.body;
    if (!userId || !type || !title || !message) {
      await Log("backend", "warn", "handler", "Missing required fields in notification creation");
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: userId, type, title, message",
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      priority,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata: metadata || {},
    });

    broadcastToUser(userId, {
      event: "notification:new",
      data: notification,
      timestamp: new Date().toISOString(),
    });

    await Log("backend", "info", "handler", `Notification created for user ${userId}`);
    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Notification creation failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/v1/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type, priority, isRead, sort = "-createdAt" } = req.query;
    const query = { userId };
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (typeof isRead !== "undefined") {
      query.isRead = isRead === "true" || isRead === true;
    }
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortOrder = sort.startsWith("-") ? -1 : 1;
    const sortOptions = { [sortField]: sortOrder };
    const pageNumber = Math.max(parseInt(page, 10), 1);
    const pageSize = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNumber - 1) * pageSize;
    const [notifications, total] = await Promise.all([
      Notification.find(query).sort(sortOptions).skip(skip).limit(pageSize),
      Notification.countDocuments(query),
    ]);
    const pages = Math.ceil(total / pageSize);
    await Log("backend", "info", "handler", `Fetched notifications for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: pageNumber,
          limit: pageSize,
          pages,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Failed to fetch notifications: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.patch("/api/v1/notifications/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { isRead } = req.body;
    if (typeof isRead !== "boolean") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "isRead must be boolean",
        },
        timestamp: new Date().toISOString(),
      });
    }
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead, updatedAt: new Date() },
      { new: true },
    );
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Notification not found",
        },
        timestamp: new Date().toISOString(),
      });
    }
    broadcastToUser(notification.userId, {
      event: "notification:read",
      data: {
        notificationId: notification.id,
        userId: notification.userId,
        timestamp: new Date().toISOString(),
      },
    });
    await Log("backend", "info", "handler", `Notification ${notificationId} marked as read`);
    res.status(200).json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Failed to update notification: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.delete("/api/v1/notifications/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findByIdAndDelete(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Notification not found",
        },
        timestamp: new Date().toISOString(),
      });
    }
    broadcastToUser(notification.userId, {
      event: "notification:deleted",
      data: {
        notificationId: notification.id,
        userId: notification.userId,
      },
      timestamp: new Date().toISOString(),
    });
    await Log("backend", "info", "handler", `Notification ${notificationId} deleted`);
    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Failed to delete notification: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.post("/api/v1/notifications/bulk/mark-read", async (req, res) => {
  try {
    const { notificationIds, userId } = req.body;
    if (!Array.isArray(notificationIds) || !userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "notificationIds (array) and userId required",
        },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, userId },
      { isRead: true, updatedAt: new Date() },
    );
    await Log("backend", "info", "handler", `Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        updated: result.modifiedCount,
        failed: notificationIds.length - result.modifiedCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Bulk mark-read failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.post("/api/v1/notifications/notify-all", async (req, res) => {
  try {
    const { type, title, message, priority = "medium", metadata, targetUsers } = req.body;
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "type, title, message required",
        },
        timestamp: new Date().toISOString(),
      });
    }
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (Array.isArray(targetUsers) && targetUsers.length) {
      const notifications = targetUsers.map((userId) => ({
        userId,
        type,
        title,
        message,
        priority,
        metadata: metadata || {},
      }));
      await Notification.insertMany(notifications);
      targetUsers.forEach((userId) => {
        broadcastToUser(userId, {
          event: "notification:new",
          data: {
            type,
            title,
            message,
            priority,
            metadata: metadata || {},
          },
          timestamp: new Date().toISOString(),
        });
      });
    }
    await Log("backend", "info", "handler", `Notify-all job queued: ${jobId}`);
    res.status(202).json({
      success: true,
      data: {
        jobId,
        estimatedUsers: Array.isArray(targetUsers) ? targetUsers.length : "calculating",
        status: "queued",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Notify-all failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/v1/notifications/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    res.status(200).json({
      success: true,
      data: {
        jobId,
        status: "processing",
        progress: {
          processed: 0,
          total: 0,
          percentage: 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error("[Global Error Handler]", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
    timestamp: new Date().toISOString(),
  });
});

connectDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Notification Service running on port ${PORT}`);
      console.log(`📡 WebSocket server ready for real-time updates`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("[Startup Error] Failed to connect to database", err);
    process.exit(1);
  });

module.exports = server;
