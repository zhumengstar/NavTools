# Docker 部署（实验性）

NavTools 原生设计为运行在 Cloudflare Workers 上，但也支持通过 Docker 进行本地或私有服务器部署。

::: warning 实验性功能
Docker 部署目前处于实验阶段，可能不支持 Cloudflare 的某些特定功能（如 D1 数据库的某些特性）。不建议用于生产环境。
:::

## 准备工作

- 已安装 Docker 和 Docker Compose
- 已获取 `database_id` (虽然本地运行使用 SQLite 文件，但配置格式仍需保持一致)

## 部署步骤

### 1. 获取代码

```bash
git clone https://github.com/zhumengstar/NavTools.git
cd NavTools
```

### 2. 构建镜像

```bash
docker build -t navtools .
```

### 3. 运行容器

```bash
docker run -d \
  -p 8787:8787 \
  -e AUTH_SECRET=your-32-char-secret \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your-bcrypt-password-hash \
  --name navtools \
  navtools
```

访问 `http://localhost:8787` 即可看到运行中的 NavTools。

## 使用 Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3'
services:
  navtools:
    build: .
    ports:
      - "8787:8787"
    environment:
      - AUTH_SECRET=your-secret
      - AUTH_USERNAME=admin
      - AUTH_PASSWORD=your-hash
    restart: always
```

启动：
```bash
docker-compose up -d
```

## 数据持久化

Docker 部署使用 miniflare 模拟环境。默认情况下数据存储在容器内。为了持久化数据，需要挂载目录：

```yaml
    volumes:
      - ./data:/app/.mf
```

*(注意：具体路径取决于 miniflare 的版本和配置)*

## 限制

Docker 部署相比 Cloudflare Workers 部署有以下劣势：
1. **失去全球 CDN 加速**：取决于您服务器的位置和带宽。
2. **运维成本**：需要自己管理服务器、更新镜像。
3. **冷启动**：虽然 Node.js 很快，但不如 Workers 的 0ms 冷启动。

建议优先使用 Cloudflare Workers 部署。
