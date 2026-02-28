# Build stage
FROM node:20-alpine
WORKDIR /app

# Enable corepack
RUN corepack enable

# Install build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ca-certificates

# Copy package files
COPY package.json ./

# Generate pnpm-lock.yaml if not exists (using npm)
RUN npm install -g pnpm && npm install && pnpm install

# Copy rest of files
COPY . .

# Explicit install missing deps
RUN pnpm add -D remark-gfm @cloudflare/vite-plugin

# Build with pnpm
RUN pnpm run build

# Expose port
EXPOSE 8787
VOLUME /app/.wrangler

# Health check
RUN apk add --no-cache wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8787/ || exit 1

# Entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "wrangler", "dev", "--config", "wrangler.jsonc", "--ip", "0.0.0.0", "--port", "8787"]
