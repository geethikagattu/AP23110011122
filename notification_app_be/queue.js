/**
 * STAGE 3: Async Queue Service for Bulk Operations
 */

const { Queue, Worker } = require("bullmq");
const Notification = require("./models/notificationModel");

class QueueService {
  constructor() {
    this.notificationQueue = null;
    this.bulkNotificationWorker = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Create queue for bulk notifications
      this.notificationQueue = new Queue("bulk-notifications", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 20,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      });

      // Create worker to process bulk notification jobs
      this.bulkNotificationWorker = new Worker(
        "bulk-notifications",
        async (job) => {
          const { notifications, broadcastData } = job.data;
          console.log(
            `[Queue] Processing bulk notification job ${job.id} with ${notifications.length} notifications`,
          );

          try {
            // Insert notifications in batches
            const batchSize = 100;
            for (let i = 0; i < notifications.length; i += batchSize) {
              const batch = notifications.slice(i, i + batchSize);
              await Notification.insertMany(batch);
            }

            // Broadcast to users (simulate real-time updates)
            if (broadcastData && broadcastData.targetUsers) {
              // In a real implementation, you'd broadcast to WebSocket connections
              console.log(
                `[Queue] Broadcasting to ${broadcastData.targetUsers.length} users`,
              );
            }

            return { processed: notifications.length, success: true };
          } catch (error) {
            console.error(`[Queue] Job ${job.id} failed:`, error.message);
            throw error;
          }
        },
        {
          connection: {
            host: process.env.REDIS_HOST || "localhost",
            port: process.env.REDIS_PORT || 6379,
          },
          concurrency: 2, // Process 2 jobs concurrently
        },
      );

      // Worker event handlers
      this.bulkNotificationWorker.on("completed", (job) => {
        console.log(`[Queue] Job ${job.id} completed successfully`);
      });

      this.bulkNotificationWorker.on("failed", (job, err) => {
        console.error(`[Queue] Job ${job.id} failed:`, err.message);
      });

      this.isInitialized = true;
      console.log("[Queue] Async queue service initialized");
    } catch (error) {
      console.error("[Queue] Failed to initialize:", error.message);
      // Continue without queue if Redis is unavailable
      this.isInitialized = false;
    }
  }

  async addBulkNotificationJob(notifications, broadcastData = null) {
    if (!this.isInitialized) {
      throw new Error("Queue service not initialized");
    }

    const job = await this.notificationQueue.add("bulk-notify", {
      notifications,
      broadcastData,
      timestamp: new Date().toISOString(),
    });

    return job.id;
  }

  async getJobStatus(jobId) {
    if (!this.isInitialized) return null;

    try {
      const job = await this.notificationQueue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();
      const progress = job.progress || 0;

      return {
        jobId,
        status: state,
        progress: {
          processed: progress,
          total: job.data.notifications?.length || 0,
          percentage: job.data.notifications?.length
            ? Math.round((progress / job.data.notifications.length) * 100)
            : 0,
        },
        createdAt: job.opts.timestamp,
        finishedAt: job.finishedOn,
      };
    } catch (error) {
      console.error("[Queue] Error getting job status:", error.message);
      return null;
    }
  }

  async getQueueStats() {
    if (!this.isInitialized) return null;

    try {
      const waiting = await this.notificationQueue.getWaiting();
      const active = await this.notificationQueue.getActive();
      const completed = await this.notificationQueue.getCompleted();
      const failed = await this.notificationQueue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total:
          waiting.length + active.length + completed.length + failed.length,
      };
    } catch (error) {
      console.error("[Queue] Error getting queue stats:", error.message);
      return null;
    }
  }

  async close() {
    if (this.bulkNotificationWorker) {
      await this.bulkNotificationWorker.close();
    }
    if (this.notificationQueue) {
      await this.notificationQueue.close();
    }
    this.isInitialized = false;
  }
}

module.exports = new QueueService();
