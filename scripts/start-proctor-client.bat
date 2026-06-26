@echo off
title VVKCBT - May giam thi (chi trinh duyet)

echo.
echo VVKCBT — Client giam thi (may 2GB, khong chay server)
echo.

set /p SERVER_IP="IP may chu Edge (vi du 192.168.1.50): "
if "%SERVER_IP%"=="" set SERVER_IP=localhost

echo Mo CBT - Viewer tai http://%SERVER_IP%/proctor/
start "" "http://%SERVER_IP%/proctor/"
echo.
echo Thi sinh vao: http://%SERVER_IP%/student/
pause
