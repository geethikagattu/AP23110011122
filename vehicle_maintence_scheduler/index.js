#!/usr/bin/env node

/**
 * Vehicle Maintenance Scheduler - Main Entry Point
 * Runs the knapsack-based vehicle maintenance optimization
 */

require("dotenv").config();
const VehicleScheduler = require("./scheduler");

async function main() {
  console.log("🔧 Vehicle Maintenance Scheduler v1.0.0");
  console.log("=======================================\n");

  const scheduler = new VehicleScheduler();

  const result = await scheduler.run();

  if (result.success) {
    console.log("\n📋 Optimization Results:");
    console.log("========================");

    Object.values(result.output.depots).forEach((depot) => {
      console.log(`\n🏭 Depot: ${depot.depotId}`);
      console.log(`   Capacity: ${depot.mechanicHours}h`);
      console.log(
        `   Tasks: ${depot.selectedTasks}/${depot.totalTasks} selected`,
      );
      console.log(
        `   Hours Used: ${depot.totalDuration}h (${depot.remainingHours}h remaining)`,
      );
      console.log(`   Impact Score: ${depot.totalImpact}`);
      console.log(`   Selected Tasks: ${depot.selectedTaskIds.join(", ")}`);
    });

    console.log("\n📊 Overall Summary:");
    console.log(`   Total Depots: ${result.output.summary.totalDepots}`);
    console.log(
      `   Total Tasks Scheduled: ${result.output.summary.totalSelectedTasks}/${result.output.summary.totalTasks}`,
    );
    console.log(`   Total Impact: ${result.output.summary.totalImpact}`);
    console.log(
      `   Mechanic Hours: ${result.output.summary.totalHoursUsed}/${result.output.summary.totalMechanicHours}h used`,
    );

    console.log(`\n💾 Results saved to: ${result.filepath}`);
  } else {
    console.error("❌ Scheduling failed:", result.error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the scheduler
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  });
}

module.exports = main;
