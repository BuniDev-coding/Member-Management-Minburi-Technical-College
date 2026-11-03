@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/3] Creating virtual environment...
  python -m venv backend\.venv || goto :error
)

echo [2/3] Checking packages...
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || goto :error

rem ไฟล์ตั้งค่า .env จะถูกสร้างจาก .env.example อัตโนมัติเมื่อรันครั้งแรก
if not exist "database\app.db" (
  echo [3/3] Creating database with sample data...
  backend\.venv\Scripts\python database\seed.py || goto :error
)

echo.
echo   Settings: .env    Open http://127.0.0.1:5000   (admin / admin1234)
echo   Press Ctrl+C to stop
echo.
cd backend
.venv\Scripts\python app.py
goto :eof

:error
echo Setup failed. Make sure Python 3.10+ is installed and on PATH.
pause
