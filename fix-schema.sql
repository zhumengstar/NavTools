-- NavTools 数据库结构修复脚本
-- 运行此脚本修复可能缺失的字段

-- 1. 修复 sites 表的 is_deleted 字段
ALTER TABLE sites ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE sites ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE sites ADD COLUMN login_username TEXT;
ALTER TABLE sites ADD COLUMN login_password_cipher TEXT;

-- 2. 修复 groups 表的 is_deleted 字段
ALTER TABLE groups ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN deleted_at TIMESTAMP;

-- 3. 修复 users 表的登录相关字段
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;

-- 4. 创建 user_quotas 表（如果不存在）
CREATE TABLE IF NOT EXISTS user_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    quota_limit INTEGER DEFAULT 100,
    reset_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_sites_is_deleted ON sites(is_deleted);
CREATE INDEX IF NOT EXISTS idx_groups_is_deleted ON groups(is_deleted);
CREATE INDEX IF NOT EXISTS idx_sites_group_id ON sites(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
