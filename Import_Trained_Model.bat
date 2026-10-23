@echo off
setlocal enabledelayedexpansion
title AXOM - Import Trained Model from Google Drive
color 0B

echo.
echo  ==============================================================
echo     AXOM - Import Fine-Tuned Model into Local Ollama
echo  ==============================================================
echo.

set "DRIVE_MODEL_DIR=G:\My Drive\AXOM_Model"
set "OLLAMA_CMD="

:: Locate Ollama
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
    echo         Please ensure Ollama is installed.
    echo.
    pause
    exit /b 1
)

:: Check if Google Drive is connected
if not exist "%DRIVE_MODEL_DIR%" (
    color 0C
    echo [ERROR] Google Drive folder not found at:
    echo         %DRIVE_MODEL_DIR%
    echo.
    echo         Please make sure Google Drive for Desktop is running
    echo         and your Drive is mounted to G:\.
    echo.
    pause
    exit /b 1
)

:: Search for exported GGUF file
set "GGUF_FILE="
for /r "%DRIVE_MODEL_DIR%" %%f in (*.gguf) do (
    set "GGUF_FILE=%%f"
    goto :found_gguf
)

:found_gguf
if not defined GGUF_FILE (
    color 0E
    echo [WARNING] No .gguf model file found in:
    echo           %DRIVE_MODEL_DIR%
    echo.
    echo [*] Please run Step 10 in Google Colab (Axom.ipynb) first to export
    echo     your trained model to GGUF format.
    echo.
    pause
    exit /b 1
)

echo [*] Found trained GGUF model:
echo     !GGUF_FILE!
echo.

:: Build a temporary Modelfile pointing directly to the trained GGUF
set "IMPORT_MODELFILE=%~dp0Modelfile.trained"
(
    echo FROM !GGUF_FILE!
    echo.
    echo PARAMETER temperature 0.7
    echo PARAMETER top_p 0.9
    echo.
    echo SYSTEM """You are AXOM, a helpful, intelligent local AI assistant created by Abiral. You excel at coding, debugging, and clear technical conversation."""
) > "%IMPORT_MODELFILE%"

echo [*] Creating local Ollama model 'axom-chat' from trained weights...
"%OLLAMA_CMD%" create axom-chat -f "%IMPORT_MODELFILE%"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Failed to import trained model into Ollama.
    pause
    exit /b 1
)

:: Clean up temporary Modelfile
if exist "%IMPORT_MODELFILE%" del "%IMPORT_MODELFILE%"

color 0A
echo.
echo  ==============================================================
echo     SUCCESS! Trained model imported as 'axom-chat'
echo  ==============================================================
echo     Your local AXOM interface will now use your newly trained
echo     weights automatically when you launch Start_AXOM.bat!
echo  ==============================================================
echo.
pause
