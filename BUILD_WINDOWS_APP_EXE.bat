@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo Building Library Checkout Portable App EXE...
echo ===============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\build-portable.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
  echo [SUCCESS] Portable EXE build finished.
  echo A dist folder window should open automatically.
  echo Build log: %CD%\build-portable.log
) else (
  echo [FAILED] Portable EXE build failed.
  echo Check log: %CD%\build-portable.log
)

echo.
echo Press any key to close this window...
pause >nul
exit /b %EXIT_CODE%
