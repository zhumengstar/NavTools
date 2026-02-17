# 自定义域名部署

将 NavTools 部署到您自己的域名（如 `nav.yourdomain.com`），可以提升品牌形象，方便用户记忆。

Cloudflare Workers 提供了极其简单的自定义域名绑定功能。

## 前置条件

1. **拥有自己的域名**：您需要购买一个域名（例如 `yourdomain.com`）。
2. **域名已接入 Cloudflare**：
   - 将您的域名 DNS 服务器修改为 Cloudflare 提供的 DNS 服务器。
   - 在 Cloudflare 控制台中可以看到该域名状态为 "Active"。
3. **已完成基础部署**：您的 NavTools 已经成功部署到 `*.workers.dev` 子域名（参考 [快速部署](/deployment/quick-start)）。

## 方法一：通过 Cloudflare 控制台（推荐）

最简单的绑定方式是在 Cloudflare 官方控制台上操作。

### 步骤 1：进入 Workers 设置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 在左侧菜单点击 **Workers & Pages**。
3. 在列表中找到您部署的 NavTools 项目（例如 `navtools`），点击进入。
4. 点击顶部的 **Settings**（设置）标签页。
5. 在左侧子菜单点击 **Domains & Routes**（域名与路由）。

### 步骤 2：添加自定义域名

1. 在 **Custom Domains**（自定义域名）区域，点击 **+ Add Custom Domain**。
2. 输入您想要绑定的完整域名（例如 `nav.example.com`）。
3. 点击 **Add Custom Domain**。

### 步骤 3：等待生效

Cloudflare 会自动为您：
- 在 DNS 记录中添加一条 CNAME 记录。
- 颁发并部署 SSL 证书。

通常这个过程只需要几秒钟到几分钟。当状态显示为 **Active**（绿色）时，表示生效。

### 步骤 4：验证访问

在浏览器中输入您的自定义域名（例如 `https://nav.example.com`），您应该能看到您的 NavTools 导航站。

---

## 方法二：使用 Wrangler CLI

如果您喜欢命令行，也可以通过更改配置文件来实现（需要重新部署）。

### 步骤 1：修改配置文件

编辑项目根目录下的 `wrangler.jsonc` 文件，添加 `routes` 配置：

```jsonc
{
  "name": "navtools",
  // ... 其他配置
  "routes": [
	{
	  "pattern": "nav.yourdomain.com",
	  "custom_domain": true
	}
  ]
}
```

### 步骤 2：重新部署

运行部署命令：

```bash
pnpm deploy
```

Wrangler 会自动检测路由配置，并为您设置自定义域名。

---

## 常见问题

### 1. 域名无法访问/DNS 解析错误

- 检查域名是否已正确接入 Cloudflare DNS。
- 检查 Cloudflare 控制台中的 DNS 记录，确保该域名的代理状态（Proxy status）为 **Proxied**（橙色云朵图标）。Workers 自定义域名必须开启代理。

### 2. SSL 证书错误

- 如果刚绑定，SSL 证书颁发可能需要几分钟。请稍等片刻。
- 检查 Cloudflare SSL/TLS 设置，建议设置为 **Full** 或 **Full (Strict)**。

### 3. 可以绑定多个域名吗？

可以。
- 在控制台可以重复添加操作。
- 在 `wrangler.jsonc` 中，`routes` 是一个数组，支持多个对象：

```jsonc
"routes": [
  { "pattern": "nav.site-a.com", "custom_domain": true },
  { "pattern": "nav.site-b.com", "custom_domain": true }
]
```

### 4. 也是最重要的一点：API 路径问题

使用自定义域名后，API 请求的路径会自动适配。但如果您在前端代码中硬编码了 API 地址（NavTools 默认是相对路径，一般不会有问题），请确保更新。

- NavTools 前端默认使用相对路径 `/api/...`，因此自定义域名通常能直接工作，无需额外配置。

## 高级配置：路由规则（Routes）

如果您想将 NavTools 部署在域名的子路径下（例如 `example.com/nav`），可以使用路由模式：

```jsonc
"routes": [
  {
    "pattern": "example.com/nav/*",
    "zone_name": "example.com"
  }
]
```

*注意：对于单页应用（SPA）如 NavTools，建议使用子域名（如 `nav.example.com`）而不是子路径，以避免静态资源路径问题。*
