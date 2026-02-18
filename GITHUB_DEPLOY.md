# GitHub Actions 部署指南

本项目建议通过 GitHub Actions 实现自动化部署（CI/CD），在每次推送到 `main` 分支时自动构建并发布到 Cloudflare Workers。

## 1. 准备工作

在开始之前，您需要获取 Cloudflare 的 API Token：

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 进入 **My Profile > API Tokens**。
3. 点击 **Create Token**。
4. 使用 **Edit Cloudflare Workers** 模板。
5. 确保权限包含：
   - Account | Workers Scripts | Edit
   - Account | Workers Tail | Read
   - Account | Cloudflare Pages | Edit (如果使用了 Pages)
   - User | User Details | Read
6. 复制生成的 API Token。

## 2. 配置 GitHub Secrets

为了安全地进行部署，您需要将 API Token 添加到 GitHub 仓库的 Secrets 中：

1. 进入您的 GitHub 仓库设置 (**Settings**)。
2. 在左侧菜单点击 **Secrets and variables > Actions**。
3. 点击 **New repository secret**。
4. 添加以下密钥：
   - 名称：`CLOUDFLARE_API_TOKEN`
   - 值：您的 Cloudflare API Token。

## 3. 部署工作流配置

在项目根目录下创建 `.github/workflows/deploy.yml` 文件：

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 10
          
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and Deploy
        run: pnpm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 4. 自动化流程说明

- **代码检测**：每次推送都会自动运行 `pnpm install`。
- **构建**：运行 `pnpm run build` 生成生产环境静态资源。
- **发布**：使用 `wrangler deploy` 将 Worker 和静态资源发布到您的 Cloudflare 账户。

## 5. D1 数据库迁移 (可选)

如果您的项目中包含 D1 数据库变更，您可以在工作流中添加迁移步骤：

```yaml
      - name: Apply D1 Migrations
        run: pnpm exec wrangler d1 migrations apply mynav --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```
*注：请将 `mynav` 替换为您在 `wrangler.jsonc` 中定义的数据库名称。*
