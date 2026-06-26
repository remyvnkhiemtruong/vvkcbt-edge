@echo off
setlocal EnableDelayedExpansion
title VVKCBT - Khoi dong may giam thi

cd /d "%~dp0.."
set ROOT=%CD%

echo.
echo ========================================
echo   VVKCBT - May giam thi (Docker)
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
  echo [LOI] Khong tim thay Docker. Khoi dong Docker Desktop va thu lai.
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  echo Tao .env tu .env.example...
  copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
)

set /p PROCTOR_USER="Ten dang nhap giam thi: "
if "!PROCTOR_USER!"=="" (
  echo [LOI] Ten dang nhap khong duoc de trong.
  pause
  exit /b 1
)

set /p PROCTOR_PASS="Mat khau giam thi: "
if "!PROCTOR_PASS!"=="" (
  echo [LOI] Mat khau khong duoc de trong.
  pause
  exit /b 1
)

echo.
echo [1/6] Khoi dong Postgres + Redis...
docker compose -f "%ROOT%\docker\docker-compose.yml" up -d postgres redis
if errorlevel 1 (
  echo [LOI] Docker compose that bai.
  pause
  exit /b 1
)

echo [2/6] Cho database san sang...
call npx wait-on tcp:5432 tcp:6379 -t 120000
if errorlevel 1 (
  echo [LOI] Database/Redis chua san sang.
  pause
  exit /b 1
)

echo [3/6] Chay migration...
call npm run migration:run
if errorlevel 1 (
  echo [LOI] Migration that bai.
  pause
  exit /b 1
)

echo [4/6] Tao/cap nhat tai khoan giam thi...
node "%ROOT%\scripts\seed-proctor-user.mjs" "!PROCTOR_USER!" "!PROCTOR_PASS!"
if errorlevel 1 (
  echo [LOI] Seed giam thi that bai.
  pause
  exit /b 1
)

if not exist "%ROOT%\apps\web\student\dist\index.html" (
  echo [5/6] Build SPA (lan dau — co the mat vai phut)...
  call npm run build
  if errorlevel 1 (
    echo [LOI] Build that bai.
    pause
    exit /b 1
  )
) else (
  echo [5/6] SPA dist da co — bo qua build. Chay "npm run build" neu can cap nhat UI.
)

echo [6/6] Khoi dong API + nginx...
docker compose -f "%ROOT%\docker\docker-compose.yml" up -d --build api nginx
if errorlevel 1 (
  echo [LOI] Khoi dong API/nginx that bai.
  pause
  exit /b 1
)

call npx wait-on http://localhost:3000/api/infra/health -t 180000
if errorlevel 1 (
  echo [CANH BAO] API chua phan hoi — thu mo trinh duyet thu cong sau vai phut.
) else (
  echo API san sang.
)

set /p ZIP_PATH="Duong dan file ZIP (Enter de bo qua): "
if not "!ZIP_PATH!"=="" (
  if exist "!ZIP_PATH!" (
    echo Import ZIP...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\import-exam-zip.ps1" -ZipPath "!ZIP_PATH!" -Username "!PROCTOR_USER!" -Password "!PROCTOR_PASS!"
  ) else (
    echo [CANH BAO] Khong tim thay file: !ZIP_PATH!
  )
)

echo.
echo Mo CBT - Viewer...
start "" "http://localhost/proctor/"
echo.
echo Dang nhap: !PROCTOR_USER! / (mat khau vua nhap)
echo Import ZIP neu chua import qua BAT.
echo.
pause
