import {
    NavigationAPI,
    type LoginRequest,
    type RegisterRequest,
    type ResetPasswordRequest,
    type SendCodeRequest,
    type ExportData,
    type Group,
    type Site,
} from "../src/API/http";

/**
 * 简单的内存速率限制器
 * 注意: 这是基于单个 Worker 实例的内存限制
 * 生产环境建议使用 Cloudflare KV 实现跨实例的速率限制
 */



/**
 * 只读路由白名单 - 这些路由在 AUTH_REQUIRED_FOR_READ=false 时无需认证
 */
const READ_ONLY_ROUTES = [
    { method: 'GET', path: '/api/groups' },
    { method: 'GET', path: '/api/sites' },
    { method: 'GET', path: '/api/configs' },
    { method: 'GET', path: '/api/groups-with-sites' },
] as const;

// 记录数据库初始化状态的倾向性尝试（不存储 Promise，避免跨请求 I/O 污染）
let hasAttemptedInit = false;

/**
 * 生成唯一错误 ID
 */
function generateErrorId(): string {
    return crypto.randomUUID();
}

/**
 * 结构化日志
 */
interface LogData {
    timestamp?: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    errorId?: string;
    path?: string;
    method?: string;
    details?: unknown;
}

function log(data: LogData): void {
    console.log(JSON.stringify({
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
    }));
}

/**
 * 创建错误响应
 */
function createErrorResponse(
    error: unknown,
    request: Request,
    context?: string
): Response {
    const errorId = generateErrorId();
    const url = new URL(request.url);

    // 记录详细错误日志
    log({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error instanceof Error ? error.message : '未知错误',
        errorId,
        path: url.pathname,
        method: request.method,
        details: error instanceof Error ? {
            name: error.name,
            stack: error.stack,
        } : error,
    });

    // 返回用户友好的错误信息
    return createJsonResponse(
        {
            success: false,
            message: context ? `${context}失败` : '处理请求时发生错误',
            errorId,
        },
        request,
        { status: 500 }
    );
}

// 请求体大小限制配置
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * 验证请求体大小并解析 JSON
 */
async function validateRequestBody(request: Request): Promise<unknown> {
    const contentLength = request.headers.get('Content-Length');

    // 检查 Content-Length 头
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        throw new Error('请求体过大，最大允许 1MB');
    }

    // 读取并验证实际大小
    // 使用 clone() 以便原始请求仍可被其他逻辑（如果需要）读取
    const clonedRequest = request.clone();
    const bodyText = await clonedRequest.text();

    if (bodyText.length > MAX_BODY_SIZE) {
        throw new Error('请求体过大，最大允许 1MB');
    }

    try {
        return JSON.parse(bodyText);
    } catch {
        throw new Error('无效的 JSON 格式');
    }
}

/**
 * 深度验证导出数据
 */
function validateExportData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        errors.push('数据必须是对象');
        return { valid: false, errors };
    }

    const d = data as Record<string, unknown>;

    // 验证 version (可选字段，允许缺失)
    if (d.version !== undefined && typeof d.version !== 'string') {
        errors.push('version 必须是字符串');
    }

    // 验证 exportDate (可选字段，允许缺失)
    if (d.exportDate !== undefined && typeof d.exportDate !== 'string') {
        errors.push('exportDate 必须是字符串');
    }

    // 验证 groups
    if (!Array.isArray(d.groups)) {
        errors.push('groups 必须是数组');
    } else {
        d.groups.forEach((group: unknown, index: number) => {
            if (!group || typeof group !== 'object') {
                errors.push(`groups[${index}]: 必须是对象`);
                return;
            }
            const g = group as Record<string, unknown>;
            if (!g.name || typeof g.name !== 'string') {
                errors.push(`groups[${index}]: name 必须是字符串`);
            }
            if (typeof g.order_num !== 'number') {
                errors.push(`groups[${index}]: order_num 必须是数字`);
            }
        });
    }

    // 验证 sites
    if (!Array.isArray(d.sites)) {
        errors.push('sites 必须是数组');
    } else {
        d.sites.forEach((site: unknown, index: number) => {
            if (!site || typeof site !== 'object') {
                errors.push(`sites[${index}]: 必须是对象`);
                return;
            }
            const s = site as Record<string, unknown>;
            if (!s.name || typeof s.name !== 'string') {
                errors.push(`sites[${index}]: name 必须是字符串`);
            }
            if (!s.url || typeof s.url !== 'string') {
                errors.push(`sites[${index}]: url 必须是字符串`);
            } else {
                try {
                    new URL(s.url);
                } catch {
                    errors.push(`sites[${index}]: url 格式无效`);
                }
            }
            if (typeof s.group_id !== 'number') {
                errors.push(`sites[${index}]: group_id 必须是数字`);
            }
            if (typeof s.order_num !== 'number') {
                errors.push(`sites[${index}]: order_num 必须是数字`);
            }
        });
    }

    // 验证 configs (可选字段，允许缺失但如果存在必须是对象)
    if (d.configs !== undefined && (typeof d.configs !== 'object' || d.configs === null)) {
        errors.push('configs 必须是对象');
    }

    return { valid: errors.length === 0, errors };
}

// CORS 配置
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:8788',
    // 生产环境会自动允许同源
];

/**
 * 获取 CORS 头
 */
function getCorsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('Origin');
    const requestUrl = new URL(request.url);

    // 如果是同源请求，允许
    let allowedOrigin: string | null = null;

    if (origin) {
        // 检查是否在允许列表中，或者是 workers.dev 子域名
        const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
            origin.endsWith('.workers.dev') ||
            origin === requestUrl.origin; // 同源

        allowedOrigin = isAllowed ? origin : null;
    }

    // 如果没有匹配的 origin，使用第一个允许的 origin 或请求源作为默认值
    // 绝不使用通配符 '*'，以增强安全性
    const finalOrigin = allowedOrigin || ALLOWED_ORIGINS[0] || requestUrl.origin;

    return {
        'Access-Control-Allow-Origin': finalOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * 创建带 CORS 头的 JSON 响应
 */
function createJsonResponse(
    data: unknown,
    request: Request,
    options: ResponseInit = {}
): Response {
    const corsHeaders = getCorsHeaders(request);
    const headers = new Headers(options.headers);

    // 合并 CORS 头
    for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
    }

    return Response.json(data, {
        ...options,
        headers
    });
}

/**
 * 创建带 CORS 头的普通响应
 */
function createResponse(
    body: string | null,
    request: Request,
    options: ResponseInit = {}
): Response {
    const corsHeaders = getCorsHeaders(request);
    const headers = new Headers(options.headers);

    // 合并 CORS 头
    for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
    }

    return new Response(body, {
        ...options,
        headers
    });
}

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);
        console.log(`[Worker Entry] ${request.method} ${url.pathname}`);

        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: getCorsHeaders(request),
            });
        }

        try {
            // API路由处理
            if (url.pathname.startsWith("/api/")) {
                const path = url.pathname.replace("/api/", "");
                const method = request.method;

                try {
                    const api = new NavigationAPI(env);

                    // 每次请求都确保数据库状态正确。
                    // 依靠 NavigationAPI.initDB() 内部的“快速路径” (fast-path) 来保持高性能。
                    // 移除全局 initPromise 存储，因为它会导致 Miniflare 报 "Cannot perform I/O on behalf of a different request" 错误。
                    if (path !== 'init' && !hasAttemptedInit) {
                        try {
                            const res = await api.initDB();
                            if (res.success) {
                                hasAttemptedInit = true;
                            }
                        } catch (e) {
                            console.error('[Worker] Init check failed:', e);
                        }
                    }

                    // 登录路由 - 不需要验证
                    if (path === "login" && method === "POST") {
                        try {


                            const loginData = (await validateRequestBody(request)) as LoginInput;

                            // 验证登录数据
                            const validation = validateLogin(loginData);
                            if (!validation.valid) {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: `验证失败: ${validation.errors?.join(", ")}`,
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }

                            const result = await api.login(loginData as LoginRequest);

                            // 如果登录成功，设置 HttpOnly Cookie
                            if (result.success && result.token) {
                                const maxAge = loginData.rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
                                const url = new URL(request.url);
                                const isSecure = url.protocol === 'https:';

                                const cookieParts = [
                                    `auth_token=${result.token}`,
                                    'HttpOnly',
                                    'SameSite=Lax',
                                    `Max-Age=${maxAge}`,
                                    'Path=/',
                                ];

                                if (isSecure) {
                                    cookieParts.push('Secure');
                                }

                                return createJsonResponse(
                                    { success: true, message: result.message },
                                    request,
                                    {
                                        headers: {
                                            'Set-Cookie': cookieParts.join('; '),
                                        },
                                    }
                                );
                            }

                            return createJsonResponse(result, request);
                        } catch (error) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: error instanceof Error ? error.message : '请求无效',
                                },
                                request,
                                { status: 400 }
                            );
                        }
                    }

                    // 登出路由
                    if (path === "logout" && method === "POST") {
                        return createJsonResponse(
                            { success: true, message: '登出成功' },
                            request,
                            {
                                headers: {
                                    'Set-Cookie': [
                                        'auth_token=',
                                        'HttpOnly',
                                        'Secure',
                                        'SameSite=Lax',
                                        'Max-Age=0',
                                        'Path=/',
                                    ].join('; '),
                                },
                            }
                        );
                    }

                    // 注册路由 - 不需要验证，开放注册
                    if (path === "register" && method === "POST") {
                        try {


                            const registerData = (await validateRequestBody(request)) as RegisterInput;
                            console.log('[DEBUG] Worker received register data:', JSON.stringify(registerData));

                            const validation = validateRegister(registerData);
                            if (!validation.valid) {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: `验证失败: ${validation.errors?.join(", ")}`,
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }

                            const result = await api.register(registerData as RegisterRequest);
                            return createJsonResponse(result, request, {
                                status: result.success ? 200 : 400,
                            });
                        } catch (error) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: error instanceof Error ? error.message : '请求无效',
                                },
                                request,
                                { status: 400 }
                            );
                        }
                    }

                    // 密码重置路由 - 不需要验证，任何人可遍以重置
                    if (path === "reset-password" && method === "POST") {
                        try {
                            const resetData = (await validateRequestBody(request)) as ResetPasswordRequest;

                            // 验证校验由 NavigationAPI 处理
                            const result = await api.resetPassword(resetData, env);
                            return createJsonResponse(result, request, {
                                status: result.success ? 200 : 400,
                            });
                        } catch (error) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: error instanceof Error ? error.message : '请求无效',
                                },
                                request,
                                { status: 400 }
                            );
                        }
                    }

                    // 发送验证码路由
                    if (path === "auth/send-code" && method === "POST") {
                        try {
                            const sendCodeData = (await validateRequestBody(request)) as SendCodeRequest;
                            const result = await api.sendResetCode(sendCodeData, env);
                            return createJsonResponse(result, request, {
                                status: result.success ? 200 : 400,
                            });
                        } catch (error) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: error instanceof Error ? error.message : '请求无效',
                                },
                                request,
                                { status: 400 }
                            );
                        }
                    }

                    // 获取用户邮箱路由 (用于重置密码)
                    if (path === "auth/email" && method === "GET") {
                        try {
                            const url = new URL(request.url);
                            const username = url.searchParams.get("username");

                            if (!username) {
                                return createJsonResponse(
                                    { success: false, message: '用户名不能为空' },
                                    request,
                                    { status: 400 }
                                );
                            }

                            const email = await api.getUserEmail(username);
                            return createJsonResponse({ email }, request);
                        } catch (error) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: error instanceof Error ? error.message : '获取邮箱失败',
                                },
                                request,
                                { status: 500 }
                            );
                        }
                    }

                    // 认证状态检查端点 - 检查当前用户是否已认证
                    if (path === "auth/status" && method === "GET") {
                        // 检查 Cookie 中的 token
                        const cookieHeader = request.headers.get("Cookie");
                        let token: string | null = null;

                        if (cookieHeader) {
                            const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                                const parts = cookie.trim().split('=');
                                const key = parts[0];
                                const value = parts.slice(1).join('=');
                                if (key) {
                                    acc[key] = value || '';
                                }
                                return acc;
                            }, {} as Record<string, string>);

                            token = cookies['auth_token'] || null;
                        }

                        // 验证 token
                        if (token && api.isAuthEnabled()) {
                            try {
                                const result = await api.verifyToken(token);
                                return createJsonResponse(
                                    { authenticated: result.valid },
                                    request
                                );
                            } catch {
                                return createJsonResponse(
                                    { authenticated: false },
                                    request
                                );
                            }
                        }

                        // 没有 token 或认证未启用
                        return createJsonResponse(
                            { authenticated: false },
                            request
                        );
                    }

                    // 获取当前用户信息
                    if (path === "user/profile" && method === "GET") {
                        // 在此处，我们需要确保请求已经通过了验证
                        // 但是因为这个 if 块在验证中间件之前，我们需要特殊处理
                        // 或者移动到验证中间件之后。
                        // 鉴于目前逻辑，我将其移动到验证中间件之后更好的位置。
                    }

                    // 初始化数据库接口 - 不需要验证
                    if (path === "init" && method === "GET") {
                        const initResult = await api.initDB();
                        if (initResult.alreadyInitialized) {
                            return createResponse("数据库已经初始化过，无需重复初始化", request, { status: 200 });
                        }
                        return createResponse("数据库初始化成功", request, { status: 200 });
                    }



                    // 验证中间件 - 条件认证
                    let isAuthenticated = false; // 记录认证状态
                    let currentUserId: number | undefined;

                    if (api.isAuthEnabled()) {
                        const requestPath = `/api/${path}`;

                        // 检查是否为只读路由且免认证已启用
                        const isReadOnlyRoute = READ_ONLY_ROUTES.some(
                            (route) => route.method === method && route.path === requestPath
                        );

                        // 访客模式的随机推荐接口始终公开
                        const isPublicRoute = path === "sites/random" && method === "GET";

                        const shouldRequireAuth = !isPublicRoute && (!isReadOnlyRoute || env.AUTH_REQUIRED_FOR_READ === 'true');

                        // 总是检查 token（如果存在）
                        const cookieHeader = request.headers.get("Cookie");
                        let token: string | null = null;

                        if (cookieHeader) {
                            const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                                const parts = cookie.trim().split('=');
                                const key = parts[0];
                                const value = parts.slice(1).join('=');
                                if (key) {
                                    acc[key] = value || '';
                                }
                                return acc;
                            }, {} as Record<string, string>);

                            token = cookies['auth_token'] || null;
                        }

                        // 如果 Cookie 中没有，尝试从 Authorization 头读取（向后兼容）
                        if (!token) {
                            const authHeader = request.headers.get("Authorization");
                            if (authHeader) {
                                const [authType, headerToken] = authHeader.split(" ");
                                if (authType === "Bearer" && headerToken) {
                                    token = headerToken;
                                }
                            }
                        }

                        // 如果有 token，验证它
                        if (token) {
                            try {
                                const verifyResult = await api.verifyToken(token);
                                if (verifyResult.valid) {
                                    isAuthenticated = true; // 认证成功
                                    currentUserId = verifyResult.payload?.id as number;
                                    log({
                                        timestamp: new Date().toISOString(),
                                        level: 'info',
                                        message: `已认证用户访问: ${method} ${requestPath} (User ID: ${currentUserId})`,
                                    });
                                }
                            } catch (error) {
                                // Token 验证失败，保持 isAuthenticated = false
                                log({
                                    timestamp: new Date().toISOString(),
                                    level: 'warn',
                                    message: `Token 验证失败: ${method} ${requestPath}`,
                                    details: error,
                                });
                            }
                        }

                        // 如果需要强制认证但未认证，返回 401
                        if (shouldRequireAuth && !isAuthenticated) {
                            return createResponse("请先登录", request, {
                                status: 401,
                                headers: {
                                    "WWW-Authenticate": "Bearer",
                                },
                            });
                        }

                        // 记录访客访问（只读路由且未认证）
                        if (isReadOnlyRoute && !isAuthenticated) {
                            log({
                                timestamp: new Date().toISOString(),
                                level: 'info',
                                message: `访客模式访问: ${method} ${requestPath}`,
                            });
                        }
                    }

                    // 路由匹配
                    // GET /api/user/profile 获取当前用户信息
                    if (path === "user/profile" && method === "GET") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }
                        try {
                            const profile = await api.getUserProfile(currentUserId);
                            return createJsonResponse(profile, request);
                        } catch (error) {
                            return createJsonResponse(
                                { success: false, message: "获取用户信息失败" },
                                request,
                                { status: 500 }
                            );
                        }
                    }
                    // 批量获取书签图标
                    else if (path === "utils/batch-update-icons" && method === "POST") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }
                        try {
                            const result = await api.batchUpdateIcons();
                            return createJsonResponse(result, request);
                        } catch (error) {
                            return createJsonResponse(
                                { success: false, message: "批量更新图标失败" },
                                request,
                                { status: 500 }
                            );
                        }
                    }
                    // 批量同步站点补全信息
                    else if (path === "sites/batch-sync-info" && method === "PUT") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }
                        try {
                            const { updates } = (await validateRequestBody(request)) as { updates: { id: number; data: Partial<Site> }[] };
                            const success = await api.batchSyncSiteInfo(currentUserId, updates);
                            return createJsonResponse({ success }, request);
                        } catch (error) {
                            return createJsonResponse(
                                { success: false, message: "批量同步站点信息失败" },
                                request,
                                { status: 500 }
                            );
                        }
                    }
                    else if (path === "user/profile" && method === "PUT") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }
                        try {
                            const data = (await validateRequestBody(request)) as { email?: string };
                            if (data.email) {
                                // 验证邮箱格式
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                                    return createJsonResponse(
                                        { success: false, message: "邮箱格式不符合规范" },
                                        request,
                                        { status: 400 }
                                    );
                                }
                            }
                            const result = await api.updateUserProfile({ userId: currentUserId, ...data });
                            return createJsonResponse(result, request);
                        } catch (error) {
                            return createJsonResponse(
                                { success: false, message: "更新用户信息失败" },
                                request,
                                { status: 500 }
                            );
                        }
                    }

                    // GET /api/groups-with-sites 获取所有分组及其站点 (优化 N+1 查询)
                    if (path === "groups-with-sites" && method === "GET") {
                        // 如果已登录，获取该用户的分组；否则获取所有（后续过滤）
                        const groupsWithSites = await api.getGroupsWithSites(currentUserId);

                        // 根据认证状态过滤数据
                        if (!isAuthenticated) {
                            // 未认证用户只能看到公开分组下的公开站点
                            // 也可以选择返回空，或者只返回"官方/推荐"分组
                            // 这里我们过滤出所有公开的内容
                            const filteredGroups = groupsWithSites
                                .filter(group => group.is_public === 1)
                                .map(group => ({
                                    ...group,
                                    sites: group.sites.filter(site => site.is_public === 1)
                                }));
                            return createJsonResponse(filteredGroups, request);
                        }

                        return createJsonResponse(groupsWithSites, request);
                    }
                    // GET /api/sites/random 随机获取站点（访客模式）
                    else if (path === "sites/random" && method === "GET") {
                        const url = new URL(request.url);
                        const limit = parseInt(url.searchParams.get('limit') || '20');
                        // 限制最大数量
                        const safeLimit = Math.min(Math.max(limit, 1), 50);

                        try {
                            const sites = await api.getRandomSites(safeLimit);
                            return createJsonResponse(sites, request);
                        } catch (error) {
                            return createJsonResponse(
                                { error: "获取随机站点失败" },
                                request,
                                { status: 500 }
                            );
                        }
                    }
                    // GET /api/groups 获取所有分组
                    else if (path === "groups" && method === "GET") {
                        // 根据认证状态过滤查询
                        let query = 'SELECT * FROM groups';
                        const params: number[] = [];
                        const conditions: string[] = [];

                        // 默认排除已删除的分组
                        conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');

                        if (!isAuthenticated) {
                            // 未认证用户只能看到公开分组
                            conditions.push('is_public = ?');
                            params.push(1);
                        }

                        if (conditions.length > 0) {
                            query += ' WHERE ' + conditions.join(' AND ');
                        }

                        query += ' ORDER BY order_num ASC';

                        const result = await env.DB.prepare(query).bind(...params).all();
                        return createJsonResponse(result.results || [], request);
                    } else if (path === "groups/trash" && method === "GET") {
                        const result = await api.getTrashGroups(currentUserId);
                        return createJsonResponse(result, request);
                    } else if (path.startsWith("groups/") && method === "GET") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const group = await api.getGroup(id);
                        return createJsonResponse(group, request);
                    } else if (path === "groups" && method === "POST") {
                        const data = (await validateRequestBody(request)) as GroupInput;

                        // 验证分组数据
                        const validation = validateGroup(data);
                        if (!validation.valid) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: `验证失败: ${validation.errors?.join(", ")}`,
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.createGroup(validation.sanitizedData as Group, currentUserId);
                        return createJsonResponse(result, request);
                    } else if (path.startsWith("groups/") && method === "PUT") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const data = (await validateRequestBody(request)) as Partial<Group>;
                        // 对修改的字段进行验证
                        if (
                            data.name !== undefined &&
                            (typeof data.name !== "string" || data.name.trim() === "")
                        ) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: "分组名称不能为空且必须是字符串",
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        if (data.order_num !== undefined && typeof data.order_num !== "number") {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: "排序号必须是数字",
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.updateGroup(id, data);
                        return createJsonResponse(result, request);
                    } else if (path.startsWith("groups/") && method === "DELETE") {
                        // DELETE /groups/:id 现在执行软删除
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.softDeleteGroup(id);
                        return createJsonResponse({ success: result }, request);

                    } else if (path.startsWith("groups/") && path.endsWith("/restore") && method === "POST") {
                        // POST /groups/:id/restore 恢复分组
                        const parts = path.split("/");
                        // /groups/123/restore
                        if (parts.length < 3) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const idStr = parts[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.restoreGroup(id);
                        if (!result) {
                            return createJsonResponse({ error: "恢复失败或分组不存在" }, request, { status: 404 });
                        }
                        return createJsonResponse(result, request);

                    } else if (path.startsWith("groups/") && path.endsWith("/permanent") && method === "DELETE") {
                        // DELETE /groups/:id/permanent 彻底删除
                        const parts = path.split("/");
                        if (parts.length < 3) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const idStr = parts[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.deleteGroupPermanently(id);
                        return createJsonResponse({ success: result }, request);
                    } else if (path === "groups/trash" && method === "GET") {
                        // GET /groups/trash 获取回收站分组
                        const groups = await api.getTrashGroups(currentUserId);
                        return createJsonResponse(groups, request);
                    }
                    // 站点相关API
                    else if (path === "sites" && method === "GET") {
                        // 根据认证状态过滤查询
                        let query = `
                        SELECT s.*
                        FROM sites s
                        INNER JOIN groups g ON s.group_id = g.id
                    `;

                        const groupId = url.searchParams.get("groupId");
                        const conditions: string[] = [];
                        const params: (string | number)[] = [];

                        // 添加 groupId 过滤条件
                        if (groupId) {
                            conditions.push(`s.group_id = ?`);
                            params.push(parseInt(groupId));
                        }

                        // 未认证用户只能看到公开分组下的公开网站
                        if (!isAuthenticated) {
                            conditions.push('g.is_public = ?');
                            params.push(1);
                            conditions.push('s.is_public = ?');
                            params.push(1);
                        }

                        if (conditions.length > 0) {
                            query += ' WHERE ' + conditions.join(' AND ') + ' AND (s.is_deleted = 0 OR s.is_deleted IS NULL)';
                        } else {
                            query += ' WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)';
                        }

                        query += ' ORDER BY s.group_id ASC, s.order_num ASC';

                        const result = await env.DB.prepare(query).bind(...params).all();
                        return createJsonResponse(result.results || [], request);
                    } else if (path === "auth/login" && method === "POST") {
                        const data = (await validateRequestBody(request)) as LoginRequest;
                        const result = await api.login(data);

                        // 如果登录成功，设置 HttpOnly Cookie
                        if (result.success && result.token) {
                            const response = createJsonResponse(result, request);
                            // 计算过期时间
                            const maxAge = data.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

                            response.headers.append(
                                "Set-Cookie",
                                `auth_token=${result.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
                            );
                            return response;
                        }

                        return createJsonResponse(result, request);
                    } else if (path === "init" && method === "GET") {
                        // 初始化数据库及迁移
                        await api.initDB();
                        return createJsonResponse({ success: true, message: "数据库初始化/迁移完成" }, request);
                    } else if (path === "auth/register" && method === "POST") {
                        const data = (await validateRequestBody(request)) as RegisterRequest;

                        // 验证注册数据
                        if (!data.username || !data.password || !data.email) {
                            return createJsonResponse(
                                { success: false, message: "用户名、密码和邮箱不能为空" },
                                request,
                                { status: 400 }
                            );
                        }

                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                            return createJsonResponse(
                                { success: false, message: "邮箱格式不正确" },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.register(data);
                        return createJsonResponse(result, request);
                    } else if (path === "auth/email" && method === "GET") {
                        // 获取用户邮箱（用于密码重置回显）
                        const username = url.searchParams.get("username");
                        if (!username) {
                            return createJsonResponse({ error: "用户名不能为空" }, request, { status: 400 });
                        }

                        const email = await api.getUserEmail(username);
                        if (!email) {
                            return createJsonResponse({ success: false, message: "用户不存在或未绑定邮箱" }, request);
                        }

                        return createJsonResponse({ success: true, email }, request);
                    } else if (path === "sites/trash" && method === "GET") {
                        const sites = await api.getTrashSites(currentUserId);
                        return createJsonResponse(sites, request);
                    } else if (path.startsWith("sites/") && method === "GET") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const site = await api.getSite(id);
                        return createJsonResponse(site, request);
                    } else if (path === "sites" && method === "POST") {
                        const data = (await validateRequestBody(request)) as SiteInput;

                        // 验证站点数据
                        const validation = validateSite(data);
                        if (!validation.valid) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: `验证失败: ${validation.errors?.join(", ")}`,
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.createSite(validation.sanitizedData as Site);
                        return createJsonResponse(result, request);
                    } else if (path.startsWith("sites/") && method === "PUT" && path !== "sites/batch") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const data = (await validateRequestBody(request)) as Partial<Site>;

                        // 验证更新的站点数据
                        if (data.url !== undefined) {
                            let url = data.url.trim();
                            // 如果没有协议,自动添加 https://
                            if (!/^https?:\/\//i.test(url)) {
                                url = 'https://' + url;
                            }
                            try {
                                new URL(url);
                                data.url = url; // 使用修正后的URL
                            } catch {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: "无效的URL格式",
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }
                        }

                        if (data.icon !== undefined && data.icon !== "") {
                            let iconUrl = data.icon.trim();
                            // 如果没有协议,自动添加 https://
                            if (!/^https?:\/\//i.test(iconUrl) && !/^data:/i.test(iconUrl)) {
                                iconUrl = 'https://' + iconUrl;
                            }
                            try {
                                new URL(iconUrl);
                                data.icon = iconUrl; // 使用修正后的URL
                            } catch {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: "无效的图标URL格式",
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }
                        }

                        const result = await api.updateSite(id, data);
                        return createJsonResponse(result, request);
                    } else if (path.startsWith("sites/") && path.endsWith("/click") && method === "POST") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.clickSite(id);
                        return createJsonResponse({ success: result }, request);
                    } else if (path.startsWith("sites/") && method === "DELETE") {
                        const idStr = path.split("/")[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.softDeleteSite(id);
                        return createJsonResponse({ success: result }, request);

                    } else if (path.startsWith("sites/") && path.endsWith("/restore") && method === "POST") {
                        // Extract ID from /sites/123/restore
                        const parts = path.split("/");
                        if (parts.length < 3) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const idStr = parts[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.restoreSite(id);
                        if (!result) {
                            return createJsonResponse({ error: "恢复失败或站点不存在" }, request, { status: 404 });
                        }
                        return createJsonResponse(result, request);

                    } else if (path.startsWith("sites/") && path.endsWith("/permanent") && method === "DELETE") {
                        // Extract ID from /sites/123/permanent
                        const parts = path.split("/");
                        if (parts.length < 3) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const idStr = parts[1];
                        if (!idStr) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }
                        const id = parseInt(idStr);
                        if (isNaN(id)) {
                            return createJsonResponse({ error: "无效的ID" }, request, { status: 400 });
                        }

                        const result = await api.deleteSite(id);
                        return createJsonResponse({ success: result }, request);
                    }
                    else if (path === "sites/batch-delete" && method === "POST") {
                        const data = (await validateRequestBody(request)) as { ids: number[] };
                        if (!data.ids || !Array.isArray(data.ids)) {
                            return createJsonResponse({ success: false, message: "无效的 ID 列表" }, request, { status: 400 });
                        }
                        const result = await api.deleteSites(data.ids);
                        return createJsonResponse({ success: result }, request);
                    }
                    else if (path === "sites/batch-restore" && method === "POST") {
                        const data = (await validateRequestBody(request)) as { ids: number[] };
                        if (!data.ids || !Array.isArray(data.ids)) {
                            return createJsonResponse({ success: false, message: "无效的 ID 列表" }, request, { status: 400 });
                        }
                        const result = await api.restoreSites(data.ids);
                        return createJsonResponse({ success: result }, request);
                    }
                    else if (path === "sites/batch-delete-permanent" && method === "POST") {
                        const data = (await validateRequestBody(request)) as { ids: number[] };
                        if (!data.ids || !Array.isArray(data.ids)) {
                            return createJsonResponse({ success: false, message: "无效的 ID 列表" }, request, { status: 400 });
                        }
                        const result = await api.deleteSitesPermanently(data.ids);
                        return createJsonResponse({ success: result }, request);
                    }
                    // 批量更新排序
                    else if (path === "group-orders" && method === "PUT") {
                        const data = (await validateRequestBody(request)) as Array<{ id: number; order_num: number }>;

                        // 验证排序数据
                        if (!Array.isArray(data)) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: "排序数据必须是数组",
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        for (const item of data) {
                            if (
                                !item.id ||
                                typeof item.id !== "number" ||
                                item.order_num === undefined ||
                                typeof item.order_num !== "number"
                            ) {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: "排序数据格式无效，每个项目必须包含id和order_num",
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }
                        }

                        const result = await api.updateGroupOrder(data);
                        return createJsonResponse({ success: result }, request);
                    } else if (path === "site-orders" && method === "PUT") {
                        const data = (await validateRequestBody(request)) as Array<{ id: number; order_num: number }>;

                        // 验证排序数据
                        if (!Array.isArray(data)) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: "排序数据必须是数组",
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        for (const item of data) {
                            if (
                                !item.id ||
                                typeof item.id !== "number" ||
                                item.order_num === undefined ||
                                typeof item.order_num !== "number"
                            ) {
                                return createJsonResponse(
                                    {
                                        success: false,
                                        message: "排序数据格式无效，每个项目必须包含id和order_num",
                                    },
                                    request,
                                    { status: 400 }
                                );
                            }
                        }

                        const result = await api.updateSiteOrder(data);
                        return createJsonResponse({ success: result }, request);
                    }
                    // 配置相关API
                    else if (path === "configs" && method === "GET") {
                        const configs = await api.getConfigs(currentUserId);
                        return createJsonResponse(configs, request);
                    } else if (path.startsWith("configs/") && method === "GET") {
                        const key = path.substring("configs/".length);
                        const value = await api.getConfig(key, currentUserId);
                        return createJsonResponse({ key, value }, request);
                    } else if (path.startsWith("configs/") && method === "PUT") {
                        if (!isAuthenticated) {
                            return createJsonResponse({ success: false, message: "请先登录" }, request, { status: 401 });
                        }
                        const key = path.substring("configs/".length);
                        const data = (await validateRequestBody(request)) as ConfigInput;

                        // 验证配置数据
                        const validation = validateConfig(data);
                        if (!validation.valid) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: `验证失败: ${validation.errors?.join(", ")}`,
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        // 确保value存在
                        if (data.value === undefined) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: "配置值必须提供，可以为空字符串",
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.setConfig(key, data.value, currentUserId);
                        return createJsonResponse({ success: result }, request);
                    } else if (path.startsWith("configs/") && method === "DELETE") {
                        const key = path.substring("configs/".length);
                        const result = await api.deleteConfig(key, currentUserId);
                        return createJsonResponse({ success: result }, request);
                    }

                    // 数据导出路由
                    else if (path === "export" && method === "GET") {
                        const data = await api.exportData();
                        return createJsonResponse(data, request, {
                            headers: {
                                "Content-Disposition": "attachment; filename=navhive-data.json",
                                "Content-Type": "application/json",
                            },
                        });
                    }

                    // 数据导入路由
                    else if (path === "import" && method === "POST") {
                        const data = await validateRequestBody(request);

                        // 深度验证导入数据
                        const validation = validateExportData(data);
                        if (!validation.valid) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: '导入数据验证失败',
                                    errors: validation.errors,
                                },
                                request,
                                { status: 400 }
                            );
                        }

                        const result = await api.importData(data as ExportData, currentUserId);
                        return createJsonResponse(result, request);
                    }

                    // 清空所有数据路由
                    else if (path === "clear-all" && method === "DELETE") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }

                        const success = await api.clearAllData(currentUserId);
                        return createJsonResponse({ success }, request);
                    }

                    // 用户个人资料路由
                    else if (path === "user/profile" && method === "GET") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }
                        try {
                            console.log('[Worker GET Profile] ID:', currentUserId);
                            const profile = await api.getUserProfile(currentUserId);
                            console.log('[Worker GET Profile] Data:', JSON.stringify(profile));
                            return createJsonResponse(profile, request);
                        } catch (error) {
                            return createJsonResponse({ success: false, message: "获取资料失败" }, request, { status: 500 });
                        }
                    }

                    // DATA DEBUG ENDPOINT
                    else if (path === "debug/schema" && method === "GET") {
                        try {
                            const result = await env.DB.prepare("PRAGMA table_info(sites)").all();
                            return createJsonResponse(result.results, request);
                        } catch (error) {
                            return createJsonResponse({ error: String(error) }, request, { status: 500 });
                        }
                    }

                    else if (path === "user/profile" && method === "PUT") {
                        if (!isAuthenticated || !currentUserId) {
                            return createResponse("未认证", request, { status: 401 });
                        }

                        const data = await validateRequestBody(request) as { email?: string; avatar_url?: string };
                        console.log('[Worker PUT Profile] ID:', currentUserId, 'Data:', JSON.stringify(data));
                        const result = await api.updateUserProfile({
                            userId: currentUserId,
                            email: data.email,
                            avatar_url: data.avatar_url
                        });
                        console.log('[Worker PUT Profile] Result:', JSON.stringify(result));

                        return createJsonResponse(result, request);
                    }

                    // 获取站点信息 (标题和描述) - 支持静默模式
                    else if (path === "utils/fetch-site-info" && method === "GET") {
                        if (!isAuthenticated) {
                            return createResponse("未认证", request, { status: 401 });
                        }

                        const targetUrl = url.searchParams.get("url");
                        const isSilent = url.searchParams.get("silent") === "true";

                        if (!targetUrl) {
                            return createJsonResponse({ success: false, message: "参数 url 不能为空" }, request, { status: 400 });
                        }

                        try {
                            let fetchResponse;
                            if (!isSilent) console.log(`[Fetch Info] Attempting to fetch: ${targetUrl}`);

                            try {
                                fetchResponse = await fetch(targetUrl, {
                                    headers: {
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
                                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                                    },
                                    redirect: "follow",
                                    signal: AbortSignal.timeout(5000)
                                });
                            } catch (fetchErr) {
                                if (!isSilent) console.error(`[Fetch Info] Failed for ${targetUrl}:`, fetchErr);
                                return createJsonResponse({ success: false, deadLink: true }, request);
                            }

                            if (!fetchResponse.ok) {
                                return createJsonResponse({ success: false, deadLink: fetchResponse.status >= 400 && fetchResponse.status < 600 }, request);
                            }

                            let title = "";
                            let description = "";
                            let icon = "";

                            const rewriter = new HTMLRewriter()
                                .on("title", { text(t) { title += t.text; } })
                                .on("meta[name='description'], meta[name='Description'], meta[property='og:description']", {
                                    element(e) { if (!description) description = e.getAttribute("content") || ""; }
                                })
                                .on("meta[property='og:title']", {
                                    element(e) { if (!title) title = e.getAttribute("content") || ""; }
                                })
                                .on("link[rel*='icon']", {
                                    element(e) {
                                        if (!icon) {
                                            const href = e.getAttribute("href");
                                            if (href) {
                                                try { icon = new URL(href, targetUrl).toString(); } catch { icon = href; }
                                            }
                                        }
                                    }
                                });

                            await rewriter.transform(fetchResponse).arrayBuffer();

                            return createJsonResponse({
                                success: true,
                                name: title.trim().slice(0, 100),
                                description: description.trim().slice(0, 500),
                                icon: icon
                            }, request);

                        } catch (error) {
                            if (!isSilent) console.error('Fetch site info failed:', error);
                            return createJsonResponse({ success: false }, request);
                        }
                    }

                    // 批量获取书签图标
                    else if (path === "utils/batch-update-icons" && method === "POST") {
                        if (!isAuthenticated || !currentUserId) {
                            return createJsonResponse({ success: false, message: "请先登录" }, request, { status: 401 });
                        }
                        try {
                            const payload = await validateRequestBody(request);
                            console.log('[Worker Debug] utils/batch-update-icons payload:', JSON.stringify(payload));
                            const { siteIds } = payload as { siteIds: number[] };

                            if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
                                return createJsonResponse({ success: false, message: "参数 siteIds 必须是包含站点ID的数组" }, request, { status: 400 });
                            }

                            const results = await Promise.all(siteIds.map(async (siteId) => {
                                try {
                                    const site = await api.getSiteById(siteId);
                                    if (!site) {
                                        return { id: siteId, success: false, message: "站点未找到" };
                                    }

                                    const targetUrl = site.url;
                                    if (!targetUrl) {
                                        return { id: siteId, success: false, message: "站点URL为空" };
                                    }

                                    let fetchResponse;
                                    try {
                                        fetchResponse = await fetch(targetUrl, {
                                            headers: {
                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
                                                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                                                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                                            },
                                            redirect: "follow",
                                            signal: AbortSignal.timeout(5000)
                                        });
                                    } catch (fetchErr) {
                                        console.error(`[Fetch Icon] Failed for ${targetUrl}:`, fetchErr);
                                        return { id: siteId, success: false, message: "站点无法访问或请求超时", deadLink: true };
                                    }

                                    if (!fetchResponse.ok) {
                                        return { id: siteId, success: false, message: `站点返回错误: ${fetchResponse.status}`, deadLink: fetchResponse.status >= 400 && fetchResponse.status < 600 };
                                    }

                                    let icon = "";
                                    const rewriter = new HTMLRewriter()
                                        .on("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']", {
                                            element(e) {
                                                if (!icon) {
                                                    let href = e.getAttribute("href") || "";
                                                    if (href) {
                                                        try {
                                                            icon = new URL(href, targetUrl).toString();
                                                        } catch {
                                                            icon = href;
                                                        }
                                                    }
                                                }
                                            }
                                        });

                                    await rewriter.transform(fetchResponse).arrayBuffer();

                                    if (icon) {
                                        const updateResult = await api.updateSite(siteId, { icon });
                                        return { id: siteId, success: updateResult, icon };
                                    } else {
                                        return { id: siteId, success: false, message: "未找到图标" };
                                    }

                                } catch (e) {
                                    console.error(`[Fetch Icon] Error processing site ${siteId}:`, e);
                                    return { id: siteId, success: false, message: `处理失败: ${e instanceof Error ? e.message : '未知错误'}` };
                                }
                            }));

                            return createJsonResponse({ success: true, results }, request);
                        } catch (error) {
                            console.error('Batch update icons failed:', error);
                            return createJsonResponse({ success: false, message: "批量更新图标请求无效: " + (error instanceof Error ? error.message : String(error)) }, request, { status: 400 });
                        }
                    }
                    else if (path === "sites/batch" && method === "PUT") {
                        if (!isAuthenticated || !currentUserId) {
                            return createJsonResponse({ success: false, message: "请先登录" }, request, { status: 401 });
                        }
                        try {
                            const payload = await validateRequestBody(request);
                            console.log('[Worker Debug] sites/batch payload:', JSON.stringify(payload));
                            const data = payload as { ids: number[], data: Partial<Site> };
                            if (!data.ids || !Array.isArray(data.ids)) {
                                return createJsonResponse({ success: false, message: "参数 ids 必须是数组" }, request, { status: 400 });
                            }
                            const result = await api.batchUpdateSites(data.ids, data.data);
                            return createJsonResponse(result, request);
                        } catch (error) {
                            console.error('Batch update failed:', error);
                            return createJsonResponse({ success: false, message: "批量更新请求无效: " + (error instanceof Error ? error.message : String(error)) }, request, { status: 400 });
                        }
                    }


                    // AI 模型列表路由
                    if (path === "ai/models" && method === "GET") {
                        const CF_MODELS = [
                            { id: '@cf/zai-org/glm-4.7-flash', name: 'GLM 4 Flash', capabilities: { function_calling: false } },
                            { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', capabilities: { function_calling: true } },
                            { id: '@cf/qwen/qwen1.5-14b-chat-awq', name: 'Qwen 1.5 14B', capabilities: { function_calling: false } },
                            { id: '@cf/google/gemma-7b-it', name: 'Gemma 7B', capabilities: { function_calling: false } },
                            { id: '@cf/microsoft/phi-2', name: 'Phi-2', capabilities: { function_calling: false } }
                        ];

                        let externalModels: any[] = [];
                        console.log('[Worker Debug] Checking external models config:', {
                            hasBaseUrl: !!env.AI_BASE_URL,
                            baseUrl: env.AI_BASE_URL,
                            hasApiKey: !!env.AI_API_KEY
                        });

                        if (env.AI_BASE_URL && env.AI_API_KEY) {
                            try {
                                // Normalize Base URL: ensure it doesn't end with slash
                                let baseUrl = env.AI_BASE_URL.replace(/\/$/, '');
                                // If user didn't include /v1, try to be helpful (though some APIs might not use v1)
                                // But standard OpenAI compatible APIs usually have /v1. 
                                // We will trust the user's input primarily, but maybe try appending /v1 if the first capability check fails? 
                                // For now, let's just use what is provided but handle the models endpoint correctly.

                                // Check if URL ends with /v1, if not, maybe warn? Or just append /models. 
                                // OpenAI: https://api.openai.com/v1/models
                                // Check if the user config includes /v1. If they put "https://emtf.aipm9527.online", we might need "https://emtf.aipm9527.online/v1/models"

                                if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
                                    console.log('[Worker Debug] AI_BASE_URL does not end with /v1, attempting to append it for standard compatibility.');
                                    // Try the user provided URL first? Or construct valid endpoints?
                                    // Let's try to construct the models endpoint.
                                    // If base is "host", models is "host/v1/models" usually.
                                    baseUrl = `${baseUrl}/v1`;
                                }

                                // 确保这里也有超时，防止整个逻辑挂起
                                const fetchUrl = `${baseUrl}/models`;
                                console.log('[Worker Debug] Fetching external models from:', fetchUrl);

                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                                const response = await fetch(fetchUrl, {
                                    headers: {
                                        'Authorization': `Bearer ${env.AI_API_KEY}`
                                    },
                                    signal: controller.signal
                                });
                                clearTimeout(timeoutId);

                                console.log('[Worker Debug] External API Response Status:', response.status);

                                if (response.ok) {
                                    const data: any = await response.json();
                                    // console.log('[Worker Debug] External API Data:', JSON.stringify(data).substring(0, 200) + '...');

                                    if (data && Array.isArray(data.data)) {
                                        externalModels = data.data.map((m: any) => {
                                            const id = m.id.toLowerCase();
                                            // 简单的启发式规则判断是否支持 function calling
                                            const function_calling =
                                                id.includes('gpt-4') ||
                                                id.includes('gpt-3.5-turbo') ||
                                                id.includes('claude-3') ||
                                                id.includes('mistral-large') ||
                                                id.includes('llama-3') ||
                                                id.includes('command-r');

                                            return {
                                                id: m.id,
                                                name: m.id,
                                                capabilities: { function_calling }
                                            };
                                        });
                                        console.log(`[Worker Debug] Loaded ${externalModels.length} external models`);
                                    } else {
                                        console.warn('[Worker Debug] Unexpected external API response format:', data);
                                    }
                                } else {
                                    const errText = await response.text();
                                    console.error('[Worker Debug] Fetch failed:', response.status, errText);
                                }
                            } catch (e) {
                                console.error('[Worker Debug] Failed to fetch external models:', e);
                            }
                        } else {
                            console.warn('[Worker Debug] Skipping external models: Missing configuration');
                        }

                        return createJsonResponse({ data: [...CF_MODELS, ...externalModels] }, request);
                    }

                    else {
                        console.warn(`[Worker Warning] Unhandled API route: ${method} ${path}`);
                        // return createJsonResponse({ error: "Route not found" }, request, { status: 404 });
                        // Fallthrough to existing logic if any
                    }

                    // AI 智能问答路由
                    if (path === "chat" && method === "POST") {
                        const body = (await validateRequestBody(request)) as {
                            message: string;
                            history?: { role: string; content: string }[];
                            model?: string;
                        };

                        // 模型配置 - 切换模型时只需修改这里
                        const selectedModel = body.model || '@cf/zai-org/glm-4.7-flash';

                        // --- 额度查验与重置系统 ---
                        // 如果未启用认证且由访客访问，我们默认根据 IP 或 ID=1 进行限制 (此处按 ID=1 处理)
                        const userIdForQuota = currentUserId || 1;
                        const quotaCheck = await api.checkAndResetQuota(userIdForQuota);

                        if (!quotaCheck.allowed) {
                            return createJsonResponse(
                                {
                                    success: false,
                                    message: '您今日的 AI 咨询额度已用完，请明天再来。☕'
                                },
                                request,
                                { status: 429 }
                            );
                        }

                        // 执行计数增加
                        await api.incrementQuota(userIdForQuota);

                        // 辅助函数：根据模型ID获取上下文窗口大小（估算值）
                        const getContextWindow = (modelId: string): number => {
                            const lowerId = modelId.toLowerCase();
                            if (lowerId.includes('128k') || lowerId.includes('gpt-4-turbo') || lowerId.includes('gpt-4o')) return 128000;
                            if (lowerId.includes('claude-3')) return 200000; // Claude 3 Haiku/Sonnet/Opus usually 200k
                            if (lowerId.includes('gemini-1.5')) return 1000000; // Gemini 1.5 Pro/Flash
                            if (lowerId.includes('glm-4')) return 131072; // GLM-4 128k
                            if (lowerId.includes('moonshot-v1-32k')) return 32000;
                            if (lowerId.includes('moonshot-v1-128k')) return 128000;
                            if (lowerId.includes('deepseek') && !lowerId.includes('7b')) return 32000; // DeepSeek often 32k
                            if (lowerId.includes('llama-3.1-8b')) return 128000; // Llama 3.1 8B supports 128k
                            if (lowerId.includes('qwen1.5-14b')) return 32000;
                            if (lowerId.includes('gemma-7b')) return 8192;
                            if (lowerId.includes('phi-2')) return 2048;

                            // Default fallback
                            return 8192;
                        };

                        const contextWindow = getContextWindow(selectedModel);
                        const AI_MODEL = {
                            name: selectedModel,
                            contextWindow: contextWindow,
                        };

                        // 根据上下文窗口动态计算书签限制
                        // 预留更充足的空间给系统提示词和回复 (API Error 5021 suggest strict limits)
                        // 上下文窗口通常包含 输入 + 输出。
                        // 假设 1 token ≈ 1.5 chars (中文混合环境)，但为了安全我们按 1 token = 1 char 计算 (甚至更保守)
                        // Input limit: 80% of total context.
                        const maxInputTokens = Math.floor(AI_MODEL.contextWindow * 0.8);
                        const maxContextChars = maxInputTokens * 2; // Token to Char estimation

                        // 再次限制：对于 8k 模型 (8192)，80% 是 6553 tokens。
                        // 之前的错误是 8618 tokens > 7968 limit. 
                        // 说明之前的 13107 chars 确实产生了好几千 token。

                        const maxSites = Math.min(1000, Math.floor(maxContextChars / 150)); // 每条书签估算100-150字符

                        if (!body.message || typeof body.message !== 'string') {
                            return createJsonResponse(
                                { success: false, message: '消息内容不能为空' },
                                request,
                                { status: 400 }
                            );
                        }

                        // 查询用户书签数据作为上下文
                        let bookmarkContext = '';
                        try {
                            // 确保只查询当前用户的书签
                            // 如果未启用认证或未登录，默认使用管理员账号(ID=1)的数据，或者也可以选择不返回数据
                            const userId = currentUserId || 1;

                            const groups = await env.DB.prepare(
                                'SELECT id, name FROM groups WHERE user_id = ? ORDER BY order_num'
                            ).bind(userId).all();

                            const sites = await env.DB.prepare(
                                `SELECT s.name, s.url, s.description, s.group_id 
                             FROM sites s 
                             JOIN groups g ON s.group_id = g.id 
                             WHERE g.user_id = ? 
                             ORDER BY s.order_num 
                             LIMIT ${maxSites}`
                            ).bind(userId).all();

                            if (groups.results && sites.results) {
                                const groupMap = new Map<number, string>();
                                for (const g of groups.results as { id: number; name: string }[]) {
                                    groupMap.set(g.id, g.name);
                                }
                                const lines: string[] = [];
                                for (const s of sites.results as { name: string; url: string; description: string; group_id: number }[]) {
                                    const gName = groupMap.get(s.group_id) || '未分组';
                                    lines.push(`[${gName}] ${s.name}: ${s.url}${s.description ? ' - ' + s.description : ''}`);
                                }
                                bookmarkContext = lines.join('\n');
                                if (bookmarkContext.length > maxContextChars) {
                                    bookmarkContext = bookmarkContext.substring(0, maxContextChars) + '\n...(更多书签已省略)';
                                }
                            }
                        } catch (e) {
                            console.error('查询书签上下文失败:', e);
                        }

                        const systemPrompt = `你是 NavTools 智能导航助手。你可以帮助用户搜索和推荐书签，也可以回答一般性问题。
请用简洁友好的中文回复。

${bookmarkContext ? `以下是用户保存的书签数据：\n${bookmarkContext}\n\n当用户询问与书签相关的问题时，请参考以上数据进行回答。` : '用户暂无保存的书签数据。'}`;

                        const messages = [
                            { role: 'system' as const, content: systemPrompt },
                            ...(body.history || []).slice(-10).map(m => ({
                                role: m.role as 'user' | 'assistant',
                                content: m.content,
                            })),
                            { role: 'user' as const, content: body.message },
                        ];

                        try {
                            // Check if it's a Cloudflare model
                            if (selectedModel.startsWith('@cf/')) {
                                if (!env.AI) {
                                    return createJsonResponse(
                                        { success: false, message: 'AI 服务未配置，请检查 wrangler.jsonc 中的 ai 绑定' },
                                        request,
                                        { status: 503 }
                                    );
                                }

                                const aiResponse = await env.AI.run(
                                    AI_MODEL.name,
                                    { messages, stream: true }
                                );

                                const allowedOrigin = request.headers.get("Origin") || "*";
                                return new Response(aiResponse as ReadableStream, {
                                    headers: {
                                        "content-type": "text/event-stream",
                                        "Access-Control-Allow-Origin": allowedOrigin,
                                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                                        "Access-Control-Allow-Headers": "Content-Type, Authorization",
                                        "Access-Control-Allow-Credentials": "true",
                                    },
                                });
                            } else {
                                // External AI Provider (OpenAI Compatible)
                                if (!env.AI_BASE_URL || !env.AI_API_KEY) {
                                    return createJsonResponse(
                                        { success: false, message: '外部 AI 服务未配置，请检查 wrangler.jsonc' },
                                        request,
                                        { status: 503 }
                                    );
                                }

                                const payload = {
                                    model: selectedModel,
                                    messages: messages,
                                    stream: true
                                };

                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

                                // Normalize Base URL: ensure it doesn't end with slash
                                let baseUrl = env.AI_BASE_URL.replace(/\/$/, '');
                                if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
                                    baseUrl = `${baseUrl}/v1`;
                                }

                                const chatUrl = `${baseUrl}/chat/completions`;
                                console.log('[Worker Debug] Sending chat request to:', chatUrl);

                                // 使用已经声明的 controller 和 timeoutId，但更新超时时间为 30s
                                clearTimeout(timeoutId);
                                const chatController = new AbortController();
                                const chatTimeoutId = setTimeout(() => chatController.abort(), 30000); // 30s timeout for chat

                                const chatResponse = await fetch(chatUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${env.AI_API_KEY}`
                                    },
                                    body: JSON.stringify(payload),
                                    signal: chatController.signal
                                });
                                clearTimeout(chatTimeoutId);

                                if (!chatResponse.ok) {
                                    const errorText = await chatResponse.text();
                                    throw new Error(`External API Error: ${chatResponse.status} ${errorText}`);
                                }

                                const allowedOrigin = request.headers.get("Origin") || "*";
                                return new Response(chatResponse.body, {
                                    headers: {
                                        "content-type": "text/event-stream",
                                        "Access-Control-Allow-Origin": allowedOrigin,
                                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                                        "Access-Control-Allow-Headers": "Content-Type, Authorization",
                                        "Access-Control-Allow-Credentials": "true",
                                    },
                                });
                            }
                        } catch (aiError) {
                            const errorMsg = aiError instanceof Error ? aiError.message : String(aiError);
                            console.error('AI 调用失败:', errorMsg);
                            return createJsonResponse(
                                { success: false, message: `AI 服务暂不可用: ${errorMsg}` },
                                request,
                                { status: 503 }
                            );
                        }
                    }

                    // --- 兜底逻辑 ---
                    // 如果没有任何 if 分支被触发且逻辑运行到了这里
                    return createResponse("API路径不存在", request, { status: 404 });

                } catch (error) {
                    // 全局错误捕获，确保即使 API 处理出错也返回 Response
                    console.error(`[Worker Error] ${request.method} ${url.pathname}:`, error);
                    return createErrorResponse(error, request, 'API 请求');
                }
            }

            // 非API路由默认返回404，确保始终生成 Response
            return createResponse("Not Found", request, { status: 404 });
        } catch (globalError) {
            console.error(`[Fatal Worker Error] ${request.method} ${url.pathname}:`, globalError);
            return new Response(JSON.stringify({
                success: false,
                message: "服务器内部致命错误",
                error: globalError instanceof Error ? globalError.message : String(globalError)
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    },
} satisfies ExportedHandler;

// 环境变量接口
interface Env {
    DB: D1Database;
    KV: KVNamespace;
    AI: Ai;
    AUTH_ENABLED?: string;
    AUTH_REQUIRED_FOR_READ?: string;
    AUTH_USERNAME?: string;
    AUTH_PASSWORD?: string;
    AUTH_SECRET?: string;
    EMAIL_API_KEY?: string;
    EMAIL_FROM?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
}

// 验证用接口
interface LoginInput {
    username?: string;
    password?: string;
    rememberMe?: boolean;
}

interface GroupInput {
    name?: string;
    order_num?: number;
    is_public?: number;
}

interface SiteInput {
    group_id?: number;
    name?: string;
    url?: string;
    icon?: string;
    description?: string;
    notes?: string;
    order_num?: number;
    is_public?: number;
}

interface ConfigInput {
    value?: string;
}

// 输入验证函数
function validateLogin(data: LoginInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!data.username || typeof data.username !== "string") {
        errors.push("用户名不能为空且必须是字符串");
    }

    if (!data.password || typeof data.password !== "string") {
        errors.push("密码不能为空且必须是字符串");
    }

    if (data.rememberMe !== undefined && typeof data.rememberMe !== "boolean") {
        errors.push("记住我选项必须是布尔值");
    }

    return { valid: errors.length === 0, errors };
}

interface RegisterInput {
    username?: string;
    password?: string;
    email?: string;
}

function validateRegister(data: RegisterInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!data.username || typeof data.username !== "string") {
        errors.push("用户名不能为空且必须是字符串");
    } else if (data.username.length < 2 || data.username.length > 32) {
        errors.push("用户名长度必须在2-32个字符之间");
    } else if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(data.username)) {
        errors.push("用户名只能包含字母、数字、下划线和中文");
    }

    if (!data.password || typeof data.password !== "string") {
        errors.push("密码不能为空且必须是字符串");
    } else if (data.password.length < 6 || data.password.length > 64) {
        errors.push("密码长度必须在6-64个字符之间");
    }

    if (!data.email || typeof data.email !== "string") {
        errors.push("邮箱不能为空且必须是字符串");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push("邮箱格式不符合规范");
    }

    return { valid: errors.length === 0, errors };
}



function validateGroup(data: GroupInput): {
    valid: boolean;
    errors?: string[];
    sanitizedData?: Group;
} {
    const errors: string[] = [];
    const sanitizedData: Partial<Group> = {};

    // 验证名称
    if (!data.name || typeof data.name !== "string") {
        errors.push("分组名称不能为空且必须是字符串");
    } else {
        sanitizedData.name = data.name.trim().slice(0, 100); // 限制长度
    }

    // 验证排序号
    if (data.order_num === undefined || typeof data.order_num !== "number") {
        errors.push("排序号必须是数字");
    } else {
        sanitizedData.order_num = data.order_num;
    }

    // 验证 is_public (可选，默认为 1 - 公开)
    if (data.is_public !== undefined) {
        if (typeof data.is_public === "number" && (data.is_public === 0 || data.is_public === 1)) {
            sanitizedData.is_public = data.is_public;
        } else {
            errors.push("is_public 必须是 0 (私密) 或 1 (公开)");
        }
    } else {
        sanitizedData.is_public = 1; // 默认公开
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? (sanitizedData as Group) : undefined,
    };
}

function validateSite(data: SiteInput): {
    valid: boolean;
    errors?: string[];
    sanitizedData?: Site;
} {
    const errors: string[] = [];
    const sanitizedData: Partial<Site> = {};

    // 验证分组ID
    if (!data.group_id || typeof data.group_id !== "number") {
        errors.push("分组ID必须是数字且不能为空");
    } else {
        sanitizedData.group_id = data.group_id;
    }

    // 验证名称
    if (!data.name || typeof data.name !== "string") {
        errors.push("站点名称不能为空且必须是字符串");
    } else {
        sanitizedData.name = data.name.trim().slice(0, 100); // 限制长度
    }

    // 验证URL
    if (!data.url || typeof data.url !== "string") {
        errors.push("URL不能为空且必须是字符串");
    } else {
        let url = data.url.trim();
        // 如果没有协议,自动添加 https://
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        try {
            // 验证URL格式
            new URL(url);
            sanitizedData.url = url;
        } catch {
            errors.push("无效的URL格式");
        }
    }

    // 验证图标URL (可选)
    if (data.icon !== undefined) {
        if (typeof data.icon !== "string") {
            errors.push("图标URL必须是字符串");
        } else if (data.icon) {
            let iconUrl = data.icon.trim();
            // 如果没有协议,自动添加 https://
            if (!/^https?:\/\//i.test(iconUrl) && !/^data:/i.test(iconUrl)) {
                iconUrl = 'https://' + iconUrl;
            }
            try {
                // 验证URL格式
                new URL(iconUrl);
                sanitizedData.icon = iconUrl;
            } catch {
                errors.push("无效的图标URL格式");
            }
        } else {
            sanitizedData.icon = "";
        }
    }

    // 验证描述 (可选)
    if (data.description !== undefined) {
        sanitizedData.description =
            typeof data.description === "string"
                ? data.description.trim().slice(0, 500) // 限制长度
                : "";
    }

    // 验证备注 (可选)
    if (data.notes !== undefined) {
        sanitizedData.notes =
            typeof data.notes === "string"
                ? data.notes.trim().slice(0, 1000) // 限制长度
                : "";
    }

    // 验证排序号
    if (data.order_num === undefined || typeof data.order_num !== "number") {
        errors.push("排序号必须是数字");
    } else {
        sanitizedData.order_num = data.order_num;
    }

    // 验证 is_public (可选，默认为 1 - 公开)
    if (data.is_public !== undefined) {
        if (typeof data.is_public === "number" && (data.is_public === 0 || data.is_public === 1)) {
            sanitizedData.is_public = data.is_public;
        } else {
            errors.push("is_public 必须是 0 (私密) 或 1 (公开)");
        }
    } else {
        sanitizedData.is_public = 1; // 默认公开
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? (sanitizedData as Site) : undefined,
    };
}

function validateConfig(data: ConfigInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (data.value === undefined || typeof data.value !== "string") {
        errors.push("配置值必须是字符串类型");
    }

    return { valid: errors.length === 0, errors };
}

// 声明ExportedHandler类型
interface ExportedHandler {
    fetch(request: Request, env: Env, ctx?: ExecutionContext): Response | Promise<Response>;
}

// 声明Cloudflare Workers的执行上下文类型
interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
}

interface Ai {
    run(model: string, input: any): Promise<any>;
}

// 声明D1数据库类型
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<D1Result>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(column?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta?: any;
}
