#!/bin/bash

################################################################################
# NaviHive 快速测试脚本
# 用于快速验证项目配置和环境
################################################################################

echo "🔍 NaviHive 项目快速测试"
echo "================================"
echo ""

# 1. 检查文件结构
echo "📁 检查项目结构..."
FILES=(
    "package.json"
    "vite.config.ts"
    "tsconfig.json"
    "src/App.tsx"
    "src/main.tsx"
    "worker/index.ts"
    "wrangler.jsonc"
)

ALL_EXISTS=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (缺失)"
        ALL_EXISTS=false
    fi
done

echo ""

# 2. 检查 Node.js
echo "🟢 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "  ✅ Node.js 版本: $NODE_VERSION"
else
    echo "  ❌ Node.js 未安装"
    ALL_EXISTS=false
fi

# 3. 检查 npm
echo "📦 检查 npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "  ✅ npm 版本: $NPM_VERSION"
else
    echo "  ❌ npm 未安装"
    ALL_EXISTS=false
fi

# 4. 检查依赖
echo "📚 检查项目依赖..."
if [ -d "node_modules" ]; then
    DEPS_COUNT=$(ls node_modules | wc -l)
    echo "  ✅ 依赖已安装 ($DEPS_COUNT 个包)"
else
    echo "  ⚠️  依赖未安装"
fi

# 5. 检查 TypeScript 配置
echo "📘 检查 TypeScript 配置..."
if command -v tsc &> /dev/null || [ -d "node_modules/typescript" ]; then
    echo "  ✅ TypeScript 可用"
else
    echo "  ❌ TypeScript 未安装"
fi

# 6. 检查 Vite 配置
echo "⚡ 检查 Vite 配置..."
if [ -f "vite.config.ts" ]; then
    echo "  ✅ Vite 配置文件存在"
else
    echo "  ❌ Vite 配置文件缺失"
fi

# 7. 检查 Wrangler
echo "☁️  检查 Wrangler..."
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version 2>/dev/null | head -1)
    echo "  ✅ Wrangler 已安装: $WRANGLER_VERSION"
else
    echo "  ⚠️  Wrangler 未安装（仅前端开发不需要）"
fi

echo ""
echo "================================"

if [ "$ALL_EXISTS" = true ]; then
    echo "✅ 基本检查通过！"
    echo ""
    echo "🚀 快速开始："
    echo "  1. 如果依赖未安装，运行: npm install"
    echo "  2. 启动开发服务器: npm run dev"
    echo "  3. 访问: http://localhost:5173"
    echo ""
    echo "📖 更多信息请查看: ./本地运行指南.md"
else
    echo "❌ 发现问题，请先解决"
fi
