#!/bin/sh
set -e

# 定义数据库文件存放路径 (Wrangler 本地开发模式默认路径)
# 注意：在 Docker 中我们通常挂载 /app/.wrangler
DB_PATH="/app/.wrangler/state/v3/d1"

# 检查是否需要强制清空并初始化
if [ "$INIT_DB" = "true" ]; then
    echo "INIT_DB=true is detected. Clearing existing data..."
    rm -rf "$DB_PATH"
fi

# 检查数据库是否已经初始化
# Wrangler 会在上述路径下创建数据库文件，如果目录为空或不存在则认为未初始化
if [ ! -d "$DB_PATH" ] || [ -z "$(ls -A "$DB_PATH" 2>/dev/null)" ]; then
    echo "Database not found or empty. Initializing database..."
    
    # 确保目录存在
    mkdir -p "$DB_PATH"
    
    # 执行初始化 SQL
    pnpm exec wrangler d1 execute DB --local --file=scripts/init_db.sql
    
    # 插入种子数据
    if [ -f "scripts/seed_data.sql" ]; then
        echo "Inserting seed data..."
        pnpm exec wrangler d1 execute DB --local --file=scripts/seed_data.sql
    fi
    
    echo "Database initialization completed."
else
    echo "Database already exists. Skipping initialization."
fi

# 启动应用
echo "Starting NavTools via Wrangler..."
exec "$@"
