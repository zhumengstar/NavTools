# Build stage
FROM node:22-slim
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install basic tools and python3 for wrangler/better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

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
CMD ["pnpm", "exec", "wrangler", "dev", "--config", "wrangler.jsonc", "--ip", "0.0.0.0", "--port", "8787"]
