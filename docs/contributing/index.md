# 贡献指南

感谢您对 NavTools 的关注！我们欢迎各种形式的贡献，无论是代码、文档、设计还是反馈。本指南将帮助您了解如何参与项目贡献。

## 贡献方式

### 报告 Bug

如果您在使用中发现问题，请在 GitHub Issues 中提交 Bug 报告。

**提交 Bug 时**，请包含：
- **标题**：简短描述问题（如："登录后页面空白"）
- **环境信息**：
  - NavTools 版本
  - Node.js 和 pnpm 版本
  - 浏览器和版本
  - 操作系统
- **复现步骤**：详细的操作步骤，帮助我们重现问题
- **预期行为**：应该发生什么
- **实际行为**：实际发生了什么
- **错误日志**：控制台报错或 Worker 日志

### 提交代码 (Pull Request)

如果您想修复 Bug 或添加新功能，欢迎提交 PR。

**开发流程**：

1. **Fork 仓库**：将项目 Fork 到您的 GitHub 账号
2. **克隆代码**：`git clone ...`
3. **创建分支**：`git checkout -b feature/your-feature-name`
4. **进行开发**：编写代码
5. **本地测试**：确保功能正常，无报错
6. **提交代码**：`git commit -m "feat: add new feature"`（请遵循 Commit 规范）
7. **推送到远程**：`git push origin feature/your-feature-name`
8. **提交 PR**：在 GitHub 上创建 Pull Request

### 改进文档

文档和代码一样重要。如果您发现文档有错误或可以改进的地方，欢迎直接修改 `docs/` 目录下的 Markdown 文件并提交 PR。

## 本地开发指南

### 环境准备

- Node.js >= 16.13
- pnpm >= 8.0

### 启动开发环境

```bash
# 1. 安装依赖
pnpm install

# 2. 启动前端和后端（Mock 模式）
pnpm dev
# 访问 http://localhost:5173
```

### 使用真实数据库开发

如果需要连接本地 D1 数据库：

1. 创建 `.env` 文件：
   ```env
   VITE_USE_REAL_API=true
   ```

2. 初始化本地数据库：
   ```bash
   wrangler d1 execute navigation-db --local --file=init_table.sql
   ```

3. 启动：
   ```bash
   pnpm dev
   ```

## 代码规范

### TypeScript

- 我们使用严格的 TypeScript 配置 (`strict: true`)。
- 请为变量和函数提供清晰的类型定义。
- 避免使用 `any`，尽量使用具体的类型或泛型。

### 样式 (Tailwind CSS)

- 优先使用 Tailwind CSS 类名。
- 避免在 JS 中写行内样式。
- 遵循 Material UI 的设计规范。

### Commit 规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档变更
- `style`: 代码格式调整（不影响逻辑）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

**示例**：
```
feat: add guest mode toggle in settings
fix: login button alignment on mobile
docs: update deployment guide
```

## 贡献者协议

参与本项目即表示您同意遵守项目的行为准则（Code of Conduct）。请保持友善、尊重他人。

感谢您的贡献！
