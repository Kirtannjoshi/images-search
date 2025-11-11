@echo off
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        🚀 Starting Image Search Application 🚀        ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [1/3] Killing existing Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Starting REST API Server (port 3000)...
start "Image Search API" cmd /k "cd /d %~dp0 && node api-server.js"
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Server (port 8080)...
start "Image Search Frontend" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║  ✅ Both servers are starting...                      ║
echo ║                                                        ║
echo ║  📡 REST API: http://localhost:3000/api/search        ║
echo ║  🌐 Frontend: http://localhost:8080                   ║
echo ║                                                        ║
echo ║  Opening browser in 3 seconds...                      ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

timeout /t 3 /nobreak >nul
start http://localhost:8080

echo.
echo Press any key to exit this window...
pause >nul
