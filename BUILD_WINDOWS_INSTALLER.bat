@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo Building Library Checkout Windows Installer...
echo ===============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\build-installer.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
  echo [SUCCESS] Installer build finished.
  echo A dist folder window should open automatically.
  echo Build log: %CD%\build-installer.log
) else (
  echo [FAILED] Installer build failed.
  echo Check log: %CD%\build-installer.log
)

echo.
echo Press any key to close this window...
pause >nul
exit /b %EXIT_CODE%
