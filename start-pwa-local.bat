@echo off
setlocal
cd /d "%~dp0"
set PORT=8765

where py >nul 2>nul
if %errorlevel%==0 (
  start "桌面行程表伺服器" /min py -m http.server %PORT% --bind 127.0.0.1
  start "" "http://127.0.0.1:%PORT%/index.html"
  echo 已開啟 http://127.0.0.1:%PORT%/index.html
  echo 可在 Edge/Chrome 右上角選「安裝應用程式」。
  pause
  exit /b 0
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "桌面行程表伺服器" /min python -m http.server %PORT% --bind 127.0.0.1
  start "" "http://127.0.0.1:%PORT%/index.html"
  echo 已開啟 http://127.0.0.1:%PORT%/index.html
  echo 可在 Edge/Chrome 右上角選「安裝應用程式」。
  pause
  exit /b 0
)

echo 找不到 Python，無法啟動本機 PWA 伺服器。
echo 仍可直接雙擊 index.html 使用，但 file:// 無法安裝 PWA。
pause
exit /b 1
