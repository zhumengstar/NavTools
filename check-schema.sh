#!/bin/bash

# ==========================================
# NavTools 数据库表结构检查脚本
# ==========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载环境变量
if [ -f .env ]; then
    source .env
fi

# 设置 API 基础 URL
if [ -n "$1" ]; then
    API_BASE="$1"
else
    API_BASE="http://localhost:8787"
fi

echo "🔍 检查数据库表结构..."
echo "API 地址: $API_BASE"
echo ""

# 检查端点是否可访问
echo "📡 测试连接..."
if ! curl -s "$API_BASE/api/debug/schema" > /dev/null 2>&1; then
    echo -e "${RED}❌ 无法连接到 API: $API_BASE${NC}"
    echo "请确保服务已启动或使用参数指定地址:"
    echo "  bash check-schema.sh http://your-domain:port"
    exit 1
fi

# 获取表结构信息
echo "📊 获取表结构信息..."
SCHEMA_JSON=$(curl -s "$API_BASE/api/debug/schema")

# 检查是否返回错误
if echo "$SCHEMA_JSON" | grep -q '"error"'; then
    echo -e "${RED}❌ API 返回错误:${NC}"
    echo "$SCHEMA_JSON" | python3 -m json.tool 2>/dev/null || echo "$SCHEMA_JSON"
    exit 1
fi

# 检查必要的字段
echo ""
echo "=================================="
echo "       表结构检查结果"
echo "=================================="
echo ""

# 检查 sites 表的 is_deleted 字段
SITES_HAS_IS_DELETED=$(echo "$SCHEMA_JSON" | grep -o '"sites_has_is_deleted":[a-z]*' | cut -d':' -f2)
if [ "$SITES_HAS_IS_DELETED" = "true" ]; then
    echo -e "✅ ${GREEN}sites 表有 is_deleted 字段${NC}"
else
    echo -e "⚠️  ${YELLOW}sites 表缺少 is_deleted 字段${NC}"
    echo "   建议: ALTER TABLE sites ADD COLUMN is_deleted INTEGER DEFAULT 0;"
fi

# 检查 groups 表的 is_deleted 字段
GROUPS_HAS_IS_DELETED=$(echo "$SCHEMA_JSON" | grep -o '"groups_has_is_deleted":[a-z]*' | cut -d':' -f2)
if [ "$GROUPS_HAS_IS_DELETED" = "true" ]; then
    echo -e "✅ ${GREEN}groups 表有 is_deleted 字段${NC}"
else
    echo -e "⚠️  ${YELLOW}groups 表缺少 is_deleted 字段${NC}"
    echo "   建议: ALTER TABLE groups ADD COLUMN is_deleted INTEGER DEFAULT 0;"
fi

# 检查 users 表的 login_count 字段
USERS_HAS_LOGIN_COUNT=$(echo "$SCHEMA_JSON" | grep -o '"users_has_login_count":[a-z]*' | cut -d':' -f2)
if [ "$USERS_HAS_LOGIN_COUNT" = "true" ]; then
    echo -e "✅ ${GREEN}users 表有 login_count 字段${NC}"
else
    echo -e "⚠️  ${YELLOW}users 表缺少 login_count 字段${NC}"
    echo "   建议: ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;"
fi

# 检查 user_quotas 表
USER_QUOTAS_EXISTS=$(echo "$SCHEMA_JSON" | grep -o '"user_quotas_exists":[a-z]*' | cut -d':' -f2)
if [ "$USER_QUOTAS_EXISTS" = "true" ]; then
    echo -e "✅ ${GREEN}user_quotas 表存在${NC}"
else
    echo -e "⚠️  ${YELLOW}user_quotas 表不存在${NC}"
    echo "   需要创建该表来支持 AI 使用次数统计"
fi

echo ""
echo "=================================="

# 详细表结构
echo ""
echo -e "${BLUE}📋 详细表结构 (JSON):${NC}"
echo "$SCHEMA_JSON" | python3 -m json.tool 2>/dev/null || echo "$SCHEMA_JSON"

echo ""
echo "=================================="
echo "检查完成!"
echo "=================================="
