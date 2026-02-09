const express = require("express");
const path = require("path");

const app = express();
const distDir = path.join(__dirname, "dist");

app.get("/env.js", (_req, res) => {
  const payload = { VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "" };
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.send(`window.__ORKIO_ENV__=${JSON.stringify(payload)};`);
});

app.use(express.static(distDir, { index: false }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[orkio-web] listening on ${port}`);
});
