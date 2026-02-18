-- 初始化种子数据 (Seed Data)

-- 插入默认分组
INSERT OR IGNORE INTO groups (id, name, order_num, is_public) VALUES (1, '常用工具', 1, 1);
INSERT OR IGNORE INTO groups (id, name, order_num, is_public) VALUES (2, '搜索引擎', 2, 1);
INSERT OR IGNORE INTO groups (id, name, order_num, is_public) VALUES (3, '开发社区', 3, 1);

-- 插入常用站点
-- 常用工具
INSERT OR IGNORE INTO sites (group_id, name, url, icon, description, order_num, is_featured) VALUES 
(1, 'GitHub', 'https://github.com', 'https://github.com/favicon.ico', '全球最大的代码托管平台', 1, 1),
(1, 'ChatGPT', 'https://chat.openai.com', 'https://openai.com/favicon.ico', '人工智能对话工具', 2, 0);

-- 搜索引擎
INSERT OR IGNORE INTO sites (group_id, name, url, icon, description, order_num, is_featured) VALUES 
(2, 'Google', 'https://www.google.com', 'https://www.google.com/favicon.ico', '全球领先的搜索引擎', 1, 1),
(2, '百度', 'https://www.baidu.com', 'https://www.baidu.com/favicon.ico', '国内主流搜索引擎', 2, 0),
(2, 'Bing', 'https://www.bing.com', 'https://www.bing.com/favicon.ico', '微软推出的搜索引擎', 3, 0);

-- 开发社区
INSERT OR IGNORE INTO sites (group_id, name, url, icon, description, order_num, is_featured) VALUES 
(3, 'V2EX', 'https://www.v2ex.com', 'https://www.v2ex.com/static/favicon.ico', '创意工作者社区', 1, 1),
(3, '掘金', 'https://juejin.cn', 'https://juejin.cn/favicon.ico', '帮助开发者成长的社区', 2, 0),
(3, 'Stack Overflow', 'https://stackoverflow.com', 'https://stackoverflow.com/favicon.ico', '全球最大的编程问答社区', 3, 0);
