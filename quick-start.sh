#!/bin/bash

echo "=== NavTools Quick Start ==="
echo "Starting with remote D1 database configuration..."
echo ""

# Set environment variables
export NODE_ENV=production
export DB_TYPE=d1
export USE_REMOTE_DB=true
export AI_BASE_URL=https://cliproxy.1997121.xyz/v1
export AI_API_KEY=sk-cLhZ6wffGNE4CvvL0K3L0NfWkFsO4uQ5Mz6XoK7JaFlqJgIp09
export DEFAULT_MODEL=gemini-3.1-pro-high
export AUTH_USERNAME=admin
export ADMIN_PASSWORD=admin1
export CLOUDFLARE_DATABASE_ID=2539afd9-931b-444b-8bc7-2e0816242ba8

# Kill any existing processes
pkill -f "npm start" 2>/dev/null || true
killall node 2>/dev/null || true

echo "Environment configured:"
echo "- Database: Remote Cloudflare D1 (2539afd9-931b-444b-8bc7-2e0816242ba8)"
echo "- Login: admin / admin1"
echo "- Model API: https://cliproxy.1997121.xyz/v1"
echo ""

# Start the service
echo "Starting NavTools server..."
npm start &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for service to start..."
sleep 15

echo ""
echo "=== Testing Service ==="
curl -s http://localhost:8787/api/health && echo "✅ Service is running!" || echo "⚠️  Service may still be starting"

echo ""
echo "=== Access Information ==="
echo "Local URL: http://localhost:8787"
echo "Login: admin / admin1"
echo "Health Check: http://localhost:8787/api/health"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for server
wait $SERVER_PID