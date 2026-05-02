const mongoose = require("mongoose");

async function connectDatabase() {
  const uri = process.env.DB_CONNECTION_STRING;
  if (!uri) {
    throw new Error("DB_CONNECTION_STRING environment variable is required");
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("[MongoDB] Connected to database");
}

module.exports = { connectDatabase };
