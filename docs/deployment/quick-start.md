# 快速部署指南

本指南将帮助你使用 `workers.dev` 子域名快速部署 NavTools。

## 准备工作

在开始之前，请确保你已经准备好：

1.  **Cloudflare 账号**：[注册地址](https://dash.cloudflare.com/sign-up)
2.  **Node.js 环境**：v16.13 或更高版本
3.  **pnpm**：包管理器（推荐）或 npm

## 步骤 1：获取代码

克隆 NavTools 仓库到本地：

```bash
git clone https://github.com/zqq-nuli/Cloudflare-Navihive.git
cd Cloudflare-Navihive
```

安装依赖：

```bash
pnpm install
```

## 步骤 2：登录 Cloudflare

在终端中运行以下命令登录 Cloudflare：

```bash
npx wrangler login
```

浏览器会自动弹出授权页面，点击 "Allow" 即可。

## 步骤 3：创建数据库

NavTools 使用 Cloudflare D1 数据库存储数据。运行以下命令创建数据库：

```bash
npx wrangler d1 create navigation-db
```

命令执行成功后，控制台会输出 `database_id`，格式如下：

```toml
[[d1_databases]]
binding = "DB"
database_name = "navigation-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**请复制这个 `database_id`，下一步会用到。**

## 步骤 4：配置项目

复制 `wrangler.jsonc.example`（如果存在）或直接编辑 `wrangler.jsonc` 文件。

你需要修改以下内容：

1.  **填入 database_id**：将上一步获取的 ID 填入 `wrangler.jsonc` 的 `d1_databases` 部分。
2.  **设置认证信息**：
    *   `AUTH_USERNAME`: 管理员用户名（如 admin）
    *   `AUTH_PASSWORD`: 管理员密码的 bcrypt 哈希值
    *   `AUTH_SECRET`: 用于 JWT 签名的随机字符串（至少 32 位）

### 生成密码哈希

使用项目自带的工具生成密码哈希：

```bash
pnpm hash-password "你的密码"
```

### 生成随机密钥

你可以使用在线工具或以下命令生成一个随机密钥：

```bash
openssl rand -base64 32
```

## 步骤 5：初始化数据库

在部署之前，需要初始化数据库表结构：

```bash
npx wrangler d1 execute navigation-db --file=init_table.sql
```

或者如果你的迁移文件在 `migrations` 目录：

```bash
npx wrangler d1 execute navigation-db --file=migrations/0000_init.sql
```
*(请根据实际文件路径调整)*

## 步骤 6：部署

一切准备就绪，运行部署命令：

```bash
pnpm run deploy
```

部署成功后，控制台会显示你的 Worker URL，通常是 `https://navtools.<你的子域名>.workers.dev`。

此 URL 即为你的导航站地址！

## 下一步

*   [绑定自定义域名](/deployment/custom-domain)
*   [配置访客模式](/guide/faq)
