# 本地 Docker 部署指南

## 🚨 当前问题：Docker Hub 镜像拉取失败

错误信息：`failed to fetch oauth token: Get "https://auth.docker.io/token...": EOF`

**原因**：网络连接问题导致无法从 Docker Hub 拉取 `node:22-slim` 镜像

## 🔧 解决方案

### 方案 1：配置 Docker 镜像加速器（推荐）

#### macOS Docker Desktop 配置：
1. 打开 Docker Desktop
2. 进入 Settings/Preferences → Docker Engine
3. 添加镜像源配置：
```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://registry.docker-cn.com",
    "https://mirror.ccs.tencentyun.com"
  ]
}
```
4. 点击 Apply & Restart

#### Linux 命令行配置：
```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://registry.docker-cn.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方案 2：使用 Node.js 18 镜像（兼容性更好）

修改 `Dockerfile`，使用更稳定的 Node.js 版本：

```dockerfile
# 将原来的 FROM node:22-slim 替换为：
FROM node:18-alpine

# 或者在 docker-compose.yml 中指定：
services:
  navtools:
    image: node:18-alpine  # 临时使用，实际还是需要从构建开始
```

### 方案 3：离线构建（最快解决方案）

由于我们已经有了项目代码，可以创建基于当前环境的部署：

#### 创建本地构建镜像：
```bash
cd /Users/zgh/Desktop/workspace/NavTools

# 创建包含所有依赖的完整镜像
cat > Dockerfile.local << 'EOF'
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY pnpm-lock.yaml ./ 2>/dev/null || echo "No pnpm lock file"

# 设置 Alpine 依赖（如果需要 better-sqlite3）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

# 安装 pnpm（如果有的话）
RUN npm install -g pnpm || echo "pnpm not available, using npm"

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 暴露端口
EXPOSE 8787

# 启动命令
CMD ["npm", "start"]
EOF

# 构建本地镜像
docker build -f Dockerfile.local -t navtools:local .
```

### 方案 4：使用现有 Docker 镜像 + 挂载代码

```bash
# 使用任何可用的 Node.js 镜像
docker run -d --name navtools-dev \
  -p 8787:8787 \
  -v $(pwd):/app \
  -w /app \
  -e NODE_ENV=production \
  -e DB_TYPE=d1 \
  -e USE_REMOTE_DB=true \
  -e AI_BASE_URL=https://cliproxy.1997121.xyz/v1 \
  -e AI_API_KEY=sk-cLhZ6wffGNE4CvvL0K3L0NfWkFsO4uQ5Mz6XoK7JaFlqJgIp09 \
  -e DEFAULT_MODEL=gemini-3.1-pro-high \
  -e AUTH_USERNAME=admin \
  -e ADMIN_PASSWORD=admin1 \
  -e CLOUDFLARE_DATABASE_ID=2539afd9-931b-444b-8bc7-2e0816242ba8 \
  node:18-alpine \
  sh -c "npm install && npm run build && npm start"
```

## 🚀 推荐的完整部署步骤

### Step 1: 配置 Docker 镜像源
按照方案 1 配置 Docker Desktop 镜像加速器

### Step 2: 验证 Docker 配置
```bash
docker info | grep -i registry
docker pull node:18-alpine  # 测试能否拉取镜像
docker pull nginx:alpine      # 测试其他镜像
```

### Step 3: 构建项目镜像
```bash
cd /Users/zgh/Desktop/workspace/NavTools

# 如果使用默认配置
docker-compose build --no-cache

# 或者单独构建
docker build -t navtools:latest .
```

### Step 4: 启动服务
```bash
# 使用 docker-compose（推荐）
docker-compose up -d

# 或者单独运行
docker run -d --name navtools \
  -p 8787:8787 \
  -e NODE_ENV=production \
  -e DB_TYPE=d1 \
  -e USE_REMOTE_DB=true \
  -e AI_BASE_URL=https://cliproxy.1997121.xyz/v1 \
  -e AI_API_KEY=sk-cLhZ6wffGNE4CvvL0K3L0NfWkFsO4uQ5Mz6XoK7JaFlqJgIp09 \
  -e DEFAULT_MODEL=gemini-3.1-pro-high \
  -e AUTH_USERNAME=admin \
  -e ADMIN_PASSWORD=admin1 \
  -e CLOUDFLARE_DATABASE_ID=2539afd9-931b-444b-8bc7-2e0816242ba8 \
  navtools:latest
```

### Step 5: 验证部署
```bash
# 检查容器状态
docker ps | grep navtools

# 查看日志
docker logs navtools

# 健康检查
curl http://localhost:8787/api/health

# 测试登录
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin1"}'
```

## 🔧 故障排除

### 问题 1: 镜像拉取超时
```bash
# 增加 Docker 超时时间
export DOCKER_CLIENT_TIMEOUT=120
export COMPOSE_HTTP_TIMEOUT=120
```

### 问题 2: better-sqlite3 编译失败
在 Dockerfile 中添加构建依赖：
```dockerfile
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && npm rebuild better-sqlite3
```

### 问题 3: 端口占用
```bash
# 检查端口占用
docker ps | grep 8787
lsof -i :8787

# 停止冲突容器
docker stop $(docker ps -q --filter publish=8787)
```

## 📊 部署架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Local Docker  │───▶│  Remote D1 DB    │    │  AI Model API   │
│   Port: 8787    │    │  Cloudflare      │    │  cliproxy.xyz   │
│   Node.js App   │    │  Database        │    │  gemini-3.1-pro │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ✅ 预期结果

部署成功后应该能够：
1. 访问 http://localhost:8787
2. 使用 admin/admin1 登录
3. 所有数据存储在远程 Cloudflare D1
4. AI 功能通过代理接口正常工作

## 🆘 紧急备用方案

如果 Docker 仍有问题，使用直接运行：
```bash
cd /Users/zgh/Desktop/workspace/NavTools
npm install
npm run build
npm start
```

这会直接在本地运行，同样支持远程 D1 数据库。