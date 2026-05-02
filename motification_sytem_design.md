# Campus Notification System Design

## Stage 1: REST API Design 

### Overview

Designed a production-ready REST API for the campus notification system with real-time WebSocket support for live notification delivery.

### Endpoints

#### Create Notification

```
POST /api/v1/notifications
Content-Type: application/json

Request Body:
{
  "userId": "string (UUID, required)",
  "type": "string (enum: placement|interview|selection|rejection|event|announcement, required)",
  "title": "string (max 200 chars, required)",
  "message": "string (max 5000 chars, required)",
  "priority": "string (enum: low|medium|high|urgent, optional, default: medium)",
  "expiresAt": "ISO 8601 timestamp (optional)",
  "metadata": {
    "placementId": "string (optional)",
    "interviewId": "string (optional)",
    "companyName": "string (optional)",
    "actionUrl": "string (optional)"
  }
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "notif_...",
    "userId": "user-123",
    "type": "placement",
    "title": "...",
    "message": "...",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-05-02T10:30:00Z",
    "updatedAt": "2026-05-02T10:30:00Z",
    "expiresAt": null,
    "metadata": { ... }
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Get Notifications (Paginated)

```
GET /api/v1/notifications/:userId?page=1&limit=20&filter=type,priority,isRead&sort=-createdAt

Response (200 OK):
{
  "success": true,
  "data": {
    "notifications": [
      { /* notification objects */ }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "pages": 8
    }
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Mark as Read

```
PATCH /api/v1/notifications/:notificationId
Content-Type: application/json

Request Body:
{
  "isRead": true
}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "notif_...",
    "isRead": true,
    "updatedAt": "2026-05-02T10:35:00Z"
  },
  "timestamp": "2026-05-02T10:35:00Z"
}
```

#### Delete Notification

```
DELETE /api/v1/notifications/:notificationId

Response (200 OK):
{
  "success": true,
  "message": "Notification deleted successfully",
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Bulk Mark as Read

```
POST /api/v1/notifications/bulk/mark-read
Content-Type: application/json

Request Body:
{
  "notificationIds": ["notif_1", "notif_2", "notif_3"],
  "userId": "user-123"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "updated": 3,
    "failed": 0
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Notify All Users (Async)

```
POST /api/v1/notifications/notify-all
Content-Type: application/json

Request Body:
{
  "type": "announcement",
  "title": "Campus Drive Update",
  "message": "...",
  "priority": "high",
  "metadata": { ... },
  "targetUsers": ["user-1", "user-2"] (optional, if omitted sends to all)
}

Response (202 Accepted):
{
  "success": true,
  "data": {
    "jobId": "job_...",
    "estimatedUsers": 5000,
    "status": "queued"
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Check Async Job Status

```
GET /api/v1/notifications/job/:jobId

Response (200 OK):
{
  "success": true,
  "data": {
    "jobId": "job_...",
    "status": "processing",
    "progress": {
      "processed": 1234,
      "total": 5000,
      "percentage": 24.68
    }
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Health Check

```
GET /health

Response (200 OK):
{
  "status": "healthy",
  "service": "notification-service",
  "timestamp": "2026-05-02T10:30:00Z"
}
```

### Real-Time Mechanism: WebSocket

#### Connection & Subscription

```javascript
// Client-side
const ws = new WebSocket("ws://localhost:5000");

ws.onopen = () => {
  // Subscribe to user's notifications
  ws.send(JSON.stringify({
    type: "subscribe",
    userId: "user-123"
  }));
};

// Server response
{
  "event": "subscribed",
  "userId": "user-123",
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Event: New Notification

```
Event: notification:new
Fired when: New notification created for connected user

Payload:
{
  "event": "notification:new",
  "data": {
    "id": "notif_...",
    "userId": "user-123",
    "type": "placement",
    "title": "...",
    "message": "...",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-05-02T10:30:00Z",
    "metadata": { ... }
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

#### Event: Notification Read

```
Event: notification:read
Fired when: Notification marked as read

Payload:
{
  "event": "notification:read",
  "data": {
    "notificationId": "notif_...",
    "userId": "user-123",
    "timestamp": "2026-05-02T10:35:00Z"
  }
}
```

#### Event: Notification Deleted

```
Event: notification:deleted
Fired when: Notification deleted

Payload:
{
  "event": "notification:deleted",
  "data": {
    "notificationId": "notif_...",
    "userId": "user-123"
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

### Error Response Format

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE (e.g., VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, INTERNAL_ERROR)",
    "message": "Human-readable error message",
    "details": {
      /* optional validation details */
    }
  },
  "timestamp": "2026-05-02T10:30:00Z"
}
```

### Notification Type Taxonomy

| Type           | Use Case                | Priority Examples |
| -------------- | ----------------------- | ----------------- |
| `placement`    | Job offer notifications | medium, high      |
| `interview`    | Interview scheduling    | high, urgent      |
| `selection`    | Candidate selection     | high              |
| `rejection`    | Rejection notifications | low               |
| `event`        | Campus events           | low, medium       |
| `announcement` | General announcements   | low, medium       |

### Key Design Decisions

1. **Async Response (202 Accepted)** for `notify-all` to prevent timeout on bulk operations
2. **WebSocket over polling** for real-time to reduce server load and network traffic
3. **Pagination mandatory** for GET endpoints to prevent database overload
4. **Immutable IDs** generated server-side for audit trails
5. **Metadata object** for extensibility without schema changes
6. **Priority field** for Stage 6 priority inbox implementation
7. **Expiration support** for time-sensitive notifications

### Next Steps (Stage 2)

- Database schema with indexes
- User authentication & authorization
- Data persistence
- Query optimization strategies

---

**Status:** Stage 1 API Complete ✅
**Files:** `notification_app_be/server.js`, `notification_app_be/schemas.js`
**Implementation:** Production-ready with logging integration
