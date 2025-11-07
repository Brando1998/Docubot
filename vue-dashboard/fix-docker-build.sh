#!/bin/bash

echo "🔧 Applying Docker Build Fix for Public IP"
echo "=========================================="
echo ""

# Check current public IP
CURRENT_IP=$(curl -s http://checkip.amazonaws.com)
if [ -z "$CURRENT_IP" ]; then
    echo "❌ Could not detect public IP"
    echo "Please check your internet connection"
    exit 1
fi

echo "📍 Current AWS public IP: $CURRENT_IP"
echo ""

# Update docker-compose.yml with current IP
echo "🔄 Updating docker-compose.yml..."
sed -i "s|VITE_API_URL:-http://.*:8080|VITE_API_URL:-http://$CURRENT_IP:8080|g" ../docker-compose.yml

echo "✅ Updated docker-compose.yml"
echo ""

# Rebuild Vue container with correct IP
echo "🔨 Rebuilding Vue container with public IP..."
cd ..
docker compose -f docker-compose.prod.yml down vue
docker compose -f docker-compose.prod.yml up -d --build vue

echo "✅ Vue container rebuilt with IP: $CURRENT_IP"
echo ""

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Check if container is running
if docker compose -f docker-compose.prod.yml ps vue | grep -q "Up"; then
    echo "✅ Vue container is running"
    
    # Test the app
    echo "🧪 Testing application..."
    if curl -f "http://$CURRENT_IP:80/dashboard/bots" > /dev/null 2>&1; then
        echo "✅ Application is accessible!"
        echo ""
        echo "🎉 SUCCESS! Your app should now work correctly."
        echo ""
        echo "🌐 Access your app at: http://$CURRENT_IP"
        echo "📊 BotManagement: http://$CURRENT_IP/dashboard/bots"
    else
        echo "⚠️  Application started but may still be warming up"
        echo "🌐 Try accessing: http://$CURRENT_IP in a few seconds"
    fi
else
    echo "❌ Vue container failed to start"
    echo "Check logs with: docker compose -f docker-compose.prod.yml logs vue"
fi

echo ""
echo "🔍 Current status:"
docker compose -f docker-compose.prod.yml ps vue