/**
 * STAGE 5: Rate Limiting Service for API Protection
 */

class RateLimiter {
  constructor() {
    this.requests = new Map(); // userId -> { count, resetTime }
    this.limits = {
      notifications: { max: 100, window: 60000 }, // 100 requests per minute
      bulk: { max: 10, window: 300000 }, // 10 bulk operations per 5 minutes
      analytics: { max: 50, window: 300000 }, // 50 analytics requests per 5 minutes
    };
  }

  checkLimit(userId, endpoint) {
    const now = Date.now();
    const key = `${userId}:${endpoint}`;

    if (!this.requests.has(key)) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.getWindow(endpoint),
      });
      return { allowed: true, remaining: this.getMax(endpoint) - 1 };
    }

    const userRequests = this.requests.get(key);

    // Reset if window has passed
    if (now > userRequests.resetTime) {
      userRequests.count = 1;
      userRequests.resetTime = now + this.getWindow(endpoint);
      return { allowed: true, remaining: this.getMax(endpoint) - 1 };
    }

    // Check if limit exceeded
    if (userRequests.count >= this.getMax(endpoint)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: userRequests.resetTime,
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      };
    }

    // Increment counter
    userRequests.count++;
    return {
      allowed: true,
      remaining: this.getMax(endpoint) - userRequests.count,
    };
  }

  getMax(endpoint) {
    if (endpoint.includes("/bulk/")) return this.limits.bulk.max;
    if (endpoint.includes("/analytics/")) return this.limits.analytics.max;
    return this.limits.notifications.max;
  }

  getWindow(endpoint) {
    if (endpoint.includes("/bulk/")) return this.limits.bulk.window;
    if (endpoint.includes("/analytics/")) return this.limits.analytics.window;
    return this.limits.notifications.window;
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  getStats() {
    return {
      activeLimits: this.requests.size,
      limits: this.limits,
    };
  }
}

module.exports = new RateLimiter();
