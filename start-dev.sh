#!/bin/bash
echo "Starting NavTools development environment..."
echo ""
echo "Step 1: Starting frontend (Vite dev server)..."
echo "Access at: http://localhost:5173"
echo ""
echo "Step 2: Backend API needs to be started separately:"
echo "  For remote D1: npx wrangler dev --remote --port 8787"
echo "  Or deploy: npx wrangler deploy"
echo ""
echo "Note: Due to macOS 11.6 compatibility issues, wrangler may not work locally."
echo "Consider using Cloudflare Workers for production deployment."
echo ""

# Start frontend
npm run dev
