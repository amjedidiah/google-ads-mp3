const https = require("https");
const fs = require("fs");
const express = require("express");
const path = require("path");

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Serve the main HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// SSL options
const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`Server running at https://localhost:${port}`);
});
