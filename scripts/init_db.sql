-- 初始化数据库结构 (Consolidated Schema)

-- 创建分组表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    is_public INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引: groups.is_public
CREATE INDEX IF NOT EXISTS idx_groups_is_public ON groups(is_public);

-- 创建站点表
CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    notes TEXT,
    order_num INTEGER NOT NULL,
    is_public INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,
    last_clicked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- 创建索引: sites.is_public, sites.is_deleted
CREATE INDEX IF NOT EXISTS idx_sites_is_public ON sites(is_public);
CREATE INDEX IF NOT EXISTS idx_sites_is_deleted ON sites(is_deleted);

-- 创建配置表
CREATE TABLE IF NOT EXISTS configs (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (key, user_id)
);

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 默认管理员账号 (密码: password)
-- 注意：实际部署时请修改密码
INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ('admin', '$2y$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'admin');

-- 设置初始化标志
INSERT OR IGNORE INTO configs (key, value, user_id) VALUES ('DB_INITIALIZED', 'true', 1);
