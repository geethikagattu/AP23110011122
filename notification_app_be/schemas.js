/**
 * STAGE 1: JSON Schemas for Notification Service
 * Defines request/response structures and validation rules
 */

// =====================================================
// NOTIFICATION OBJECT SCHEMA
// =====================================================
const NotificationSchema = {
  id: "string (UUID)",
  userId: "string (UUID)",
  type: "enum: 'placement', 'interview', 'selection', 'rejection', 'event', 'announcement'",
  title: "string (max 200 chars)",
  message: "string (max 5000 chars)",
  priority: "enum: 'low', 'medium', 'high', 'urgent'",
  isRead: "boolean",
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp",
  expiresAt: "ISO 8601 timestamp (optional)",
  metadata: {
    placementId: "string (optional)",
    interviewId: "string (optional)",
    companyName: "string (optional)",
    actionUrl: "string (optional)",
  },
};

// =====================================================
// ENDPOINTS & REQUEST/RESPONSE SCHEMAS
// =====================================================

/**
 * POST /api/v1/notifications
 * Create a new notification
 */
const CreateNotificationRequest = {
  userId: "string (required)",
  type: "string (required, enum)",
  title: "string (required)",
  message: "string (required)",
  priority: "string (optional, default: 'medium')",
  expiresAt: "ISO 8601 timestamp (optional)",
  metadata: "object (optional)",
};

const CreateNotificationResponse = {
  success: "boolean",
  data: NotificationSchema,
  timestamp: "ISO 8601 timestamp",
};

/**
 * GET /api/v1/notifications/:userId
 * Fetch notifications for a user (paginated)
 * Query params: page=1, limit=20, filter=type,priority,isRead, sort=createdAt
 */
const GetNotificationsResponse = {
  success: "boolean",
  data: {
    notifications: "array of NotificationSchema",
    pagination: {
      total: "number",
      page: "number",
      limit: "number",
      pages: "number",
    },
  },
  timestamp: "ISO 8601 timestamp",
};

/**
 * PATCH /api/v1/notifications/:notificationId
 * Mark notification as read
 */
const UpdateNotificationRequest = {
  isRead: "boolean",
};

const UpdateNotificationResponse = {
  success: "boolean",
  data: NotificationSchema,
  timestamp: "ISO 8601 timestamp",
};

/**
 * DELETE /api/v1/notifications/:notificationId
 * Delete a notification
 */
const DeleteNotificationResponse = {
  success: "boolean",
  message: "string",
  timestamp: "ISO 8601 timestamp",
};

/**
 * POST /api/v1/notifications/bulk/mark-read
 * Mark multiple notifications as read (for bulk operations)
 */
const BulkMarkReadRequest = {
  notificationIds: "array of strings (required)",
  userId: "string (required)",
};

const BulkMarkReadResponse = {
  success: "boolean",
  data: {
    updated: "number",
    failed: "number",
  },
  timestamp: "ISO 8601 timestamp",
};

/**
 * POST /api/v1/notifications/notify-all
 * Send notification to all users (Stage 5: async, queued)
 */
const NotifyAllRequest = {
  type: "string (required, enum)",
  title: "string (required)",
  message: "string (required)",
  priority: "string (optional)",
  metadata: "object (optional)",
  targetUsers: "array of strings (optional, filter by user IDs)",
};

const NotifyAllResponse = {
  success: "boolean",
  data: {
    jobId: "string (UUID, for tracking async job)",
    estimatedUsers: "number",
    status: "queued",
  },
  timestamp: "ISO 8601 timestamp",
};

/**
 * GET /api/v1/notifications/job/:jobId
 * Get status of async notify-all job
 */
const JobStatusResponse = {
  success: "boolean",
  data: {
    jobId: "string",
    status: "enum: 'queued', 'processing', 'completed', 'failed'",
    progress: {
      processed: "number",
      total: "number",
      percentage: "number",
    },
    errors: "array (if any failed)",
  },
  timestamp: "ISO 8601 timestamp",
};

// =====================================================
// REAL-TIME EVENTS (WebSocket/SSE)
// =====================================================

/**
 * WebSocket Event: notification:new
 * Broadcast when new notification created for a user
 */
const WebSocketNewNotificationEvent = {
  event: "notification:new",
  data: NotificationSchema,
  timestamp: "ISO 8601 timestamp",
};

/**
 * WebSocket Event: notification:read
 * Broadcast when notification marked as read
 */
const WebSocketReadEvent = {
  event: "notification:read",
  data: {
    notificationId: "string",
    userId: "string",
    timestamp: "ISO 8601 timestamp",
  },
};

/**
 * WebSocket Event: notification:deleted
 * Broadcast when notification deleted
 */
const WebSocketDeletedEvent = {
  event: "notification:deleted",
  data: {
    notificationId: "string",
    userId: "string",
  },
  timestamp: "ISO 8601 timestamp",
};

// =====================================================
// ERROR RESPONSES
// =====================================================

const ErrorResponse = {
  success: "boolean (always false)",
  error: {
    code: "string (e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED')",
    message: "string (human-readable)",
    details: "object (optional, validation details)",
  },
  timestamp: "ISO 8601 timestamp",
};

module.exports = {
  NotificationSchema,
  CreateNotificationRequest,
  CreateNotificationResponse,
  GetNotificationsResponse,
  UpdateNotificationRequest,
  UpdateNotificationResponse,
  DeleteNotificationResponse,
  BulkMarkReadRequest,
  BulkMarkReadResponse,
  NotifyAllRequest,
  NotifyAllResponse,
  JobStatusResponse,
  WebSocketNewNotificationEvent,
  WebSocketReadEvent,
  WebSocketDeletedEvent,
  ErrorResponse,
};
