@echo off
echo ==========================================
echo Starting Play-O-Meter Backend
echo ==========================================
echo Environment: PRODUCTION
echo Server: http://0.0.0.0:8000
echo Note: Running single worker (Windows limitation)
echo ==========================================
echo.

set ENVIRONMENT=production

if not exist .env (
    echo Error: .env file not found!
    echo Please create .env file from .env.production template
    pause
    exit /b 1
)

if not exist logs mkdir logs

poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000