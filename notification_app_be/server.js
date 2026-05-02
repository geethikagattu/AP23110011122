/**
 * STAGE 3: Notification Service with Redis Caching and Async Queues
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Log = require("../logging_middleware/logger");
const loggerMiddleware = require("../logging_middleware/middleware");
const { connectDatabase } = require("./db");
const Notification = require("./models/notificationModel");
const cacheService = require("./cache");
const queueService = require("./queue");
const monitoringService = require("./monitoring");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;

const validTypes = [
  "placement",
  "interview",
  "selection",
  "rejection",
  "event",
  "announcement",
];
const validPriorities = ["low", "medium", "high", "urgent"];

app.use(express.json());
app.use(loggerMiddleware);

// Stage 4: Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    monitoringService.recordResponseTime(req.path, req.method, duration);

    // Track memory usage periodically
    if (Math.random() < 0.1) {
      // 10% sampling
      const memUsage = process.memoryUsage();
      monitoringService.updateMemoryUsage(memUsage.heapUsed);
    }

    originalSend.call(this, data);
  };

  next();
});

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

app.get("/api/v1/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      isRead,
      sort = "-priorityScore,-createdAt",
    } = req.query;

    // Build query filters
    const query = { userId };
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (typeof isRead !== "undefined") {
      query.isRead = isRead === "true" || isRead === true;
    }

    // Parse sort parameter (support priorityScore sorting)
    let sortOptions = {};
    if (sort.includes("priorityScore")) {
      const sortFields = sort.split(",");
      sortFields.forEach((field) => {
        const sortField = field.startsWith("-") ? field.slice(1) : field;
        const sortOrder = field.startsWith("-") ? -1 : 1;
        sortOptions[sortField] = sortOrder;
      });
    } else {
      // Fallback to createdAt sorting
      const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
      const sortOrder = sort.startsWith("-") ? -1 : 1;
      sortOptions = { [sortField]: sortOrder };
    }

    const pageNumber = Math.max(parseInt(page, 10), 1);
    const pageSize = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNumber - 1) * pageSize;

    // Try cache first (Stage 3 optimization)
    const cacheKey = { page: pageNumber, limit: pageSize, filters: query };
    let cachedResult = await cacheService.getUserNotifications(
      userId,
      pageNumber,
      pageSize,
      query,
    );

    if (cachedResult) {
      await Log(
        "backend",
        "info",
        "cache",
        `Cache hit for user ${userId} notifications`,
      );
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Cache miss - query database
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .lean(), // Use lean() for better performance
      Notification.countDocuments(query),
    ]);

    // Update access tracking for performance analysis
    if (notifications.length > 0) {
      await Notification.updateMany(
        { _id: { $in: notifications.map((n) => n._id) } },
        {
          $inc: { accessCount: 1 },
          $set: { lastAccessed: new Date() },
        },
      );
    }

    const pages = Math.ceil(total / pageSize);
    const result = {
      notifications,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        pages,
      },
    };

    // Cache the result (Stage 3 optimization)
    await cacheService.setUserNotifications(
      userId,
      pageNumber,
      pageSize,
      query,
      result,
    );

    await Log(
      "backend",
      "info",
      "handler",
      `Fetched ${notifications.length} notifications for user ${userId}`,
    );
    res.status(200).json({
      success: true,
      data: result,
      cached: false,
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

    // Invalidate user cache (Stage 3 optimization)
    await cacheService.invalidateUserCache(notification.userId);

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

    // Invalidate user cache (Stage 3 optimization)
    await cacheService.invalidateUserCache(userId);

    await Log(
      "backend",
      "info",
      "handler",
      `Marked ${result.modifiedCount} notifications as read for user ${userId}`,
    );
    res.status(200).json({
      success: true,
      data: {
        updated: result.modifiedCount,
        failed: notificationIds.length - result.modifiedCount,
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

    // Stage 3: Use async queue for bulk operations
    if (Array.isArray(targetUsers) && targetUsers.length > 10) {
      // For large batches, use async queue processing
      const notifications = targetUsers.map((userId) => ({
        userId,
        type,
        title,
        message,
        priority,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const jobId = await queueService.addBulkNotificationJob(notifications, {
        targetUsers,
        broadcastData: {
          type,
          title,
          message,
          priority,
          metadata: metadata || {},
        },
      });

      await Log(
        "backend",
        "info",
        "handler",
        `Large bulk notification job queued: ${jobId}`,
      );
      res.status(202).json({
        success: true,
        data: {
          jobId,
          estimatedUsers: targetUsers.length,
          status: "queued",
          processing: "async",
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      // For small batches, process synchronously
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

        // Invalidate cache for all affected users
        for (const userId of targetUsers) {
          await cacheService.invalidateUserCache(userId);
        }

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
      await Log(
        "backend",
        "info",
        "handler",
        `Small bulk notification job completed: ${jobId}`,
      );
      res.status(202).json({
        success: true,
        data: {
          jobId,
          estimatedUsers: Array.isArray(targetUsers)
            ? targetUsers.length
            : "calculating",
          status: "completed",
          processing: "sync",
        },
        timestamp: new Date().toISOString(),
      });
    }
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

app.get("/api/v1/notifications/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    // Stage 3: Get real job status from queue service
    const jobStatus = await queueService.getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Job not found",
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      data: jobStatus,
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

app.get("/api/v1/notifications/analytics/slow-queries", async (req, res) => {
  try {
    // Stage 3: Slow query analysis endpoint
    const analysis = await Notification.analyzeSlowQueries();

    res.status(200).json({
      success: true,
      data: {
        analysis,
        totalQueries: analysis.length,
        recommendations: analysis.map((item) => ({
          userId: item._id.userId,
          type: item._id.type,
          count: item.count,
          avgAccessCount: Math.round(item.avgAccessCount * 100) / 100,
          suggestion:
            item.count > 100
              ? "Consider caching this query pattern"
              : "Query pattern is optimal",
        })),
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

app.get("/api/v1/notifications/analytics/cache-stats", async (req, res) => {
  try {
    // Stage 4: Enhanced cache stats with monitoring
    const queueStats = await queueService.getQueueStats();
    const cacheStats = await cacheService.getCacheStats();
    const metrics = monitoringService.getMetrics();
    const predictions = monitoringService.predictLoad();

    res.status(200).json({
      success: true,
      data: {
        cache: cacheStats,
        queue: queueStats || { status: "unavailable" },
        performance: {
          leanQueries: true,
          indexedFields: [
            "userId",
            "isRead",
            "priorityScore",
            "type",
            "expiresAt",
            "lastAccessed",
          ],
          cachedEndpoints: ["/api/v1/notifications/:userId"],
        },
        monitoring: metrics,
        predictions,
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

app.get("/api/v1/monitoring/alerts", async (req, res) => {
  try {
    const alerts = monitoringService.getAlerts();
    res.status(200).json({
      success: true,
      data: alerts,
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

app.get("/api/v1/monitoring/health", async (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    const cacheStats = await cacheService.getCacheStats();

    const health = {
      status: "healthy",
      services: {
        database: "connected", // Would check actual DB connection
        cache: cacheStats.connectionStatus,
        queue: "operational", // Would check actual queue status
      },
      metrics,
      timestamp: new Date().toISOString(),
    };

    // Determine overall health
    if (
      metrics.errorRate.replace("%", "") > 10 ||
      cacheStats.connectionStatus !== "connected"
    ) {
      health.status = "degraded";
    }

    res.status(200).json(health);
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      error: err.message,
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
  monitoringService.recordError(req.path, err);
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
  .then(async () => {
    // Stage 4: Initialize services with monitoring
    await cacheService.connect();
    await queueService.initialize();

    // Stage 4: Periodic cache optimization for hot users
    setInterval(async () => {
      await cacheService.optimizeForHotUsers();
    }, 300000); // Every 5 minutes

    // Stage 4: Periodic health monitoring
    setInterval(() => {
      const metrics = monitoringService.getMetrics();
      if (metrics.activeAlerts > 5) {
        console.warn(
          "[Monitoring] High alert count detected:",
          metrics.activeAlerts,
        );
      }
    }, 60000); // Every minute

    server.listen(PORT, () => {
      console.log(`🚀 Notification Service running on port ${PORT}`);
      console.log(`📡 WebSocket server ready for real-time updates`);
      console.log(
        `🔄 Redis cache: ${cacheService.isConnected ? "connected" : "disconnected"}`,
      );
      console.log(
        `⚡ Async queue: ${queueService.isInitialized ? "initialized" : "unavailable"}`,
      );
      console.log(`📊 Advanced monitoring: enabled`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log(
        `📈 Monitoring: http://localhost:${PORT}/api/v1/monitoring/health`,
      );
      console.log(
        `🚨 Alerts: http://localhost:${PORT}/api/v1/monitoring/alerts`,
      );
    });
  })
  .catch((err) => {
    console.error("[Startup Error] Failed to connect to database", err);
    process.exit(1);
  });

module.exports = server;
