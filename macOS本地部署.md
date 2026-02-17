# NaviHive macOS 本地部署指南

## 环境信息
- **操作系统**: macOS 11.7.10 (20G1427)
- **处理器**: 2.3 GHz 四核 Intel Core i7
- **Node.js 版本**: v22.13.1 (推荐 18+)
- **npm 版本**: 10.9.2

## 前置要求

### 1. 安装 Node.js
```bash
# 使用 Homebrew 安装（推荐）
brew install node

# 或从官网下载安装包
# https://nodejs.org/
```

### 2. 安装 Wrangler CLI
```bash
npm install -g wrangler

# 验证安装
wrangler --version
```

### 3. 登录 Cloudflare（可选，如需远程部署）
```bash
wrangler login
```

## 本地部署步骤

### 方式一：纯前端本地运行（推荐开发测试）

#### 步骤 1：安装依赖
```bash
cd /Users/zgh/Desktop/workspace/Cloudflare-Navihive
npm install
```

#### 步骤 2：启动开发服务器
```bash
npm run dev
```

#### 步骤 3：访问应用
打开浏览器访问：**http://localhost:5173**

**说明**：此方式使用 Mock 数据，无需后端，适合 UI 开发和测试。

---

### 方式二：本地完整部署（前端 + Worker）

#### 步骤 1：安装依赖
```bash
npm install
```

#### 步骤 2：创建本地 D1 数据库
```bash
# 创建本地数据库
wrangler d1 create mynav-local

# 或使用已有数据库
wrangler d1 execute mynav-local --local --file=./init_table.sql
```

#### 步骤 3：构建前端
```bash
npm run build
```

#### 步骤 4：启动本地 Worker 服务器
```bash
wrangler dev --config wrangler.local.jsonc --port 8788
```

#### 步骤 5：访问应用
打开浏览器访问：**http://localhost:8788**

**说明**：此方式启动完整的后端服务，支持数据库操作和 API 调用。

---

### 方式三：分离式开发（推荐）

#### 终端 1 - 启动本地 Worker API
```bash
wrangler dev --config wrangler.local.jsonc --port 8788
```

#### 终端 2 - 启动前端开发服务器（连接真实 API）
```bash
VITE_USE_REAL_API=true VITE_API_BASE_URL=http://localhost:8788 npm run dev
```

#### 访问应用
打开浏览器访问：**http://localhost:5173**

**说明**：此方式支持热更新，前端和后端同时开发。

---

## 数据库管理

### 初始化数据库
```bash
wrangler d1 execute mynav-local --local --file=./init_table.sql
```

### 查询数据库
```bash
# 查询分组
wrangler d1 execute mynav-local --local --command="SELECT * FROM groups;"

# 查询站点
wrangler d1 execute mynav-local --local --command="SELECT * FROM sites;"
```

### 导入测试数据
```bash
wrangler d1 execute mynav-local --local --file=./test_data.sql
```

---

## 部署到 Cloudflare（可选）

### 构建
```bash
npm run build
```

### 部署
```bash
wrangler deploy
```

---

## 常见问题

### 1. 端口被占用
```bash
# 查找占用端口的进程
lsof -i :5173
lsof -i :8788

# 杀死进程
kill -9 <PID>
```

### 2. 权限问题
```bash
# 给脚本添加执行权限
chmod +x 启动脚本.sh
chmod +x 测试脚本.sh
```

### 3. 清理缓存
```bash
# 清理 npm 缓存
npm cache clean --force

# 清理 node_modules
rm -rf node_modules package-lock.json
npm install
```

### 4. TypeScript 编译错误
```bash
# 重新生成类型
npm run cf-typegen

# 重新构建
npm run build
```

---

## 性能优化（针对 Intel Core i7）

### 1. 构建优化
在 `vite.config.ts` 中已配置优化：
- 使用 Cloudflare Vite 插件
- 启用 Tree-shaking
- 代码分割

### 2. 开发服务器优化
```bash
# 增加内存限制（如需要）
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

### 3. 并行构建
```bash
# 使用 pnpm 提升速度（推荐）
npm install -g pnpm
pnpm install
pnpm build
```

---

## 环境变量说明

### `.env.local` 文件
```bash
VITE_USE_REAL_API=false      # 是否使用真实 API
VITE_API_BASE_URL=http://localhost:8788  # API 地址
VITE_PORT=5173                # 前端端口
VITE_HOST=localhost           # 主机地址
```

### `wrangler.local.jsonc` 环境变量
```json
{
    "AUTH_ENABLED": "true",                    # 启用认证
    "AUTH_REQUIRED_FOR_READ": "false",          # 只读接口是否需要认证
    "AUTH_USERNAME": "admin",                   # 用户名
    "AUTH_PASSWORD": "$2y$10$...",              # bcrypt 加密密码
    "AUTH_SECRET": "UKcwT_%H5H6dy3..."          # JWT 密钥
}
```

### 默认登录凭据
- **用户名**: `admin`
- **密码**: `admin`（或在 wrangler.jsonc 中配置的密码）

---

## 开发工具

### VS Code 推荐插件
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense

### 浏览器开发者工具
- Chrome DevTools
- React Developer Tools

---

## 测试

### 本地测试
```bash
# 启动本地服务器
npm run dev

# 访问测试
open http://localhost:5173
```

### 功能测试清单
- [ ] 登录/登出功能
- [ ] 分组增删改查
- [ ] 站点增删改查
- [ ] 拖拽排序
- [ ] 搜索功能
- [ ] 主题切换
- [ ] 数据导入/导出

---

## 更新日志

- 2026-02-03: 适配 macOS 11.7.10 本地部署
- 支持 Intel Core i7 四核优化
- 添加三种部署方式
