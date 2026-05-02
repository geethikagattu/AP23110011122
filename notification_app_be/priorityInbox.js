/**
 * STAGE 6: Priority Inbox with Scoring and Max-Heap
 * Implements priority-based notification retrieval using scoring algorithm and max-heap data structure
 */

class MaxHeap {
  constructor() {
    this.heap = [];
  }

  // Helper method to get parent index
  getParentIndex(index) {
    return Math.floor((index - 1) / 2);
  }

  // Helper method to get left child index
  getLeftChildIndex(index) {
    return 2 * index + 1;
  }

  // Helper method to get right child index
  getRightChildIndex(index) {
    return 2 * index + 2;
  }

  // Swap two elements in the heap
  swap(index1, index2) {
    [this.heap[index1], this.heap[index2]] = [
      this.heap[index2],
      this.heap[index1],
    ];
  }

  // Insert a new element into the heap
  insert(notification) {
    this.heap.push(notification);
    this.heapifyUp(this.heap.length - 1);
  }

  // Heapify up to maintain heap property
  heapifyUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = this.getParentIndex(currentIndex);
      if (
        this.heap[currentIndex].priorityScore >
        this.heap[parentIndex].priorityScore
      ) {
        this.swap(currentIndex, parentIndex);
        currentIndex = parentIndex;
      } else {
        break;
      }
    }
  }

  // Extract the maximum element (highest priority)
  extractMax() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const max = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown(0);
    return max;
  }

  // Heapify down to maintain heap property
  heapifyDown(index) {
    let currentIndex = index;
    const length = this.heap.length;

    while (true) {
      let leftChildIndex = this.getLeftChildIndex(currentIndex);
      let rightChildIndex = this.getRightChildIndex(currentIndex);
      let largestIndex = currentIndex;

      if (
        leftChildIndex < length &&
        this.heap[leftChildIndex].priorityScore >
          this.heap[largestIndex].priorityScore
      ) {
        largestIndex = leftChildIndex;
      }

      if (
        rightChildIndex < length &&
        this.heap[rightChildIndex].priorityScore >
          this.heap[largestIndex].priorityScore
      ) {
        largestIndex = rightChildIndex;
      }

      if (largestIndex !== currentIndex) {
        this.swap(currentIndex, largestIndex);
        currentIndex = largestIndex;
      } else {
        break;
      }
    }
  }

  // Get heap size
  size() {
    return this.heap.length;
  }

  // Check if heap is empty
  isEmpty() {
    return this.heap.length === 0;
  }
}

class PriorityInboxService {
  constructor() {
    this.priorityWeights = {
      priority: {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1,
      },
      type: {
        placement: 3,
        interview: 3,
        selection: 2,
        rejection: 2,
        event: 2,
        announcement: 1,
      },
    };
  }

  // Calculate priority score for a notification
  calculatePriorityScore(notification) {
    const now = new Date();
    const createdAt = new Date(notification.createdAt);
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

    // Base score from priority level
    let score = this.priorityWeights.priority[notification.priority] || 2;

    // Add type importance
    score += this.priorityWeights.type[notification.type] || 1;

    // Boost for unread notifications
    if (!notification.isRead) {
      score += 1;
    }

    // Recency boost (newer notifications get higher scores)
    const recencyBoost = Math.max(0, 24 - hoursSinceCreation) / 24; // Linear decay over 24 hours
    score += recencyBoost * 2;

    // Urgent notifications get exponential boost
    if (notification.priority === "urgent") {
      score *= 1.5;
    }

    return score;
  }

  // Build priority inbox for a user
  async buildPriorityInbox(userId, limit = 20) {
    try {
      // Get all notifications for the user (could be optimized with pagination in production)
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(200); // Reasonable limit to avoid memory issues

      // Calculate priority scores and build max-heap
      const maxHeap = new MaxHeap();

      for (const notification of notifications) {
        const priorityScore = this.calculatePriorityScore(
          notification.toObject(),
        );
        const notificationWithScore = {
          ...notification.toObject(),
          priorityScore: priorityScore,
        };
        maxHeap.insert(notificationWithScore);
      }

      // Extract top N highest priority notifications
      const priorityInbox = [];
      const extractLimit = Math.min(limit, maxHeap.size());

      for (let i = 0; i < extractLimit; i++) {
        const notification = maxHeap.extractMax();
        if (notification) {
          // Remove the priorityScore from the final output
          const { priorityScore, ...cleanNotification } = notification;
          priorityInbox.push(cleanNotification);
        }
      }

      return {
        success: true,
        data: {
          notifications: priorityInbox,
          totalAvailable: notifications.length,
          returnedCount: priorityInbox.length,
        },
      };
    } catch (error) {
      console.error("Error building priority inbox:", error);
      return {
        success: false,
        error: "Failed to build priority inbox",
        details: error.message,
      };
    }
  }

  // Get priority statistics for a user
  async getPriorityStats(userId) {
    try {
      const notifications = await Notification.find({ userId });

      const stats = {
        total: notifications.length,
        unread: notifications.filter((n) => !n.isRead).length,
        byPriority: {
          urgent: notifications.filter((n) => n.priority === "urgent").length,
          high: notifications.filter((n) => n.priority === "high").length,
          medium: notifications.filter((n) => n.priority === "medium").length,
          low: notifications.filter((n) => n.priority === "low").length,
        },
        byType: {
          placement: notifications.filter((n) => n.type === "placement").length,
          interview: notifications.filter((n) => n.type === "interview").length,
          selection: notifications.filter((n) => n.type === "selection").length,
          rejection: notifications.filter((n) => n.type === "rejection").length,
          event: notifications.filter((n) => n.type === "event").length,
          announcement: notifications.filter((n) => n.type === "announcement")
            .length,
        },
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error getting priority stats:", error);
      return {
        success: false,
        error: "Failed to get priority statistics",
        details: error.message,
      };
    }
  }
}

module.exports = new PriorityInboxService();
