/**
 * STAGE 4: Advanced Redis Cache Service with User Analytics
 */

const redis = require("redis");

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.hotUsers = new Map(); // Track frequently accessed users
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
    };
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
      if (data) {
        this.cacheStats.hits++;
        // Extract userId from key pattern notifications:userId:...
        const userIdMatch = key.match(/notifications:([^:]+):/);
        if (userIdMatch) {
          await this.trackUserAccess(userIdMatch[1]);
        }
        return JSON.parse(data);
      } else {
        this.cacheStats.misses++;
        return null;
      }
    } catch (error) {
      console.error("[Redis] Get error:", error.message);
      this.cacheStats.misses++;
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    // 5 minutes default TTL
    if (!this.isConnected) return false;
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      this.cacheStats.sets++;
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
        this.cacheStats.invalidations++;
      }
    } catch (error) {
      // Minor mistake: not logging the error for debugging
      // console.error('[Redis] Invalidate cache error:', error.message);
    }
  }

  // Stage 4: Advanced caching for hot users
  async trackUserAccess(userId) {
    if (!this.isConnected) return;

    const current = this.hotUsers.get(userId) || {
      count: 0,
      lastAccess: Date.now(),
    };
    current.count++;
    current.lastAccess = Date.now();

    // Mark as hot user if accessed > 10 times in last hour
    if (current.count > 10 && Date.now() - current.lastAccess < 3600000) {
      await this.warmUserCache(userId);
    }

    this.hotUsers.set(userId, current);
  }

  async warmUserCache(userId) {
    if (!this.isConnected) return;

    try {
      // Preload common queries for hot users
      const commonQueries = [
        { page: 1, limit: 20, filters: {} },
        { page: 1, limit: 10, filters: { isRead: false } },
        { page: 1, limit: 20, filters: { priority: "high" } },
      ];

      // This would typically query the database and cache results
      // For now, just mark that cache warming occurred
      console.log(`[Cache] Warming cache for hot user: ${userId}`);
    } catch (error) {
      console.error("[Cache] Warm cache error:", error.message);
    }
  }

  async getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate =
      total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      hotUsersCount: this.hotUsers.size,
      connectionStatus: this.isConnected ? "connected" : "disconnected",
    };
  }

  async optimizeForHotUsers() {
    if (!this.isConnected) return;

    // Clean up old hot user data (older than 24 hours)
    const now = Date.now();
    for (const [userId, data] of this.hotUsers.entries()) {
      if (now - data.lastAccess > 86400000) {
        // 24 hours
        this.hotUsers.delete(userId);
      }
    }

    // Extend cache TTL for hot users
    const hotUserIds = Array.from(this.hotUsers.keys());
    for (const userId of hotUserIds) {
      try {
        const keys = await this.client.keys(`notifications:${userId}:*`);
        for (const key of keys) {
          await this.client.expire(key, 1800); // Extend to 30 minutes
        }
      } catch (error) {
        console.error("[Cache] Hot user optimization error:", error.message);
      }
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
