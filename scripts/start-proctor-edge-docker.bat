@echo off
setlocal EnableDelayedExpansion
title VVKCBT - Khoi dong may giam thi (Docker)

cd /d "%~dp0.."
set ROOT=%CD%

echo.
echo ========================================
echo   VVKCBT - May giam thi (Docker) — tuy chon
echo   THPT Vo Van Kiet - Ca Mau
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js. Cai dat Node 20+ va thu lai.
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [LOI] Khong tim thay Docker. Dung start-edge-server.bat (native) thay the.
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  echo Tao .env tu .env.example...
  copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
)

set /p PROCTOR_USER="Ten dang nhap giam thi: "
if "!PROCTOR_USER!"=="" exit /b 1
set /p PROCTOR_PASS="Mat khau giam thi: "
if "!PROCTOR_PASS!"=="" exit /b 1

echo [1/6] Khoi dong Postgres + Redis...
docker compose -f "%ROOT%\docker\docker-compose.yml" up -d postgres redis

echo [2/6] Cho database...
call npx wait-on tcp:5432 tcp:6379 -t 120000

echo [3/6] Migration...
call npm run migration:run

echo [4/6] Seed giam thi...
node "%ROOT%\scripts\seed-proctor-user.mjs" "!PROCTOR_USER!" "!PROCTOR_PASS!"

if not exist "%ROOT%\apps\web\student\dist\index.html" (
  echo [5/6] Build SPA...
  call npm run build
) else (
  echo [5/6] SPA dist da co.
)

echo [6/6] API + nginx...
docker compose -f "%ROOT%\docker\docker-compose.yml" up -d --build api nginx
call npx wait-on http://localhost:3000/api/infra/health -t 180000

start "" "http://localhost/proctor/"
pause
