@echo off
setlocal EnableDelayedExpansion

echo.
echo  =============================================
echo   Muhaffiz - Quran Memorization App
echo  =============================================
echo.

REM --- Step 1: Check existing virtual environment ---
if exist ".venv\Scripts\python.exe" (
    echo [OK] Virtual environment found.
    goto :run_app
)

REM --- Step 2: Locate Python executable ---
set PYTHON_CMD=

python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    goto :create_venv
)

py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    goto :create_venv
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :create_venv
)

if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :create_venv
)

if exist "C:\Program Files\Python312\python.exe" (
    set "PYTHON_CMD=C:\Program Files\Python312\python.exe"
    goto :create_venv
)

if exist "C:\Python312\python.exe" (
    set "PYTHON_CMD=C:\Python312\python.exe"
    goto :create_venv
)

echo [ERROR] Python not found.
echo Please install Python from https://python.org or restart your terminal.
pause
exit /b 1

:create_venv
echo [SETUP] Found Python: !PYTHON_CMD!
echo [SETUP] Creating virtual environment (.venv)...
"!PYTHON_CMD!" -m venv .venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)

:run_app
echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment.
    pause
    exit /b 1
)

REM --- Verify or install core requirements silently ---
python -c "import flask, flask_cors, speech_recognition" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing required libraries...
    pip install flask flask-cors SpeechRecognition pydub -q
)

echo.
echo  =============================================
echo   Server ready! Open your browser at:
echo   http://localhost:5000
echo   Press Ctrl+C in this window to stop.
echo  =============================================
echo.

python app.py
if errorlevel 1 (
    echo.
    echo [ERROR] Server encountered an error.
)
pause