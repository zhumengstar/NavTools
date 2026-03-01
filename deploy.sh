#!/bin/bash

# ==========================================
# NavTools 一键部署脚本
# ==========================================

# 1. 配置区域
IMAGE_NAME="navtools"
CONTAINER_NAME="navtools-app"
PUBLIC_PORT=8788

# 建议在运行前设置以下环境变量，或在此处硬编码（不推荐）
# export CLOUDFLARE_API_TOKEN="你的TOKEN"

echo "🚀 开始部署 NavTools..."

# 2. 检查环境
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "⚠️  警告: 未检测到 CLOUDFLARE_API_TOKEN 环境变量。"
    echo "请执行: export CLOUDFLARE_API_TOKEN='你的TOKEN'"
    exit 1
fi

# 3. 清理旧容器
echo "🧹 正在清理旧容器..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# 4. 构建镜像
echo "🛠 正在构建 Docker 镜像 (Debian 优化版)..."
docker build -t $IMAGE_NAME:latest .

# 5. 启动容器
echo "🛰 正在启动容器 (远程 D1 模式)..."
docker run -d --name $CONTAINER_NAME \
  -p $PUBLIC_PORT:8787 \
  -e USE_REMOTE_DB=true \
  -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  -v $(pwd)/.wrangler:/app/.wrangler \
  --restart unless-stopped \
  $IMAGE_NAME:latest

echo "✅ 部署完成！"
echo "🌐 访问地址: http://localhost:$PUBLIC_PORT"
echo "📜 查看日志: docker logs -f $CONTAINER_NAME"
