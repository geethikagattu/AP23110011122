const mongoose = require("mongoose");

const validTypes = [
  "placement",
  "interview",
  "selection",
  "rejection",
  "event",
  "announcement",
];
const validPriorities = ["low", "medium", "high", "urgent"];

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: validTypes,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: validPriorities,
      default: "medium",
    },
    priorityScore: {
      type: Number,
      default: function () {
        // Calculate priority score based on type and priority
        const typeScores = {
          interview: 100,
          selection: 90,
          placement: 80,
          rejection: 70,
          announcement: 50,
          event: 30,
        };
        const priorityScores = {
          urgent: 50,
          high: 30,
          medium: 20,
          low: 10,
        };
        return (
          (typeScores[this.type] || 50) + (priorityScores[this.priority] || 20)
        );
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Add fields for caching and performance tracking
    lastAccessed: {
      type: Date,
      default: Date.now,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Stage 3: Optimized indexes for query performance
NotificationSchema.index({ userId: 1, createdAt: -1 }); // For paginated user queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 }); // For unread notifications
NotificationSchema.index({ userId: 1, priorityScore: -1, createdAt: -1 }); // For priority sorting
NotificationSchema.index({ type: 1, createdAt: -1 }); // For type-based filtering
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for expired notifications
NotificationSchema.index({ lastAccessed: 1 }, { expireAfterSeconds: 604800 }); // 7 days for access tracking

// Pre-save middleware to update priority score
NotificationSchema.pre("save", function (next) {
  if (this.isModified("type") || this.isModified("priority")) {
    const typeScores = {
      interview: 100,
      selection: 90,
      placement: 80,
      rejection: 70,
      announcement: 50,
      event: 30,
    };
    const priorityScores = {
      urgent: 50,
      high: 30,
      medium: 20,
      low: 10,
    };
    this.priorityScore =
      (typeScores[this.type] || 50) + (priorityScores[this.priority] || 20);
  }
  next();
});

// Static method for slow query analysis
NotificationSchema.statics.analyzeSlowQueries = async function () {
  const analysis = await this.aggregate([
    {
      $group: {
        _id: { userId: "$userId", type: "$type" },
        count: { $sum: 1 },
        avgAccessCount: { $avg: "$accessCount" },
        lastAccessed: { $max: "$lastAccessed" },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
  ]);
  return analysis;
};

module.exports = mongoose.model("Notification", NotificationSchema);
