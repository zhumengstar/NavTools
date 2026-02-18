# Docker Compose 一键部署指南

本项目已针对 Docker 环境进行深度优化，支持本地化一键部署，并内置了 D1 数据库与 KV 存储的本地模拟。

## 🚀 快速启动

在项目根目录下，直接运行以下命令：

```bash
docker-compose up -d --build
```

部署完成后，即可访问：
👉 **[http://localhost:8787](http://localhost:8787)**

---

## 🛠️ 环境要求

- **Docker**: 24.0+
- **Docker Compose**: 2.0+
- **系统环境**: 宿主机需开放 `8787` 端口。

## 📦 部署特性

- **独立运行**：不依赖 Cloudflare 网络，数据库、存储、前端资源均在本地容器内运行。
- **环境预置**：Dockerfile 已包含了 `python3`、`make`、`g++` 等必要的构建组件，确保 D1 数据库模拟器可无缝运行。
- **外部访问**：服务已配置为监听 `0.0.0.0`，支持在云服务器上通过公网 IP 或域名直接访问。
- **自动健康检测**：容器内置健康检查（Healthcheck），你可以通过 `docker ps` 查看容器状态是否为 `(healthy)`。

## 📂 常用管理操作

| 操作 | 命令 |
| :--- | :--- |
| **停止服务** | `docker-compose down` |
| **查看实时日志** | `docker-compose logs -f navtools` |
| **重新构建并启动** | `docker-compose up -d --build` |
| **重启容器** | `docker-compose restart` |

## 📝 运维注意事项

1. **数据持久化**：数据库文件存储在本地的 `./.wrangler` 文件夹中。请勿随意删除该文件夹，除非您想重置所有本地数据。
2. **配置文件**：主要逻辑由 `wrangler.jsonc` 及 `Dockerfile` 驱动。
3. **性能监控**：可以通过 `docker stats` 查看容器的 CPU 和内存占用。

---

> [!TIP]
> 如果您在远程服务器上部署，建议先修改 `wrangler.jsonc` 中的 `vars` 配置（如 `AUTH_PASSWORD` 等），以增强安全性。
