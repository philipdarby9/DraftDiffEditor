@echo off
setlocal

set "APP_DIR=C:\Users\phili\OneDrive\Documents\DraftDiffEditor"
set "SERVER_BUILD=server-all-drafts-toggle-2026-05-20"

cd /d "%APP_DIR%" || (
  echo Could not find Draft Diff Editor at:
  echo %APP_DIR%
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Draft Diff Editor.
  echo Install Node.js from https://nodejs.org/ and then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

for /L %%P in (4174,1,4183) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $info = Invoke-RestMethod -Uri 'http://localhost:%%P/api/server-info' -TimeoutSec 1; if ($info.build -eq '%SERVER_BUILD%') { exit 0 } else { exit 2 } } catch { exit 2 }" >nul 2>nul
  if not errorlevel 1 (
    start "" "http://localhost:%%P/"
    exit /b 0
  )
)

for /L %%P in (4174,1,4183) do (
  netstat -ano | findstr /R /C:":%%P .*LISTENING" >nul
  if errorlevel 1 (
    set "APP_PORT=%%P"
    goto found_port
  )
)

echo No free local port found between 4174 and 4183.
pause
exit /b 1

:found_port
set "URL=http://localhost:%APP_PORT%/"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:PORT='%APP_PORT%'; $env:DRAFT_DIFF_AUTO_EXIT='1'; Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%APP_DIR%'"

for /L %%I in (1,1,40) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $info = Invoke-RestMethod -Uri '%URL%api/server-info' -TimeoutSec 1; if ($info.build -eq '%SERVER_BUILD%') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    start "" "%URL%"
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

echo Draft Diff Editor did not start.
pause
exit /b 1
