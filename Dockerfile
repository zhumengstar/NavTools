# 使用 node:20-slim (Debian) 确保更好的二进制兼容性 (相比 Alpine)
FROM node:20-slim

WORKDIR /app

# 安装构建 D1/KV 本地模拟器所需的编译工具
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ca-certificates \
    sqlite3 \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 启用 Corepack 以使用 pnpm
RUN corepack enable

# 仅拷贝 package.json 进行缓存
COPY package.json ./

# 安装依赖
RUN pnpm install

# 拷贝全部源码
COPY . .

# 执行 Vite 构建
RUN pnpm run build

# 映射 8787 端口
EXPOSE 8787

# 将数据持久化目录设为 Volume
VOLUME /app/.wrangler

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8787/ || exit 1

# 使用脚本启动，强制本地模拟模式
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
