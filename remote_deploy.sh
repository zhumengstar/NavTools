#!/bin/bash

# =================================================================
# Navihive 远程一键部署脚本
# 功能：从 GitHub 克隆最新代码并使用 Docker Compose 启动服务
# =================================================================

# 1. 配置变量
REPO_URL="https://github.com/Cloudflare-Navihive/Navihive.git" # 请确保这是正确的仓库地址
TARGET_DIR="Navihive"

echo "🚀 开始远程部署流程..."

# 2. 检查依赖
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未安装 git，请先安装 git。"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 docker，请先安装 docker。"
    exit 1
fi

# 3. 克隆代码
if [ -d "$TARGET_DIR" ]; then
    echo "📂 目录 $TARGET_DIR 已存在，准备更新代码..."
    cd "$TARGET_DIR"
    git pull
else
    echo "🌐 正在克-clone 仓库..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# 4. 执行 Docker 部署
echo "🐳 正在启动 Docker 容器..."
docker-compose up -d --build

# 5. 验证
echo "⏳ 等待服务启动..."
sleep 10

if curl -s --head  --request GET http://localhost:8787 | grep "200 OK" > /dev/null; then
    echo "✅ 部署成功！访问地址: http://localhost:8787"
else
    echo "⚠️ 服务已启动，但端口响应异常，请运行 'docker-compose logs -f' 查看详细日志。"
fi
