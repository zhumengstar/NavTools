# Build stage
FROM node:22-slim
WORKDIR /app

# Install basic tools and python3 for wrangler/better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use npm instead of pnpm to avoid lockfile issues
COPY package.json package-lock.json* ./
# Use official npm registry for reliable package resolution
RUN npm config set registry https://registry.npmjs.org/
RUN npm install --no-package-lock || npm install

COPY . .

RUN npm run build

# Expose port
EXPOSE 8787
VOLUME /app/.wrangler

# Health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8787/ || exit 1

# Setup entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Start worker
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "wrangler", "dev", "--config", "wrangler.jsonc", "--ip", "0.0.0.0", "--port", "8787"]
