#!/bin/bash
echo "=== Docker Diagnostic Script ==="
echo ""

echo "1. Checking Docker Desktop process..."
ps aux | grep -i docker | grep -v grep || echo "❌ Docker Desktop not running"

echo ""
echo "2. Checking Docker socket..."
ls -la /var/run/docker.sock 2>/dev/null || echo "❌ Docker socket not found"
ls -la ~/Library/Containers/com.docker.docker/Data/docker.raw.sock 2>/dev/null || echo "❌ Docker raw socket not found"

echo ""
echo "3. Attempting to start Docker Desktop..."
if ! pgrep -f "Docker.app" > /dev/null; then
    echo "Starting Docker Desktop..."
    open -a Docker
    echo "⏳ Waiting for Docker to start (30 seconds)..."
    sleep 30
else
    echo "✅ Docker Desktop is running"
fi

echo ""
echo "4. Testing Docker connection..."
timeout 10 docker version > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Docker is working!"
    docker version --format '{{.Server.Version}}'
else
    echo "❌ Docker still not responding"
    echo "Please check Docker Desktop manually"
fi

echo ""
echo "5. If Docker is working, test image pull..."
docker info | grep -A 3 "Registry Mirrors" || echo "No registry mirrors configured"