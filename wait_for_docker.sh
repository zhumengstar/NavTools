#!/bin/bash
echo "=== Waiting for Docker Desktop to Restart ==="
echo "Please make sure you have:"
echo "1. Quit Docker Desktop completely"
echo "2. Waited 15 seconds"
echo "3. Started Docker Desktop again"
echo ""

echo "Waiting for Docker to become available..."
for i in {1..30}; do
    if docker version > /dev/null 2>&1; then
        echo "✅ Docker is now available!"
        docker version --format 'Client: {{.Client.Version}}\nServer: {{.Server.Version}}'
        
        echo ""
        echo "Checking registry mirrors..."
        docker info | grep -A 10 "Registry Mirrors"
        
        echo ""
        echo "Testing image pull..."
        if docker pull node:18-alpine > /dev/null 2>&1; then
            echo "✅ Image pull successful! Docker is fully functional."
            echo "Ready to deploy NavTools!"
        else
            echo "⚠️  Docker responding but image pull failed. May need more time."
        fi
        exit 0
    fi
    
    if [ $((i % 5)) -eq 0 ]; then
        echo "Still waiting... ($i/30)"
    fi
    sleep 2
done

echo "❌ Docker did not become available within 60 seconds"
echo "Please check Docker Desktop manually"
exit 1