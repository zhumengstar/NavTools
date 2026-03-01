# 🚀 NavTools Docker 部署教程

本项目已针对 Docker (Debian Slim) 进行了深度优化，完美支持 Cloudflare D1 远程数据库和动态 CORS 适配。

## 📋 前提条件

1. **Docker**: 确保已安装 Docker。
2. **Cloudflare API Token**: 
   - 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)。
   - 创建一个具有 **Edit Cloudflare Workers** 和 **D1 Edit** 权限的 Token。
3. **Workers 子域名**: 确保已在 Cloudflare 控制面板设置了 `xxx.workers.dev` 子域名。

---

## 🏗 一键部署步骤

1. **克隆项目并进入目录**
   ```bash
   git clone -b release-stable https://github.com/zhumengstar/NavTools.git
   cd NavTools
   ```

2. **设置环境变量**
   ```bash
   export CLOUDFLARE_API_TOKEN="你的_CLOUDFLARE_TOKEN"
   ```

3. **执行部署脚本**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **访问服务**
   打开浏览器访问: `http://你的服务器IP:8788`

---

## 🛠 高级配置与常见问题

### 1. 切换到本地模拟数据库 (Offline Mode)
如果你不想连接云端，只需在启动命令中修改环境变量：
- 设置 `-e USE_REMOTE_DB=false`
- 容器会自动使用内部的 SQLite 数据库。

### 2. 手动初始化云端 D1 表结构
如果你的 D1 数据库是全新的，请在容器启动后执行：
```bash
docker exec -it navtools-app npx wrangler d1 execute mynav --remote --file=/app/scripts/init_db.sql
```

### 3. 数据备份
```bash
docker exec -it navtools-app npx wrangler d1 export mynav --remote --output /app/backup.sql
docker cp navtools-app:/app/backup.sql ./backup.sql
```

### 4. 为什么使用 Node-Slim 而非 Alpine？
Wrangler 的核心执行引擎 `workerd` 需要特定的 GLIBC 库。Alpine (Musl) 镜像会导致二进制文件无法运行。本项目强制使用 `node:20-slim` 以确保 100% 稳定性。

---

## 📜 常用维护命令

- **查看日志**: `docker logs -f navtools-app`
- **停止服务**: `docker stop navtools-app`
- **重新构建**: `./deploy.sh`
