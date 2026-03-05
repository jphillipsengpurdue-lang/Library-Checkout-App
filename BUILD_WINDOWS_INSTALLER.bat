@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\build-installer.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
  echo Installer build finished. A dist folder window should open automatically.
  echo Build log: %CD%\build-installer.log
) else (
  echo Installer build failed.
  echo Check log: %CD%\build-installer.log
)

echo.
pause
exit /b %EXIT_CODE%
