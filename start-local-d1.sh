#!/bin/bash
echo "Starting NavTools with LOCAL D1 database..."
export NODE_ENV=production
export DB_TYPE=d1
export USE_REMOTE_DB=false
export AI_BASE_URL=https://cliproxy.1997121.xyz/v1
export AI_API_KEY=sk-cLhZ6wffGNE4CvvL0K3L0NfWkFsO4uQ5Mz6XoK7JaFlqJgIp09
export DEFAULT_MODEL=gemini-3.1-pro-high
export AUTH_USERNAME=admin
export ADMIN_PASSWORD=admin1
export CLOUDFLARE_D1_FILE=db/database.db

echo "Using local database: db/database.db"
echo "Please use the following to start the server:"
echo "  Option 1: npx wrangler dev --config wrangler.local.jsonc --local --port 8787"
echo "  Option 2: Upgrade macOS to 13.5.0+ for better compatibility"
echo ""
echo "Frontend is built. Access via: http://localhost:5173 (vite dev) or use a static server"
