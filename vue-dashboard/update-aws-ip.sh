#!/bin/bash

# AWS Public IP Update Script
# This script automatically detects your current AWS public IP
# and updates the .env files for development

echo "🔍 Detecting current AWS public IP..."

# Get current public IP
CURRENT_IP=$(curl -s http://checkip.amazonaws.com)

if [ -z "$CURRENT_IP" ]; then
    echo "❌ Could not detect public IP. Please check your internet connection."
    exit 1
fi

echo "✅ Current AWS public IP: $CURRENT_IP"

# Update .env file
echo "📝 Updating .env file..."
sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://$CURRENT_IP:8080|" .env

# Update .env.development file
echo "📝 Updating .env.development file..."
sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://$CURRENT_IP:8080|" .env.development

echo "✅ Updated files with new IP: $CURRENT_IP"
echo ""
echo "🚀 Ready to test!"
echo "   Run: npm run dev"
echo "   Then go to: http://localhost:5173"
echo ""
echo "📋 Updated configuration:"
echo "   API URL: http://$CURRENT_IP:8080"