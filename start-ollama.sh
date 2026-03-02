#!/bin/bash

# ==========================================
# Ollama 本地 AI 服务启动脚本
# ==========================================

echo "🤖 启动 Ollama 本地 AI 服务..."
echo ""

# 检查 Ollama 是否安装
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama 未安装！"
    echo ""
    echo "安装方式:"
    echo "  curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    echo "或访问: https://ollama.com/download"
    exit 1
fi

echo "✅ Ollama 已安装"

# 检查 Ollama 服务是否运行
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "🚀 启动 Ollama 服务..."
    ollama serve &
    sleep 3
    
    # 再次检查
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "❌ 无法启动 Ollama 服务"
        exit 1
    fi
fi

echo "✅ Ollama 服务运行中"

# 检查模型是否存在
echo ""
echo "📦 检查模型..."
MODEL="qwen2.5:latest"
if ! ollama list | grep -q "$MODEL"; then
    echo "⬇️  下载模型 $MODEL ..."
    ollama pull $MODEL
fi

echo "✅ 模型 $MODEL 已就绪"

echo ""
echo "=================================="
echo "🎉 Ollama 本地 AI 服务已启动！"
echo "=================================="
echo ""
echo "API 地址: http://localhost:11434"
echo "模型: $MODEL"
echo ""
echo "测试命令:"
echo "  curl http://localhost:11434/api/generate -d '{"model":"$MODEL","prompt":"你好"}'"
echo ""
echo "现在可以重新启动 NavTools 服务:"
echo "  bash deploy.sh"
