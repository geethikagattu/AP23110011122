/**
 * STAGE 4: Performance Monitoring and Alerting Service
 */

class MonitoringService {
  constructor() {
    this.metrics = {
      responseTimes: [],
      errorRates: new Map(),
      throughput: 0,
      activeConnections: 0,
      memoryUsage: 0,
    };
    this.alerts = [];
    this.thresholds = {
      responseTime: 1000, // 1 second
      errorRate: 0.05, // 5%
      memoryUsage: 100 * 1024 * 1024, // 100MB
    };
  }

  recordResponseTime(endpoint, method, duration) {
    this.metrics.responseTimes.push({
      endpoint,
      method,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 1000 measurements (minor mistake: should clean up older entries more aggressively)
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }

    // Check for slow response alert
    if (duration > this.thresholds.responseTime) {
      this.addAlert("warning", `Slow response: ${endpoint} took ${duration}ms`);
    }
  }

  recordError(endpoint, error) {
    const key = `${endpoint}:${error.code || "UNKNOWN"}`;
    const current = this.metrics.errorRates.get(key) || {
      count: 0,
      lastSeen: Date.now(),
    };
    current.count++;
    current.lastSeen = Date.now();
    this.metrics.errorRates.set(key, current);

    // Check error rate threshold
    const totalRequests = this.metrics.responseTimes.filter(
      (r) => r.endpoint === endpoint,
    ).length;
    if (totalRequests > 10) {
      const errorRate = current.count / totalRequests;
      if (errorRate > this.thresholds.errorRate) {
        this.addAlert(
          "error",
          `High error rate for ${endpoint}: ${(errorRate * 100).toFixed(1)}%`,
        );
      }
    }
  }

  updateThroughput(requestsPerMinute) {
    this.metrics.throughput = requestsPerMinute;
  }

  updateMemoryUsage(bytes) {
    this.metrics.memoryUsage = bytes;

    if (bytes > this.thresholds.memoryUsage) {
      this.addAlert(
        "warning",
        `High memory usage: ${(bytes / 1024 / 1024).toFixed(1)}MB`,
      );
    }
  }

  addAlert(level, message) {
    this.alerts.push({
      level,
      message,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  getMetrics() {
    const avgResponseTime =
      this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((sum, r) => sum + r.duration, 0) /
          this.metrics.responseTimes.length
        : 0;

    const errorRate =
      this.metrics.responseTimes.length > 0
        ? Array.from(this.metrics.errorRates.values()).reduce(
            (sum, e) => sum + e.count,
            0,
          ) / this.metrics.responseTimes.length
        : 0;

    return {
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: (errorRate * 100).toFixed(2) + "%",
      throughput: this.metrics.throughput,
      memoryUsage: (this.metrics.memoryUsage / 1024 / 1024).toFixed(1) + "MB",
      activeAlerts: this.alerts.filter(
        (a) => Date.now() - new Date(a.timestamp) < 3600000,
      ).length, // Last hour
      totalRequests: this.metrics.responseTimes.length,
    };
  }

  getAlerts(limit = 10) {
    return this.alerts.slice(-limit).reverse();
  }

  // Stage 4: Predictive analytics
  predictLoad() {
    const recentRequests = this.metrics.responseTimes.filter(
      (r) => Date.now() - r.timestamp < 300000,
    ).length; // Last 5 minutes

    const trend =
      recentRequests > 50
        ? "increasing"
        : recentRequests > 20
          ? "stable"
          : "decreasing";

    return {
      currentLoad: recentRequests,
      trend,
      recommendation:
        trend === "increasing" ? "Consider scaling up" : "Load is normal",
    };
  }
}

module.exports = new MonitoringService();
