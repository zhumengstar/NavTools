#!/bin/bash

# ==========================================
# NavTools 数据库自动修复脚本
# ==========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载环境变量
if [ -f .env ]; then
    source .env
fi

API_BASE="${1:-http://localhost:8787}"

echo "🔧 NavTools 数据库自动修复工具"
echo "=================================="
echo ""

# 1. 先检查结构
echo "🔍 步骤 1: 检查当前表结构..."
SCHEMA_JSON=$(curl -s "$API_BASE/api/debug/schema" 2>/dev/null)

if [ -z "$SCHEMA_JSON" ] || [ "$SCHEMA_JSON" = "null" ]; then
    echo -e "${RED}❌ 无法连接到 API: $API_BASE${NC}"
    echo "请确保服务已启动"
    exit 1
fi

# 解析检查结果
SITES_HAS_IS_DELETED=$(echo "$SCHEMA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('check',{}).get('sites_has_is_deleted',False))" 2>/dev/null || echo "false")
GROUPS_HAS_IS_DELETED=$(echo "$SCHEMA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('check',{}).get('groups_has_is_deleted',False))" 2>/dev/null || echo "false")
USERS_HAS_LOGIN_COUNT=$(echo "$SCHEMA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('check',{}).get('users_has_login_count',False))" 2>/dev/null || echo "false")
USER_QUOTAS_EXISTS=$(echo "$SCHEMA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('check',{}).get('user_quotas_exists',False))" 2>/dev/null || echo "false")

# 2. 判断需要修复的内容
NEED_FIX=false

echo ""
echo "📊 检查结果:"
[ "$SITES_HAS_IS_DELETED" = "True" ] && echo -e "  ✅ sites.is_deleted" || { echo -e "  ⚠️  ${YELLOW}sites.is_deleted 缺失${NC}"; NEED_FIX=true; }
[ "$GROUPS_HAS_IS_DELETED" = "True" ] && echo -e "  ✅ groups.is_deleted" || { echo -e "  ⚠️  ${YELLOW}groups.is_deleted 缺失${NC}"; NEED_FIX=true; }
[ "$USERS_HAS_LOGIN_COUNT" = "True" ] && echo -e "  ✅ users.login_count" || { echo -e "  ⚠️  ${YELLOW}users.login_count 缺失${NC}"; NEED_FIX=true; }
[ "$USER_QUOTAS_EXISTS" = "True" ] && echo -e "  ✅ user_quotas 表" || { echo -e "  ⚠️  ${YELLOW}user_quotas 表缺失${NC}"; NEED_FIX=true; }

# 3. 如果没有问题，直接退出
if [ "$NEED_FIX" = "false" ]; then
    echo ""
    echo -e "${GREEN}✅ 所有表结构正常，无需修复！${NC}"
    exit 0
fi

# 4. 需要修复
echo ""
echo "🔧 步骤 2: 执行修复..."
echo ""

# 生成修复 SQL
FIX_SQL=""

if [ "$SITES_HAS_IS_DELETED" != "True" ]; then
    FIX_SQL+="ALTER TABLE sites ADD COLUMN is_deleted INTEGER DEFAULT 0;\n"
    FIX_SQL+="ALTER TABLE sites ADD COLUMN deleted_at TIMESTAMP;\n"
fi

if [ "$GROUPS_HAS_IS_DELETED" != "True" ]; then
    FIX_SQL+="ALTER TABLE groups ADD COLUMN is_deleted INTEGER DEFAULT 0;\n"
    FIX_SQL+="ALTER TABLE groups ADD COLUMN deleted_at TIMESTAMP;\n"
fi

if [ "$USERS_HAS_LOGIN_COUNT" != "True" ]; then
    FIX_SQL+="ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;\n"
    FIX_SQL+="ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;\n"
fi

if [ "$USER_QUOTAS_EXISTS" != "True" ]; then
    FIX_SQL+="CREATE TABLE IF NOT EXISTS user_quotas (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, usage_count INTEGER DEFAULT 0, quota_limit INTEGER DEFAULT 100, reset_date TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);\n"
fi

echo "将要执行的 SQL:"
echo -e "${BLUE}$FIX_SQL${NC}"
echo ""

# 5. 执行修复 (使用 Wrangler)
if [ -n "$CLOUDFLARE_DATABASE_ID" ] && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "🚀 使用 Wrangler 执行修复..."
    
    # 创建临时 SQL 文件
    TEMP_SQL=$(mktemp)
    echo -e "$FIX_SQL" > "$TEMP_SQL"
    
    # 使用 wrangler d1 execute
    npx wrangler d1 execute "$CLOUDFLARE_DATABASE_ID" --remote --file="$TEMP_SQL" 2>&1
    RESULT=$?
    
    rm -f "$TEMP_SQL"
    
    if [ $RESULT -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ 修复成功！${NC}"
        echo ""
        echo "🔍 重新检查表结构..."
        curl -s "$API_BASE/api/debug/schema" | python3 -c "import sys,json; d=json.load(sys.stdin); print('检查结果:', json.dumps(d.get('check',{}), indent=2, ensure_ascii=False))"
    else
        echo -e "${RED}❌ 修复失败，请手动执行 SQL${NC}"
        echo "SQL 文件已保存到: fix-schema.sql"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  未配置 Cloudflare 环境变量，无法自动执行${NC}"
    echo ""
    echo "请手动执行以下 SQL:"
    echo "==================="
    echo -e "$FIX_SQL"
    echo "==================="
    echo ""
    echo "或配置环境变量后重新运行:"
    echo "  export CLOUDFLARE_DATABASE_ID=your-db-id"
    echo "  export CLOUDFLARE_API_TOKEN=your-token"
    exit 1
fi
