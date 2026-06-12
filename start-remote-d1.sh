#!/bin/bash
echo "Starting NavTools Worker with REMOTE D1/KV bindings..."
echo "Frontend should run separately with: npm run dev -- --host 127.0.0.1"
echo "API will be available at: http://127.0.0.1:8787"
echo ""
echo "Wrangler must be logged in or configured with CLOUDFLARE_API_TOKEN."
echo ""

NODE_OPTIONS="--require ./scripts/undici-proxy.cjs" npx wrangler dev --config wrangler.remote.jsonc --port 8787
