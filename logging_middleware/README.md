# Logging Middleware

Production-ready logging middleware for Affordmed Campus Hiring Evaluation.

## Setup

1. **Install dependencies:**

   ```bash
   npm install axios
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env and add your EVALUATION_SERVICE_TOKEN
   ```

3. **Integrate into your Express app:**

   ```javascript
   const express = require("express");
   const loggerMiddleware = require("./logging_middleware/middleware");

   const app = express();
   app.use(loggerMiddleware);
   ```

## API

### `Log(stack, level, package, message)`

Logs a message to the evaluation service.

**Parameters:**

- `stack` (string): `"backend"` or `"frontend"`
- `level` (string): `"debug"` | `"info"` | `"warn"` | `"error"` | `"fatal"`
- `package` (string):
  - Backend: `"handler"` | `"repository"` | `"route"` | `"service"`
  - Frontend: `"component"` | `"service"` | `"util"` | `"store"`
- `message` (string): Log message

**Returns:** Promise resolving to API response data

**Example:**

```javascript
const Log = require("./logging_middleware/logger");

await Log("backend", "error", "handler", "User authentication failed");
```

## Validation

The Log function validates:

- Valid stack (backend/frontend)
- Valid log level
- Valid package for the stack type
- Bearer token present in environment
- 5-second API timeout

## Features

- Bearer token authentication
- Environment-based configuration
- Input validation with clear error messages
- Non-blocking logging (fires after response finishes)
- Graceful error handling (won't crash app if logging fails)
