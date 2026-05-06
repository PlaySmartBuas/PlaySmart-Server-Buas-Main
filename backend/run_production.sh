#!/bin/bash

set -e
cd "$(dirname "$0")"

export ENVIRONMENT=production

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    exit 1
fi

mkdir -p logs

echo "=========================================="
echo "🚀 Starting Play-O-Meter Backend"
echo "=========================================="
echo "📍 Environment: PRODUCTION"
echo "🌐 Server: http://0.0.0.0:8000"
echo "📊 Workers: 4"
echo "=========================================="

poetry run uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4