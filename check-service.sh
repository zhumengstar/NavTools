#!/bin/bash

# ==========================================
# NavTools 服务状态检查脚本
# ==========================================

echo "🔍 检查 NavTools 服务状态..."
echo ""

# 检查 Docker 是否运行
echo "1. 检查 Docker 状态..."
if ! docker info > /dev/null 2>&1; then
    echo "   ❌ Docker 未运行！请启动 Docker Desktop"
    exit 1
else
    echo "   ✅ Docker 运行中"
fi

# 检查容器状态
echo ""
echo "2. 检查 NavTools 容器..."
CONTAINER_STATUS=$(docker ps -f name=navtools-app --format "{{.Status}}" 2>/dev/null)
if [ -z "$CONTAINER_STATUS" ]; then
    echo "   ❌ 容器未运行！"
    echo ""
    echo "   尝试启动..."
    docker ps -a | grep navtools-app
    echo ""
    echo "   运行以下命令启动:"
    echo "   docker start navtools-app"
    echo "   或重新部署: bash deploy.sh"
    exit 1
else
    echo "   ✅ 容器运行中: $CONTAINER_STATUS"
fi

# 检查端口
echo ""
echo "3. 检查端口..."
if lsof -Pi :8788 -sTCP:LISTEN -t > /dev/null 2>&1; then
    echo "   ✅ 端口 8788 监听中"
else
    echo "   ❌ 端口 8788 未监听"
fi

# 测试 API
echo ""
echo "4. 测试 API..."
if curl -s http://localhost:8788/api/auth/status > /dev/null 2>&1; then
    echo "   ✅ API 响应正常"
else
    echo "   ❌ API 无响应"
    echo "   查看日志: docker logs -f navtools-app"
fi

echo ""
echo "=================================="

# 检查前端配置
echo ""
echo "5. 前端配置检查..."
echo "   开发模式: http://localhost:5173 (Vite代理到 8787)"
echo "   生产模式: http://localhost:8788 (Docker)"
