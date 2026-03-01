#!/bin/bash
set -e

echo "Starting NavTools container..."

# 确保本地状态目录存在
mkdir -p /app/.wrangler/state/v3/d1

# 检查是否需要使用远程 DB
if [ "$USE_REMOTE_DB" = "true" ]; then
    echo "Mode: Cloudflare Remote D1"
    exec npx wrangler dev --remote --ip 0.0.0.0 --port 8787
else
    echo "Mode: Local D1 Simulator"
    # 直接启动，数据库初始化由外部执行或通过 wrangler d1 execute
    exec npx wrangler dev --local --ip 0.0.0.0 --port 8787 --persist-to /app/.wrangler/state/v3/d1
fi
