#!/bin/bash

# Exit on error
set -e

echo "Starting NavTools container..."

# Check if we should use remote database
if [ "${USE_REMOTE_DB:-false}" = "true" ]; then
    echo "Using remote Cloudflare D1 database"
    
    # Set production database environment variables
    export NODE_ENV=production
    export DB_TYPE=d1
    export USE_REMOTE_DB=true
    
    # Initialize remote database (run migrations)
    echo "Initializing remote database..."
    cd /app && npm run db:migrate:remote || echo "Remote migration failed, continuing..."
else
    echo "Using local SQLite database"
    
    # Set local development environment variables
    export NODE_ENV=development
    export DB_TYPE=sqlite
    export SQLITE_DB_PATH=/app/data/nav.db
    
    # Ensure data directory exists
    mkdir -p /app/data
    
    # Copy seed data if database doesn't exist
    if [ ! -f "/app/data/nav.db" ]; then
        echo "Initializing local database..."
        cp /app/seed/nav.db /app/data/nav.db
    fi
fi

# Generate password hash if AUTH_PASSWORD is not set
if [ -z "${AUTH_PASSWORD}" ] && [ -n "${ADMIN_PASSWORD}" ]; then
    echo "Generating password hash for admin..."
    cd /app && npm run hash-password -- "${ADMIN_PASSWORD}" > /tmp/password_hash.txt
    export AUTH_PASSWORD=$(cat /tmp/password_hash.txt)
    rm -f /tmp/password_hash.txt
fi

# Start the application
if [ "${NODE_ENV}" = "production" ]; then
    echo "Starting in production mode (Cloudflare Worker)..."
    exec npm start
else
    echo "Starting in development mode (Vite dev server)..."
    exec npm run dev
fi