@echo off
setlocal enabledelayedexpansion
title AXOM - Local AI Launcher
color 0B

echo.
echo  ==============================================================
echo     AXOM - Personal Local AI Assistant
echo  ==============================================================
echo.

:: 1. Check for Node.js
echo [*] Checking Node.js runtime...
set "NODE_CMD="
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
) else (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    )
)

if not defined NODE_CMD (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo         Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo    Found Node.js: OK

:: 2. Check for Ollama
echo [*] Checking Ollama runtime...
set "OLLAMA_CMD="
where ollama >nul 2>nul
if %errorlevel% equ 0 (
    set "OLLAMA_CMD=ollama"
) else (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    )
)

if not defined OLLAMA_CMD (
    color 0C
    echo [ERROR] Ollama was not found!
    echo         Please download and install Ollama from https://ollama.com/
    echo.
    pause
    exit /b 1
)
echo    Found Ollama: OK

:: 3. Check if Ollama service is running on port 11434
echo [*] Checking Ollama local inference service...
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>nul
if %errorlevel% neq 0 (
    echo    Ollama service is not running. Starting Ollama in the background...
    start "Ollama Local Service" /min "%OLLAMA_CMD%" serve
    
    echo    Waiting for Ollama engine to initialize...
    set "OLLAMA_READY=0"
    for /l %%i in (1,1,20) do (
        if !OLLAMA_READY! equ 0 (
            ping -n 2 127.0.0.1 >nul
            curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>nul
            if !errorlevel! equ 0 set "OLLAMA_READY=1"
        )
    )
    if !OLLAMA_READY! equ 0 (
        color 0C
        echo [ERROR] Timed out waiting for Ollama to start.
        echo         Try launching Ollama manually from your Start Menu.
        echo.
        pause
        exit /b 1
    )
)
echo    Ollama Service: Connected (http://127.0.0.1:11434)

:: 4. Verify AXOM Model is available
echo [*] Checking model availability...
set "MODEL_FOUND=0"
for /f "tokens=1" %%m in ('"%OLLAMA_CMD%" list 2^>nul') do (
    if "%%m"=="axom-chat:latest" set "MODEL_FOUND=1"
    if "%%m"=="axom-chat" set "MODEL_FOUND=1"
)

if !MODEL_FOUND! equ 0 (
    echo    Building AXOM model alias from Modelfile...
    cd /d "%~dp0"
    "%OLLAMA_CMD%" create axom-chat -f Modelfile
    if !errorlevel! neq 0 (
        echo    Notice: Falling back to checking base model qwen2.5:7b...
        "%OLLAMA_CMD%" pull qwen2.5:7b
        "%OLLAMA_CMD%" create axom-chat -f Modelfile
    )
)
echo    AXOM Model: Ready (axom-chat / Qwen 2.5 7B)

:: 5. Start the AXOM Backend
echo [*] Starting AXOM Backend server...
set "BACKEND_ALREADY_RUNNING=0"
netstat -ano | findstr 127.0.0.1:8000 | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo    AXOM Backend is already running on port 8000.
    set "BACKEND_ALREADY_RUNNING=1"
) else (
    cd /d "%~dp0"
    start "AXOM Backend" /min "%NODE_CMD%" "%~dp0server.js"
    
    echo    Waiting for backend to be ready...
    set "BACKEND_READY=0"
    for /l %%i in (1,1,15) do (
        if !BACKEND_READY! equ 0 (
            ping -n 2 127.0.0.1 >nul
            curl -s --connect-timeout 2 http://127.0.0.1:8000/api/health >nul 2>nul
            if !errorlevel! equ 0 set "BACKEND_READY=1"
        )
    )
    if !BACKEND_READY! equ 0 (
        color 0C
        echo [ERROR] Backend failed to start on http://127.0.0.1:8000
        echo         Check server.js logs or port 8000 availability.
        echo.
        pause
        exit /b 1
    )
)
echo    AXOM Backend: Ready (http://127.0.0.1:8000)

:: 6. Open existing AXOM interface in browser
echo [*] Opening AXOM interface in your default browser...
start "" "http://127.0.0.1:8000"

:: 7. Active Status Display
color 0A
echo.
echo  ==============================================================
echo     AXOM IS ONLINE AND READY
echo  ==============================================================
echo    Web App:   http://127.0.0.1:8000
echo    Model:     axom-chat (Qwen 2.5 7B - Local GPU)
echo    Hardware:  NVIDIA RTX 5060 Laptop GPU (CUDA Acceleration)
echo.
echo    Keep this window open while using AXOM.
echo    To stop AXOM services, press any key or run Stop_AXOM.bat.
echo  ==============================================================
echo.
pause

echo.
echo [*] Shutting down AXOM backend...
call "%~dp0Stop_AXOM.bat"
echo [*] AXOM closed safely.
ping -n 3 127.0.0.1 >nul
