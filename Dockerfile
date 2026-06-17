# Use the full node:20 image to skip compiling/apt-get download overhead
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22

WORKDIR /app

# Install only sqlite3 (the rest is already in the full node image)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

# Install pnpm using Tencent mirror
RUN npm install -g pnpm@9 --registry=https://mirrors.cloud.tencent.com/npm/

COPY package.json ./

# Install dependencies using Tencent mirror
RUN pnpm install --registry=https://mirrors.cloud.tencent.com/npm/

COPY . .

# Build the project
RUN pnpm run build

EXPOSE 8787

VOLUME /app/.wrangler

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8787/ || exit 1

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
