# NaviHive - macOS 快速启动

## 🚀 快速开始（推荐）

### 方式一：使用启动脚本（最简单）

```bash
# 给脚本添加执行权限（首次运行）
chmod +x macOS启动脚本.sh

# 运行启动脚本
./macOS启动脚本.sh
```

脚本会自动：
1. 检查系统环境
2. 安装依赖
3. 初始化数据库
4. 提供多种启动选项

---

### 方式二：命令行启动

#### 快速开发模式（Mock 数据）
```bash
npm install
npm run dev
```
访问：http://localhost:5173

#### 完整本地部署
```bash
npm install

# 初始化数据库
wrangler d1 execute mynav-local --local --file=./init_table.sql

# 启动完整服务
wrangler dev --config wrangler.local.jsonc --port 8788
```
访问：http://localhost:8788

---

## 📚 详细文档

- [完整部署指南](./macOS本地部署.md) - 详细的部署步骤和故障排查
- [本地运行指南](./本地运行指南.md) - 开发环境配置
- [项目设计文档](./设计文档.md) - 系统架构和API文档

---

## 🖥️ 系统要求

- **操作系统**: macOS 11.7.10 (20G1427)
- **处理器**: 2.3 GHz 四核 Intel Core i7
- **Node.js**: v18+ (推荐 v22)
- **内存**: 8GB+

---

## 📦 部署选项

| 选项 | 说明 | 适用场景 |
|------|------|----------|
| 1 | 前端开发（Mock 数据） | UI 开发和测试 |
| 2 | 本地完整部署 | 完整功能测试 |
| 3 | 分离式开发 | 前后端同时开发 |
| 4 | 仅 Worker API | 后端独立开发 |
| 5 | 仅前端（真实 API） | 前端连接现有后端 |
| 6 | 部署到 Cloudflare | 生产环境部署 |
| 7 | 重置数据库 | 数据库初始化 |

---

## 🔧 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 类型检查
npx tsc -b

# Lint 检查
npm run lint

# 格式化代码
npm run format

# 初始化数据库
wrangler d1 execute mynav-local --local --file=./init_table.sql

# 本地 Worker
wrangler dev --config wrangler.local.jsonc --port 8788

# 部署到 Cloudflare
wrangler deploy
```

---

## 🔑 默认登录凭据

- **用户名**: `admin`
- **密码**: `admin`

---

## ⚠️ 常见问题

### 端口被占用
```bash
lsof -i :5173  # 查找占用 5173 端口的进程
kill -9 <PID> # 杀死进程
```

### 清理缓存
```bash
rm -rf node_modules
npm install
```

### 权限问题
```bash
chmod +x *.sh
```

---

## 📞 支持

如有问题，请查看：
1. [macOS本地部署.md](./macOS本地部署.md) - 详细部署指南
2. [本地运行指南.md](./本地运行指南.md) - 开发环境配置
3. [设计文档.md](./设计文档.md) - API 和架构文档
