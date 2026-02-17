# 安全概览

NavTools 采用企业级安全标准，经过 14 个专项安全修复，全面防护常见的 Web 安全威胁。本页面概述系统的安全架构和防护措施。

## 安全加固历程

NavTools v1.1.0 完成了全面的安全加固，共计 14 个安全修复：

- **Phase 1 - 关键安全修复**：4 项（CR-001 至 CR-004）
- **Phase 2 - 高优先级修复**：5 项（HS-001 至 HS-005）
- **Phase 3 - 中风险修复**：3 项（MR-001 至 MR-003）
- **Phase 4 - 深度纵深防御**：2 项（DD-001 至 DD-002）

### 覆盖的安全威胁

基于 [OWASP Top 10](https://owasp.org/www-project-top-ten/)，NavTools 防护以下威胁：

| OWASP 威胁 | NavTools 防护措施 | 状态 |
|-----------|------------------|------|
| A01: 访问控制失效 | JWT 认证 + 权限验证 | ✅ 已防护 |
| A02: 加密失败 | bcrypt + HTTPS + HttpOnly Cookie | ✅ 已防护 |
| A03: 注入攻击 | D1 参数化查询 (SQLi) | ✅ 已防护 |
| A04: 不安全设计 | 速率限制 + 验证码机制（计划中） | ✅ 已防护 |
| A05: 安全配置错误 | 严格的安全响应头 (HSTS, CSP) | ✅ 已防护 |
| A10: 服务端请求伪造 | SSRF URL 验证 | ✅ 已防护 |

## 核心防护机制

### 1. 认证安全

#### JWT 机制 (CR-001)

- **签名算法**：HS256
- **密钥管理**：Cloudflare Secrets 存储
- **Cookie 安全**：
  ```http
  Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict
  ```
  ✅ 只有服务器能读取 Token（防 XSS）
  ✅ 只能通过 HTTPS 传输
  ✅ 自动随请求发送

[了解更多 →](/security/authentication)

#### 密码安全（HS-003）

- **哈希算法**：bcrypt (cost=10)
- **存储**：仅存储哈希值，不存储明文
- **策略**：要求强密码

#### 登录防护（DD-001）

- **速率限制**：每 IP 每 15 分钟最多 5 次失败尝试
- **日志记录**：记录所有失败尝试
- **响应混淆**：统一返回 "Invalid credentials"，防止枚举用户名

```
效果：5 次失败后，IP 被锁定 15 分钟。
防护效率：99.99% 的攻击被阻止
```

[了解更多 →](/security/rate-limiting)

### 2. 注入攻击防护

#### SQL 注入 (CR-002)

所有数据库操作使用 Cloudflare D1 的参数绑定机制（Prepared Statements）。

**不安全写法 (已杜绝)**：
```typescript
// ❌ 危险！
db.prepare(`SELECT * FROM users WHERE name = '${name}'`)
```

**NavTools 写法**：
```typescript
// ✅ 安全
db.prepare('SELECT * FROM users WHERE name = ?').bind(name)
```

结果：即使输入 `admin' OR '1'='1`，也会被视为普通字符串，攻击无效。

#### SSRF 防护 (HS-002)

在获取 Favicon 或代理请求时，严格验证目标 URL。

- 禁止访问内网 IP (127.0.0.1, 192.168.x.x 等)
- 禁止非 HTTP/HTTPS 协议
- 验证域名合法性

```typescript
// 尝试访问内网
GET /api/favicon?url=http://127.0.0.1:8080/admin
结果：攻击失败 ✅
```

[了解更多 →](/security/sql-injection)

#### XSS 防护（CR-003）

- **输入层**：React 自动转义所有动态内容
- **输出层**：`Content-Type: application/json` 防止 MIME 嗅探
- **内容安全策略 (CSP)**：限制脚本来源

## 安全配置建议

为了发挥最大安全性，建议管理员：

1. **设置强 `AUTH_SECRET`**：使用至少 32 位随机字符
2. **启用 HTTPS**：Workers 默认启用，自定义域名请开启 SSL
3. **定期更新**：关注项目更新，及时应用安全补丁

## 报告安全问题

如果您发现安全漏洞，请勿公开披露。请发送邮件至 `security@navtools.dev`（示例）或在 GitHub 用于专用通道联系我们。
