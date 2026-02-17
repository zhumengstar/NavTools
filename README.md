<div align="center">

<img src="public/favicon.png" width="120" height="120" alt="NavTools Logo">

# NavTools

**现代化个人导航站管理系统**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zhumengstar/NavTools)

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)
![React](https://img.shields.io/badge/React-19-61dafb)

**零成本部署 • 全球 CDN 加速 • 企业级安全**

[🎮 在线演示](https://navtools.chatbot.cab/) • [� 完整文档](https://zhumengstar.github.io/NavTools/) • [💬 问题反馈](https://github.com/zhumengstar/NavTools/issues)

</div>

---

## 🚀 简介

**NavTools** 是一个基于 Cloudflare Workers 构建的现代化导航站。它无需服务器，无需域名（可选），即可为你提供一个高性能、安全且易于管理的个人或团队导航主页。

### ✨ 核心特性

- **零成本**: 基于 Cloudflare 免费套餐，永久免费。
- **高性能**: 全球边缘部署，秒开体验。
- **高安全**: 内置 JWT 认证、防暴力破解、XSS/SQL 注入防护。
- **现代化**: Material UI 7 + Tailwind CSS 4 设计，支持深色模式。
- **易管理**: 支持拖拽排序、分组管理、访客模式（公开/私有分离）。

---

## 🛠️ 快速部署

我们强烈推荐使用 **Cloudflare Workers** 进行一键部署，只需 5 分钟。

### 方式一：一键部署（推荐）

1. 点击上方的 **Deploy to Cloudflare Workers** 按钮。
2. 按照引导完成 Fork 和部署流程。
3. 部署完成后，在 Cloudflare 后台绑定 D1 数据库。

### 方式二：手动部署

```bash
# 1. 克隆项目
git clone https://github.com/zhumengstar/NavTools.git
cd NavTools

# 2. 安装依赖
pnpm install

# 3. 创建数据库
npx wrangler d1 create navigation-db

# 4. 配置 wrangler.jsonc (填入 database_id 和认证信息)
cp wrangler.template.jsonc wrangler.jsonc

# 5. 初始化数据库表结构
npx wrangler d1 execute navigation-db --file=init_table.sql

# 6. 部署
pnpm run deploy
```

> 详细教程请参阅 [部署指南](https://zhumengstar.github.io/NavTools/deployment/)。

---

## 📚 文档资源

- [**用户指南**](https://zhumengstar.github.io/NavTools/introduction): 了解如何使用 NavTools。
- [**部署文档**](https://zhumengstar.github.io/NavTools/deployment/): 详细的安装和配置说明。
- [**常见问题**](https://zhumengstar.github.io/NavTools/guide/faq): 遇到问题先看这里。
- [**API 文档**](https://zhumengstar.github.io/NavTools/api/): 开发者参考手册。

---

## 🧩 技术栈

- **前端**: React 19, Material UI 7, Tailwind CSS 4, Vite 6, DND Kit
- **后端**: Cloudflare Workers, Hono (Like), TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **工具链**: Biome/ESLint, Prettier, Wrangler

---

**NavTools** © 2026 [zhumengstar](https://github.com/zhumengstar). Released under the MIT License.

</div>
