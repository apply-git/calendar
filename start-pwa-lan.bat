@echo off
setlocal
cd /d "%~dp0"
set PORT=8765

echo ============================================
echo  LAN preview server (phone testing, no push)
echo  1. If Windows Firewall asks, click Allow.
echo  2. Phone must be on the SAME Wi-Fi.
echo  3. On phone open: http://PC_IP:%PORT%/index.html
echo  Your PC IPv4 addresses:
ipconfig | findstr /i "IPv4"
echo ============================================

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server %PORT% --bind 0.0.0.0
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT% --bind 0.0.0.0
  goto :eof
)

echo Python not found. Cannot start server.
pause
