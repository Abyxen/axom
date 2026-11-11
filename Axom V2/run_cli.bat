@echo off
title Axom V2 — Interactive Terminal
cd /d "%~dp0"

echo ============================================================
echo   Starting Axom V2 (Terminal Interface)
echo   Hardware: NVIDIA RTX 5060 (8GB VRAM) / AMD Ryzen 9 8940HX
echo ============================================================

:: Check if Ollama is active on port 11434
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Starting local Ollama engine...
    start /b "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    timeout /t 3 /nobreak >nul
)

python cli.py
pause
