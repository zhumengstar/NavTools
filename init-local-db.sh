#!/bin/bash
# 初始化本地数据库

DB_DIR="/Users/zgh/Desktop/workspace/NavTools/db"
DB_FILE="$DB_DIR/database.db"
SQL_FILE="/Users/zgh/Desktop/workspace/NavTools/scripts/init_db.sql"

echo "Creating local database directory..."
mkdir -p "$DB_DIR"

echo "Initializing database..."
if [ -f "$SQL_FILE" ]; then
    sqlite3 "$DB_FILE" < "$SQL_FILE"
    echo "Database initialized at $DB_FILE"
else
    echo "Error: SQL file not found at $SQL_FILE"
    exit 1
fi

echo "Database setup complete!"
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: password"
