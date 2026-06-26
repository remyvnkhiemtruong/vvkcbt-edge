@echo off
setlocal EnableDelayedExpansion
title VVKCBT - May chu Edge (Native)

cd /d "%~dp0.."
set ROOT=%CD%

echo.
echo ========================================
echo   VVKCBT - May chu (Native, khong Docker)
echo   THPT Vo Van Kiet
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] Can cai Node.js 20+
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  echo Chay setup lan dau...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup-native.ps1"
)

set /p PROCTOR_USER="Ten dang nhap giam thi: "
if "!PROCTOR_USER!"=="" exit /b 1
set /p PROCTOR_PASS="Mat khau giam thi: "
if "!PROCTOR_PASS!"=="" exit /b 1

echo [1/5] Kiem tra Postgres + Redis...
call npx wait-on tcp:5432 -t 30000
if errorlevel 1 (
  echo [LOI] PostgreSQL chua chay tren port 5432. Cai Postgres native truoc.
  pause
  exit /b 1
)
call npx wait-on tcp:6379 -t 10000
if errorlevel 1 (
  echo [CANH BAO] Redis chua chay — dat EDGE_LIGHTWEIGHT=true trong .env neu can.
)

echo [2/5] Migration...
call npm run migration:run

echo [3/5] Seed giam thi...
node "%ROOT%\scripts\seed-proctor-user.mjs" "!PROCTOR_USER!" "!PROCTOR_PASS!"

if not exist "%ROOT%\apps\web\student\dist\index.html" (
  echo [4/5] Build SPA...
  call npm run build
) else (
  echo [4/5] SPA dist san sang.
)

echo [5/5] Khoi dong API + nginx...
start "VVKCBT API" cmd /c "cd /d %ROOT% && npm run start:prod -w @vnu/api"
timeout /t 5 /nobreak >nul
call npx wait-on http://localhost:3000/api/infra/health -t 120000

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\run-nginx-portable.ps1"

set /p ZIP_PATH="Duong dan ZIP (Enter bo qua): "
if not "!ZIP_PATH!"=="" if exist "!ZIP_PATH!" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\import-exam-zip.ps1" -ZipPath "!ZIP_PATH!" -Username "!PROCTOR_USER!" -Password "!PROCTOR_PASS!"
)

echo.
echo Mo CBT - Viewer...
start "" "http://localhost/proctor/"
echo Xem THONG-TIN-PHONG-THI.txt cho URL thi sinh tren LAN.
pause
