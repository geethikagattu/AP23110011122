const axios = require("axios");

const LOG_API = "http://20.207.122.201/evaluation-service/logs";
const AUTH_TOKEN = process.env.EVALUATION_SERVICE_TOKEN;

// the values which are allowed
const validStacks = ["backend", "frontend"];
const validLevels = ["debug", "info", "warn", "error", "fatal"];
const backendPackages = ["handler", "repository", "route", "service"];
const frontendPackages = ["component", "service", "util", "store"];

async function Log(stack, level, pkg, message) {
  try {
    // Validate stack
    if (!validStacks.includes(stack)) {
      throw new Error("Invalid stack. Must be 'backend' or 'frontend'");
    }

    // Validate level
    if (!validLevels.includes(level)) {
      throw new Error(
        "Invalid level. Must be one of: debug, info, warn, error, fatal",
      );
    }

    // Validate package based on stack
    if (stack === "backend" && !backendPackages.includes(pkg)) {
      throw new Error(
        `Invalid backend package. Must be one of: ${backendPackages.join(", ")}`,
      );
    }

    if (stack === "frontend" && !frontendPackages.includes(pkg)) {
      throw new Error(
        `Invalid frontend package. Must be one of: ${frontendPackages.join(", ")}`,
      );
    }

    // Validate auth token
    if (!AUTH_TOKEN) {
      throw new Error("EVALUATION_SERVICE_TOKEN environment variable not set");
    }

    const body = {
      stack,
      level,
      package: pkg,
      message,
    };

    const res = await axios.post(LOG_API, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      timeout: 5000,
    });

    return res.data;
  } catch (err) {
    console.error("[Logger Error]", err.message);
    throw err;
  }
}

module.exports = Log;
