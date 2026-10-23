@echo off
setlocal
title AXOM - Stop Services
color 0E

echo.
echo ==============================================================
echo    Stopping AXOM Services
echo ==============================================================
echo.

:: Find and terminate the process listening on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    if not "%%a"=="" (
        echo [*] Stopping AXOM Backend process with PID %%a
        taskkill /f /pid %%a >nul 2>&1
    )
)

echo [OK] AXOM Backend server stopped.
echo.
echo [i] Note: Ollama inference service is left running in the background
echo     for fast subsequent launches. If you want to shut down Ollama as well,
echo     you can quit Ollama from the Windows taskbar system tray icon.
echo.
echo ==============================================================
echo    AXOM has been stopped.
echo ==============================================================
ping -n 3 127.0.0.1 >nul
