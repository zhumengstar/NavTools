#!/bin/bash
echo "Starting NavTools with REMOTE D1 database..."
echo "This may not work on macOS 11.6 due to esbuild compatibility issues"
echo ""
echo "If this fails, please use:"
echo "  1. npm run dev (frontend only, uses remote API)"
echo "  2. npx wrangler deploy (deploy to Cloudflare Workers)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

export NODE_ENV=production
export DB_TYPE=d1
export USE_REMOTE_DB=true
export AI_BASE_URL=https://cliproxy.1997121.xyz/v1
export AI_API_KEY=sk-cLhZ6wffGNE4CvvL0K3L0NfWkFsO4uQ5Mz6XoK7JaFlqJgIp09
export DEFAULT_MODEL=gemini-3.1-pro-high
export AUTH_USERNAME=admin
export ADMIN_PASSWORD=admin1
export CLOUDFLARE_DATABASE_ID=2539afd9-931b-444b-8bc7-2e0816242ba8
export CLOUDFLARE_D1_FILE=db/database.db

# Use wrangler with --remote flag
npx wrangler dev --remote --port 8787
