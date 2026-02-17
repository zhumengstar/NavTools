# API 文档

NavTools 提供了一套 RESTful API 接口，用于管理导航站的数据。

## API 端点

所有 API 均位于 `/api` 路径下。

### 基础接口

- `GET /api/check-auth`: 检查当前登录状态
- `GET /api/config`: 获取全局配置（公开）
- `GET /api/data`: 获取所有导航数据（分组和站点）

### 认证接口

- `POST /api/auth/login`: 用户登录
- `POST /api/auth/logout`: 用户登出

### 分组管理

- `POST /api/groups`: 创建分组
- `PUT /api/groups/:id`: 更新分组
- `DELETE /api/groups/:id`: 删除分组
- `POST /api/groups/sort`: 更新分组排序

### 站点管理

- `POST /api/sites`: 创建站点
- `PUT /api/sites/:id`: 更新站点
- `DELETE /api/sites/:id`: 删除站点
- `POST /api/sites/sort`: 更新站点排序

## 认证方式

需要认证的接口需要在请求头中携带 Cookie（由浏览器自动处理）或 Bearer Token（部分场景）。

大多数写操作（POST, PUT, DELETE）都需要管理员权限。

### 响应格式

API 统一使用 JSON 格式返回：

```json
{
  "success": true,
  "data": { ... },
  "error": "错误信息（如果 success 为 false）"
}
```

## 错误代码

- `401 Unauthorized`: 未登录或 Token 过期
- `403 Forbidden`: 权限不足
- `400 Bad Request`: 请求参数错误
- `500 Internal Server Error`: 服务器内部错误
