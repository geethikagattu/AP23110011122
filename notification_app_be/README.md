# Notification Service - Stage 2: MongoDB Persistence

Production-ready notification microservice for campus notifications with MongoDB persistence and WebSocket real-time delivery.

## Features

✅ **REST API Endpoints** — CRUD operations for notifications
✅ **MongoDB Persistence** — Notification storage with indexing and pagination
✅ **Real-time WebSocket** — Live notification delivery to connected clients
✅ **Filtering & Sorting** — Efficient query support for type, priority, and read status
✅ **Async Job Support** — Bulk notify-all job pattern
✅ **Integrated Logging** — Logs sent to evaluation service via shared middleware

## Setup

### Installation
```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB connection string and auth token
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
| POST   | `/api/v1/notifications/notify-all`      | Send notification to many users     |
| GET    | `/api/v1/notifications/job/:jobId`      | Check async job status              |

### Health

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/health` | Service health check |

## Database Integration

### MongoDB Schema

The service stores notifications in MongoDB using a schema optimized for user-specific reads and expiration:

- `userId` — string, indexed for fast user queries
- `type` — enum: placement, interview, selection, rejection, event, announcement
- `title` — string, required
- `message` — string, required
- `priority` — enum: low, medium, high, urgent
- `isRead` — boolean, default false
- `expiresAt` — date, optional TTL cleanup
- `metadata` — object for extensible payload
- `createdAt`, `updatedAt` — auto timestamps

### Indexing Strategy

- `userId + createdAt` for paginated user notification retrieval
- `expiresAt` TTL index for auto cleanup of stale messages

### Query Examples

```js
// User notification list
Notification.find({ userId })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);

// Bulk mark read
Notification.updateMany(
  { _id: { $in: notificationIds }, userId },
  { isRead: true, updatedAt: new Date() },
);
```

## Real-Time Updates (WebSocket)

The same WebSocket subscription model remains in Stage 2. Users subscribe with their `userId`, and the service pushes:

- `notification:new`
- `notification:read`
- `notification:deleted`

## Environment Variables

- `PORT`
- `EVALUATION_SERVICE_TOKEN`
- `DB_CONNECTION_STRING`

## Notes

- `.env` is ignored and should never be committed.
- `notification_app_be/.env.example` provides a safe template.

## Next Stages

- **Stage 3:** Query optimization, indexing, and slow query fix
- **Stage 4:** Redis caching and lazy loading
- **Stage 5:** Reliable async queue and retry handling
- **Stage 6:** Priority inbox with scoring and max-heap
