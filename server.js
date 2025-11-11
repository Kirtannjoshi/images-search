// server.js - Combined Static Server + CORS Proxy
const express = require('express');
const cors_proxy = require('cors-anywhere');
const path = require('path');

const host = 'localhost';
const port = 8080;

// Create Express app for static file serving
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from current directory
app.use(express.static(__dirname));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// CORS proxy - handle both /proxy/<url> and /proxy?url=<url> formats
const proxy = cors_proxy.createServer({
    originWhitelist: [], // Allow all origins
    requireHeaders: [], // Don't require specific headers
    removeHeaders: ['cookie', 'cookie2'],
    redirectSameOrigin: false,
    httpProxyOptions: {
        xfwd: false
    }
});

// Proxy middleware
app.all('/proxy/*', (req, res) => {
    // Extract the target URL from the path
    const targetUrl = req.url.replace('/proxy/', '');
    const decodedUrl = decodeURIComponent(targetUrl);
    
    console.log(`🔀 Proxying: ${decodedUrl.substring(0, 100)}...`);
    
    // Create a new request object for cors-anywhere
    req.url = '/' + decodedUrl;
    proxy.emit('request', req, res);
});

// Fallback query parameter format: /proxy?url=<url>
app.all('/proxy', (req, res) => {
    if (req.query.url) {
        const decodedUrl = decodeURIComponent(req.query.url);
        console.log(`🔀 Proxying (query): ${decodedUrl.substring(0, 100)}...`);
        req.url = '/' + decodedUrl;
        proxy.emit('request', req, res);
    } else {
        res.status(400).send('Missing URL parameter');
    }
});

app.listen(port, host, () => {
    console.log(`\n✅ Server running on http://${host}:${port}`);
    console.log(`📄 Static files: http://${host}:${port}/`);
    console.log(`🔀 CORS Proxy: http://${host}:${port}/proxy/<url>`);
    console.log(`🔀 CORS Proxy (alt): http://${host}:${port}/proxy?url=<url>\n`);
});