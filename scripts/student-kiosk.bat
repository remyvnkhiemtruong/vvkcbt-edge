@echo off
setlocal
set IP=%~1
if "%IP%"=="" (
  set /p IP="IP may chu Edge: "
)
if "%IP%"=="" (
  echo Can IP may chu.
  exit /b 1
)

set URL=http://%IP%/student/
echo Mo Chrome kiosk: %URL%

where chrome >nul 2>&1
if not errorlevel 1 (
  start "" chrome --kiosk --app=%URL%
  exit /b 0
)

where msedge >nul 2>&1
if not errorlevel 1 (
  start "" msedge --kiosk --app=%URL%
  exit /b 0
)

start "" %URL%
echo Khong tim thay Chrome/Edge — mo URL bang trinh duyet mac dinh.
