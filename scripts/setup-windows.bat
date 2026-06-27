@echo off
setlocal
title VVKCBT - Setup Windows

cd /d "%~dp0.."
set ROOT=%CD%

echo.
echo ========================================
echo   VVKCBT - Setup tu dong (Windows)
echo   THPT Vo Van Kiet
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup-windows.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% neq 0 (
  echo [LOI] Setup that bai. Xem thong bao phia tren.
) else (
  echo Setup hoan tat.
)
pause
exit /b %EXIT_CODE%
