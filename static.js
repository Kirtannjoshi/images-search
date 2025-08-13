// static.js - Serve the front-end over HTTP to avoid file:// CORS issues
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on http://localhost:${PORT}`);
});
