# 认证 API

NavTools 使用基于 JWT (JSON Web Token) 的认证机制，确保 API 的安全性。

## 登录

获取访问令牌（Token）。Token 会通过 `HttpOnly Cookie` 自动设置，同时也可能在响应体中返回（用于非浏览器环境）。

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Content-Type**: `application/json`

### 请求参数

| 字段 | 类型 | 必选 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 (如 admin) |
| password | string | 是 | 密码 |
| rememberMe | boolean | 否 | 是否记住登录 (默认 false, 有效期 30 天) |

### 响应示例

**成功 (200 OK)**

```json
{
  "success": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

*注意：`Set-Cookie` 响应头会包含 `auth_token`。*

**失败 (401 Unauthorized)**

```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

## 登出

清除用户的登录状态（删除 Cookie）。

- **URL**: `/api/auth/logout`
- **Method**: `POST`

### 响应示例

**成功 (200 OK)**

```json
{
  "success": true
}
```

*注意：`Set-Cookie` 响应头会清除 `auth_token`。*

---

## 检查认证状态

检查当前用户是否已登录。通常用于前端初始化时判断用户状态。

- **URL**: `/api/check-auth`
- **Method**: `GET`

### 响应示例

**已登录 (200 OK)**

```json
{
  "isAuthenticated": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**未登录 (200 OK)**

```json
{
  "isAuthenticated": false
}
```

### 实现细节

1. **JWT 签名**：服务器使用 `AUTH_SECRET` 环境变量对 Token 进行签名。
2. **过期时间**：
   - 默认：7 天
   - 记住我：30 天
3. **安全防护**：
   - 登录接口实施了速率限制（Rate Limiting），防止暴力破解。
   - Cookie 设置了 `HttpOnly`, `Secure` (HTTPS下), `SameSite=Strict` 属性。
