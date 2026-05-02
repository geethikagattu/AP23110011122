# Notification Service - Stage 1: REST API Design

Production-ready REST API for campus notifications with real-time WebSocket support.

## Features

✅ **REST API Endpoints** — CRUD operations for notifications
✅ **Real-time WebSocket** — Live notification delivery to connected clients
✅ **Pagination & Filtering** — Efficient data retrieval
✅ **Async Job Queue** — Bulk operations (Stage 5 ready)
✅ **Structured Schemas** — JSON request/response validation
✅ **Integrated Logging** — All operations logged to evaluation service

## Setup

### Installation

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Notifications

| Method | Endpoint                                | Description                         |
| ------ | --------------------------------------- | ----------------------------------- |
| POST   | `/api/v1/notifications`                 | Create notification                 |
| GET    | `/api/v1/notifications/:userId`         | List user notifications (paginated) |
| PATCH  | `/api/v1/notifications/:notificationId` | Mark as read                        |
| DELETE | `/api/v1/notifications/:notificationId` | Delete notification                 |
| POST   | `/api/v1/notifications/bulk/mark-read`  | Bulk mark as read                   |
| POST   | `/api/v1/notifications/notify-all`      | Send to all users (async)           |
| GET    | `/api/v1/notifications/job/:jobId`      | Check async job status              |

### Health

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/health` | Service health check |

## JSON Schemas

See `schemas.js` for complete request/response documentation:

- Notification object structure
- Request body formats
- Pagination format
- WebSocket event formats
- Error responses

## Real-Time Updates (WebSocket)

### Connection

```javascript
const ws = new WebSocket("ws://localhost:5000");

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "subscribe",
      userId: "user-123",
    }),
  );
};
```

### Events Received

```javascript
// New notification received
{
  event: "notification:new",
  data: { /* notification object */ },
  timestamp: "2026-05-02T10:30:00Z"
}

// Notification marked as read
{
  event: "notification:read",
  data: {
    notificationId: "notif_...",
    userId: "user-123"
  }
}

// Notification deleted
{
  event: "notification:deleted",
  data: {
    notificationId: "notif_...",
    userId: "user-123"
  }
}
```

## Authentication

Currently using Bearer token from `EVALUATION_SERVICE_TOKEN` environment variable. All logs include this token.

**TODO Stage 2+:** Add user authentication middleware.

## Database Integration

Currently mocked. Implementation in **Stage 2**:

- MongoDB connection
- Schema design
- Indexing strategy

## Caching & Performance

**TODO Stage 4:**

- Redis caching for frequent queries
- Lazy loading for notification lists
- Pagination optimization

## Async Operations

**TODO Stage 5:**

- Bull queue for notify-all jobs
- Retry logic
- Separate workers for email/DB/push

## Next Stages

- **Stage 2:** Database schema & optimization
- **Stage 3:** Query optimization & indexing
- **Stage 4:** Caching strategy & pagination
- **Stage 5:** Async queue & reliability
- **Stage 6:** Priority Inbox with heap

---

**Status:** Stage 1 Complete ✅ (Ready for Stage 2: DB Schema)
