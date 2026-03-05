@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\one-click-setup.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. Please contact your administrator.
  pause
)
