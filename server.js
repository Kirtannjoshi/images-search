// server.js 
const host = 'localhost'; 
const port = 8080; 
const cors_proxy = require('cors-anywhere'); 

cors_proxy.createServer({
    originWhitelist: [], // Allow all origins 
}).listen(port, host, () => {
    console.log(`✅ Your private CORS proxy is running on http://${host}:${port}`); 
});