#!/bin/bash
set -e

export RASA_HOME=/app/.rasa

echo "🚀 Starting Rasa with action server..."

# Verificar que el modelo existe
if [ ! -f models/current-model.tar.gz ]; then
    echo "❌ ERROR: Pre-trained model not found!"
    echo "Available files in models/:"
    ls -la models/ || echo "No models directory found"
    
    echo "🤖 Training model as fallback..."
    if [ -f domain.yml ] && [ -f config.yml ] && [ -d data ]; then
        echo "🧹 Cleaning old models before training..."
        find models/ -name "*.tar.gz" -type f ! -name "current-model.tar.gz" -exec rm -f {} \; 2>/dev/null || true
        rasa train --fixed-model-name current-model
    else
        echo "❌ Cannot train model: missing configuration files"
        exit 1
    fi
fi

echo "✅ Model found: models/current-model.tar.gz"

# 🔥 INICIAR ACTION SERVER EN BACKGROUND
echo "🎬 Starting Rasa action server on port 5055..."
rasa run actions --port 5055 --debug &
ACTION_PID=$!

# Esperar un poco para que el action server inicie
sleep 3

# Verificar que el action server está corriendo
if ps -p $ACTION_PID > /dev/null; then
    echo "✅ Action server started successfully (PID: $ACTION_PID)"
else
    echo "❌ Failed to start action server"
    exit 1
fi

# 🔥 INICIAR RASA SERVER
echo "🤖 Starting Rasa server on port 5005..."
exec rasa run --enable-api --cors "*" --model models/current-model.tar.gz --port 5005 --debug