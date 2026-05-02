const express = require("express");
const loggerMiddleware = require("./middleware/loggerMiddleware");

const app = express();

app.use(express.json());
app.use(loggerMiddleware);

app.get("/test", (req, res) => {
    res.send("Working");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});