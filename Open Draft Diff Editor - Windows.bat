@echo off
setlocal

set "APP_DIR=%~dp0"
set "URL=http://localhost:4173/"

cd /d "%APP_DIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Draft Diff Editor.
  echo Install Node.js from https://nodejs.org/ and then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  start "" "%URL%"
  exit /b 0
)

echo Starting Draft Diff Editor...
start "Draft Diff Editor Server" /D "%APP_DIR%" cmd /k node server.js

for /L %%I in (1,1,40) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    start "" "%URL%"
    echo Draft Diff Editor is running at %URL%
    echo Close the "Draft Diff Editor Server" window to stop the local server.
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

echo The app did not start. Check the server window for details.
pause
exit /b 1
