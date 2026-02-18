# Docker 部署指南

本项目支持使用 Docker 进行一键部署，并且已经配置为使用本地 SQLite 模拟的 D1 数据库。

## 前置要求

- 安装 [Docker](https://www.docker.com/)
- 安装 [Docker Compose](https://docs.docker.com/compose/install/)

## 一键部署

在项目根目录下运行以下命令：

```bash
docker-compose up -d --build
```

部署完成后，访问 [http://localhost:8787](http://localhost:8787) 即可使用。

## D1 数据库说明

本项目在 Docker 容器中运行 `wrangler dev`，它会自动使用本地 SQLite 来模拟 Cloudflare D1 数据库。

- **无需额外配置**：不需要配置远程 Cloudflare 账号或 API Key。
- **数据持久化**：所有的数据库文件都保存在项目根目录下的 `.wrangler` 文件夹中。
- **备份与恢复**：只需备份 `.wrangler` 文件夹即可备份整个数据库。

## 服务管理

- **停止服务**：
  ```bash
  docker-compose down
  ```
- **查看日志**：
  ```bash
  docker-compose logs -f
  ```
- **重启服务**：
  ```bash
  docker-compose restart
  ```

## 环境变量配置

如果需要修改配置（例如端口），请直接修改 `docker-compose.yml` 文件。
