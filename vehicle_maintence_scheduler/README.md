# Vehicle Maintenance Scheduler

A Node.js application that optimizes vehicle maintenance task scheduling using the 0/1 Knapsack algorithm. This system schedules maintenance tasks across multiple depots while respecting mechanic hour constraints to maximize overall impact.

## 🎯 Problem Statement

Each depot has a limited number of mechanic hours available. Vehicles require maintenance tasks with different durations and impact values. The goal is to select the optimal set of tasks for each depot that maximizes total impact without exceeding mechanic hour capacity.

## 🏗️ Architecture

### Step 1: Auth & Fetch

- Fetches depot data (ID + MechanicHours) from protected API
- Fetches vehicle data (TaskID + Duration + Impact) from protected API
- Uses Bearer token authentication
- Runs requests in parallel for efficiency

### Step 2: Group by Depot

- Groups all vehicle tasks by depotID
- Each depot runs knapsack optimization independently
- Allows parallel processing across depots

### Step 3: Knapsack DP (Core Algorithm)

- **Algorithm**: 0/1 Knapsack with DP table
- **Capacity**: MechanicHours for each depot
- **Weight**: Task Duration
- **Value**: Task Impact
- **Complexity**: O(n × W) where n = tasks, W = capacity

### Step 4: Traceback

- Reconstructs exactly which TaskIDs were selected
- Walks backward through DP table to find optimal solution
- Returns complete task details for selected items

### Step 5: Output & Commit

- Saves results as timestamped JSON files
- Provides comprehensive statistics
- Ready for GitHub commit with screenshots

## 🚀 Usage

### Prerequisites

```bash
npm install
```

### Environment Setup

Create a `.env` file:

```env
API_TOKEN=your-bearer-token-here
```

### Running the Scheduler

```bash
# Run optimization
npm start

# Or directly
node index.js

# Test syntax
npm test
```

## 📊 Sample Output

```
🔧 Vehicle Maintenance Scheduler v1.0.0
=======================================

🔐 Step 1: Fetching data from protected APIs...
✅ Fetched 3 depots and 10 vehicle tasks

📊 Step 2: Grouping tasks by depot...
✅ Grouped tasks into 3 depot groups

🎯 Step 3-4: Running knapsack optimization for all depots...
🔧 Optimizing depot depot-1 (4 tasks, 40h capacity)
✅ Depot depot-1: 3/4 tasks selected, 26/40h used, impact: 43

🔧 Optimizing depot depot-2 (3 tasks, 35h capacity)
✅ Depot depot-2: 2/3 tasks selected, 17/35h used, impact: 29

🔧 Optimizing depot depot-3 (3 tasks, 45h capacity)
✅ Depot depot-3: 2/3 tasks selected, 20/45h used, impact: 33

💾 Step 5: Saving optimization results...
✅ Results saved to: results/schedule-2026-05-02T10-30-00-000Z.json
📊 Summary: 7 tasks scheduled across 3 depots
🎯 Total Impact: 105, Hours Used: 63/120

🎉 Vehicle maintenance scheduling completed successfully!
```

## 📁 Output Structure

Results are saved as JSON files in the `results/` directory:

```json
{
  "generatedAt": "2026-05-02T10:30:00.000Z",
  "summary": {
    "totalDepots": 3,
    "totalTasks": 10,
    "totalSelectedTasks": 7,
    "totalImpact": 105,
    "totalMechanicHours": 120,
    "totalHoursUsed": 63
  },
  "depots": {
    "depot-1": {
      "depotId": "depot-1",
      "mechanicHours": 40,
      "totalTasks": 4,
      "selectedTasks": 3,
      "selectedTaskIds": ["task-1", "task-3", "task-4"],
      "totalImpact": 43,
      "totalDuration": 26,
      "remainingHours": 14,
      "tasks": [...]
    }
  }
}
```

## 🔧 API Integration

The system expects these API endpoints:

### Depots API

```
GET /depots
Authorization: Bearer {token}
Response: [{ "id": "depot-1", "mechanicHours": 40 }, ...]
```

### Vehicles API

```
GET /vehicles
Authorization: Bearer {token}
Response: [{
  "taskId": "task-1",
  "depotId": "depot-1",
  "duration": 8,
  "impact": 15
}, ...]
```

## 🧮 Algorithm Details

### 0/1 Knapsack DP Table

- `dp[i][w]` = maximum value using first i items with weight limit w
- **Time**: O(n × W)
- **Space**: O(n × W)
- **Optimal**: Finds globally optimal solution

### Decision Criteria

For each depot, tasks are selected based on:

1. **Impact Value**: Higher impact = more valuable
2. **Duration Cost**: Must fit within mechanic hours
3. **No Repeats**: Each task can be selected at most once

## 🐛 Demo Mode

If API endpoints are not available, the system automatically uses mock data for demonstration:

- **3 Depots**: 35-45 mechanic hours each
- **10 Tasks**: Various durations (4-12h) and impacts (8-25)
- **Realistic Constraints**: Demonstrates practical scheduling scenarios

## 📈 Performance

- **Scalability**: Handles hundreds of tasks per depot efficiently
- **Parallel Processing**: Depot optimizations run independently
- **Memory Efficient**: DP table size proportional to tasks × capacity
- **Fast Execution**: Sub-second optimization for typical workloads

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
