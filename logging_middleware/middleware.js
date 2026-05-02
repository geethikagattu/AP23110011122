const Log = require("./logger");
//This file is used for middleware checking 
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on("finish", async () => {
    const duration = Date.now() - start;

    try {
      await Log(
        "backend",
        "info",
        "route",
        `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`,
      );
    } catch (err) {
      console.error("[Middleware Logger Error]", err.message);
    }
  });

  next();
};

module.exports = loggerMiddleware;
