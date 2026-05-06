#!/bin/bash
echo "Starting NavTools locally with remote D1 database..."
export NODE_ENV=production
export DB_TYPE=d1
export USE_REMOTE_DB=true
export AI_BASE_URL=https://cliproxy.1997121.xyz/v1
export AI_API_KEY="${AI_API_KEY:-}"
export DEFAULT_MODEL=gemini-3.1-pro-high
export AUTH_USERNAME=admin
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
export CLOUDFLARE_DATABASE_ID=2539afd9-931b-444b-8bc7-2e0816242ba8
export CLOUDFLARE_D1_FILE=db/database.db

# Use tsx to run the worker directly
npx tsx worker/index.ts
