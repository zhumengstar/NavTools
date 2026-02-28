#!/bin/bash
# Build script that retries until Docker build succeeds

set -e

echo "🚀 Starting NavTools Docker deployment..."
echo "🔄 Will retry until build succeeds"
echo ""

# Cleanup any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down 2>/dev/null || true
docker system prune -f 2>/dev/null || true

ATTEMPT=1
MAX_ATTEMPTS=10

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "=========================================="
    echo "📦 Build attempt $ATTEMPT of $MAX_ATTEMPTS"
    echo "=========================================="
    
    if docker-compose up --build -d 2>&1; then
        echo ""
        echo "✅ Build successful!"
        echo ""
        
        # Wait a moment for container to start
        sleep 5
        
        # Check if container is running
        if docker ps | grep -q navtools; then
            echo "✅ Container is running"
            echo ""
            echo "📊 Container status:"
            docker ps --filter "name=navtools"
            echo ""
            echo "📝 Recent logs:"
            docker-compose logs --tail=20 navtools
            echo ""
            echo "🎉 Deployment completed successfully!"
            echo ""
            echo "🌐 Access your application at: http://localhost:8787"
            echo "🔐 Username: admin"
            echo "🔐 Password: admin1"
            echo ""
            echo "💾 Connected to remote Cloudflare D1 database"
            exit 0
        else
            echo "❌ Container failed to start"
        fi
    else
        echo ""
        echo "❌ Build failed on attempt $ATTEMPT"
        echo ""
        
        # Cleanup before retry
        docker-compose down 2>/dev/null || true
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    
    if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting 10 seconds before retry..."
        sleep 10
    fi
done

echo ""
echo "❌ Max attempts reached ($MAX_ATTEMPTS)"
echo "Please check the logs above for errors"
exit 1
