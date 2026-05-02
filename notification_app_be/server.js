/**
 * STAGE 1: Notification Service REST API
 * Production-ready server with WebSocket real-time support
 */

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Log = require("../logging_middleware/logger");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(express.json());

// Add logger middleware
const loggerMiddleware = require("../logging_middleware/middleware");
app.use(loggerMiddleware);

// =====================================================
// WEBSOCKET REAL-TIME HANDLER
// =====================================================

const userConnections = new Map(); // Map<userId, Set<WebSocket>>

wss.on("connection", (ws) => {
  console.log("[WebSocket] New connection");
  let userId = null;

  // Client sends auth message first
  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);

      // Auth: Subscribe to user's notifications
      if (message.type === "subscribe" && message.userId) {
        userId = message.userId;

        if (!userConnections.has(userId)) {
          userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(ws);

        await Log(
          "backend",
          "info",
          "service",
          `User ${userId} subscribed to notifications`,
        );
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

// =====================================================
// REST API ENDPOINTS - STAGE 1
// =====================================================

/**
 * POST /api/v1/notifications
 * Create a new notification
 */
app.post("/api/v1/notifications", async (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      priority = "medium",
      expiresAt,
      metadata,
    } = req.body;

    // Validation
    if (!userId || !type || !title || !message) {
      await Log(
        "backend",
        "warn",
        "handler",
        "Missing required fields in notification creation",
      );
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: userId, type, title, message",
        },
        timestamp: new Date().toISOString(),
      });
    }

    const validTypes = [
      "placement",
      "interview",
      "selection",
      "rejection",
      "event",
      "announcement",
    ];
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

    // Mock: Create notification object
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      priority,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt,
      metadata: metadata || {},
    };

    // TODO: Save to database (Stage 2)

    // Broadcast to connected user via WebSocket
    if (userConnections.has(userId)) {
      const event = JSON.stringify({
        event: "notification:new",
        data: notification,
        timestamp: new Date().toISOString(),
      });

      userConnections.get(userId).forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event);
        }
      });
    }

    await Log(
      "backend",
      "info",
      "handler",
      `Notification created for user ${userId}`,
    );

    res.status(201).json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Notification creation failed: ${err.message}`,
    );
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

/**
 * GET /api/v1/notifications/:userId
 * Fetch paginated notifications for a user
 */
app.get("/api/v1/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, filter, sort = "-createdAt" } = req.query;

    await Log(
      "backend",
      "info",
      "handler",
      `Fetching notifications for user ${userId}`,
    );

    // TODO: Fetch from database with pagination (Stage 2)
    // For now, mock response
    res.status(200).json({
      success: true,
      data: {
        notifications: [], // TODO: Replace with DB query
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Failed to fetch notifications: ${err.message}`,
    );
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

/**
 * PATCH /api/v1/notifications/:notificationId
 * Mark notification as read
 */
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

    // TODO: Update in database (Stage 2)
    const notification = {
      id: notificationId,
      isRead,
      updatedAt: new Date().toISOString(),
    };

    // Broadcast event to user
    // TODO: Get userId from notification, then broadcast

    await Log(
      "backend",
      "info",
      "handler",
      `Notification ${notificationId} marked as read`,
    );

    res.status(200).json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Failed to update notification: ${err.message}`,
    );
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

/**
 * DELETE /api/v1/notifications/:notificationId
 * Delete a notification
 */
app.delete("/api/v1/notifications/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;

    // TODO: Delete from database (Stage 2)

    await Log(
      "backend",
      "info",
      "handler",
      `Notification ${notificationId} deleted`,
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Failed to delete notification: ${err.message}`,
    );
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

/**
 * POST /api/v1/notifications/bulk/mark-read
 * Mark multiple notifications as read
 */
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

    // TODO: Bulk update in database (Stage 2)

    await Log(
      "backend",
      "info",
      "handler",
      `Marked ${notificationIds.length} notifications as read for user ${userId}`,
    );

    res.status(200).json({
      success: true,
      data: {
        updated: notificationIds.length,
        failed: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Bulk mark-read failed: ${err.message}`,
    );
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

/**
 * POST /api/v1/notifications/notify-all
 * Send notification to all users (async, queued - Stage 5)
 */
app.post("/api/v1/notifications/notify-all", async (req, res) => {
  try {
    const {
      type,
      title,
      message,
      priority = "medium",
      metadata,
      targetUsers,
    } = req.body;

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

    // TODO: Queue job (Stage 5: Bull/RabbitMQ)
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await Log("backend", "info", "handler", `Notify-all job queued: ${jobId}`);

    res.status(202).json({
      success: true,
      data: {
        jobId,
        estimatedUsers: targetUsers?.length || "calculating",
        status: "queued",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await Log(
      "backend",
      "error",
      "handler",
      `Notify-all failed: ${err.message}`,
    );
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

/**
 * GET /api/v1/notifications/job/:jobId
 * Get status of async job
 */
app.get("/api/v1/notifications/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    // TODO: Query job status from queue (Stage 5)

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

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// ERROR HANDLING
// =====================================================

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

// =====================================================
// START SERVER
// =====================================================

server.listen(PORT, () => {
  console.log(`🚀 Notification Service running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time updates`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});

module.exports = server;
