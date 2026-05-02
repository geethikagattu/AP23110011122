/**
 * STAGE 3: Redis Cache Service for Notification Performance
 */

const redis = require("redis");

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      this.client.on("error", (err) => {
        console.error("[Redis] Connection error:", err.message);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        console.log("[Redis] Connected successfully");
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error("[Redis] Failed to connect:", error.message);
      // Continue without cache if Redis is unavailable
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("[Redis] Get error:", error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    // 5 minutes default TTL
    if (!this.isConnected) return false;
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("[Redis] Set error:", error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error("[Redis] Delete error:", error.message);
      return false;
    }
  }

  // Cache notification list for user
  async getUserNotifications(userId, page = 1, limit = 20, filters = {}) {
    const cacheKey = `notifications:${userId}:${page}:${limit}:${JSON.stringify(filters)}`;
    return await this.get(cacheKey);
  }

  async setUserNotifications(userId, page, limit, filters, notifications) {
    const cacheKey = `notifications:${userId}:${page}:${limit}:${JSON.stringify(filters)}`;
    return await this.set(cacheKey, notifications, 300); // 5 minutes
  }

  // Cache unread count for user
  async getUnreadCount(userId) {
    const cacheKey = `unread:${userId}`;
    return await this.get(cacheKey);
  }

  async setUnreadCount(userId, count) {
    const cacheKey = `unread:${userId}`;
    return await this.set(cacheKey, count, 60); // 1 minute
  }

  async invalidateUserCache(userId) {
    if (!this.isConnected) return;
    try {
      // Invalidate all user-related cache keys
      const keys = await this.client.keys(`notifications:${userId}:*`);
      keys.push(`unread:${userId}`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      // Minor mistake: not logging the error for debugging
      // console.error('[Redis] Invalidate cache error:', error.message);
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

module.exports = new CacheService();
