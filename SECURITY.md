# NavTools 安全配置最佳实践

## 🔒 敏感数据管理

### 环境变量文件结构

```
.
├── .env.example          # 模板文件（可提交到Git）
├── .env.production       # 生产环境变量（不提交）
├── .env.local           # 本地开发环境（不提交）
└── .gitignore           # 确保敏感文件不被提交
```

### 文件说明

#### `.env.example`
- ✅ **可以提交到 Git**
- 包含所有环境变量的模板
- 使用占位符值作为示例
- 供团队成员了解需要的配置项

#### `.env.production`
- ❌ **绝不可提交到 Git**
- 包含真实的生产环境敏感数据
- 仅在部署生产环境时使用
- 每个部署环境应该有独立的文件

#### `.env.local`
- ❌ **绝不可提交到 Git**
- 本地开发专用配置
- 可以覆盖其他环境文件的设置

## 🛡️ 安全原则

### 1. 永远不要提交敏感数据
```bash
# 检查是否有敏感文件被意外提交
git check-ignore -v .env*

# 如果 .env 文件被跟踪，从 Git 中移除（保留本地文件）
git rm --cached .env
git commit -m "Remove .env from version control"
```

### 2. 环境变量优先级
Docker Compose 环境变量优先级（从高到低）：
1. `environment:` 部分（最高优先级）
2. `env_file:` 指定的文件
3. Shell 环境变量
4. `.env` 文件（如果存在）

### 3. 敏感数据类型

#### 必须放入环境变量的值：
- ✅ API 密钥和令牌
- ✅ 数据库凭据
- ✅ JWT 密钥
- ✅ 加密密钥
- ✅ 第三方服务凭据
- ✅ 管理员密码

#### 可以硬编码的值：
- 🟡 非敏感的配置（端口号、超时时间）
- 🟡 公开的应用名称
- 🟡 版本号
- 🟡 非关键的 URL 路径

## 🚀 部署流程

### 开发环境
```bash
# 1. 复制模板文件
cp .env.example .env.local

# 2. 编辑本地配置
vim .env.local

# 3. 启动服务
docker-compose --env-file .env.local up -d
```

### 生产环境
```bash
# 1. 创建生产环境配置
cp .env.example .env.production

# 2. 编辑生产配置（使用真实密钥）
vim .env.production

# 3. 部署到服务器
scp .env.production user@server:/path/to/navtools/
ssh user@server "cd /path/to/navtools && docker-compose --env-file .env.production up -d"
```

### CI/CD 环境
在 GitHub Actions 或其他 CI/CD 平台中：
- 使用平台的 Secrets 功能存储敏感数据
- 在 workflow 文件中通过 `env:` 引用
- 不要在代码中硬编码任何密钥

## 🔍 验证配置

### 检查环境变量是否正确加载
```bash
# 进入容器检查环境变量
docker exec -it navtools env | grep -E "(AI_API_KEY|CLOUDFLARE_DATABASE_ID|ADMIN_PASSWORD)"

# 或者通过应用健康检查
curl http://localhost:8787/api/health
```

### 检查敏感文件安全性
```bash
# 确认 .env 文件未被 Git 跟踪
git status --ignored

# 检查 .gitignore 是否配置正确
git check-ignore .env.production .env.local
```

## 📋 检查清单

部署前确认：
- [ ] `.env.production` 文件已创建并包含真实值
- [ ] `.env*` 文件已加入 `.gitignore`
- [ ] 没有敏感数据提交到 Git 历史
- [ ] API 密钥具有适当的权限范围
- [ ] 数据库 ID 和凭据正确
- [ ] 管理员密码强度足够
- [ ] 生产环境与开发环境使用不同的密钥

## 🆘 应急处理

### 如果敏感数据意外提交到 Git
1. **立即撤销提交**
   ```bash
   git reset --soft HEAD~1  # 撤销最后一次提交，保留更改
   git checkout -- .env*     # 丢弃敏感文件更改
   ```

2. **更换所有泄露的密钥**
   - 立即在相关服务中撤销泄露的 API 密钥
   - 生成新的密钥并更新配置
   - 通知相关团队成员

3. **清理 Git 历史**（如果需要）
   ```bash
   # 使用 BFG Repo-Cleaner 或 git filter-branch
   # 注意：这会重写历史，影响所有协作者
   ```

## 📞 支持联系

如果遇到安全问题或需要帮助：
- 检查项目文档和 README
- 联系 DevOps 团队
- 参考组织的安全政策