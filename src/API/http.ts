// src/api/http.ts
// 不使用外部JWT库，改为内置的crypto API
import { compareSync, hashSync } from 'bcrypt-edge';

// 定义D1数据库类型
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
}

// 定义环境变量接口
interface Env {
  DB: D1Database;
  KV: any; // KV 命名空间
  AI: any; // AI 绑定
  AUTH_ENABLED?: string; // 是否启用身份验证
  AUTH_USERNAME?: string; // 认证用户名
  AUTH_PASSWORD?: string; // 认证密码哈希 (bcrypt)
  AUTH_SECRET?: string; // JWT密钥
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

// 数据类型定义
export interface Group {
  id?: number;
  name: string;
  order_num: number;
  is_public?: number; // 0 = 私密（仅管理员可见），1 = 公开（访客可见）
  user_id?: number; // 新增归属用户ID
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  is_protected?: number; // 0 = 正常, 1 = 受保护（不可删除）
  site_count?: number; // Optional site count for UI display
}

export interface Site {
  id?: number;
  group_id: number;
  name: string;
  url: string;
  icon: string;
  description: string;
  notes: string;
  order_num: number;
  is_public?: number; // 0 = 私密（仅管理员可见），1 = 公开（访客可见）
  last_clicked_at?: string; // 上次点击时间
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  is_featured?: number; // 0 = 正常, 1 = 精选（仅访客可见）
}

// 分组及其站点 (用于优化 N+1 查询)
export interface GroupWithSites extends Group {
  id: number; // 确保 id 存在
  sites: Site[];
}

// 新增配置接口
export interface Config {
  key: string;
  value: string;
  user_id?: number; // Config owner
  created_at?: string;
  updated_at?: string;
}

// 扩展导出数据接口，添加导入结果类型
export interface ExportData {
  groups: Group[];
  sites: Site[];
  configs: Record<string, string>;
  version: string;
  exportDate: string;
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  stats?: {
    groups: {
      total: number;
      created: number;
      merged: number;
    };
    sites: {
      total: number;
      created: number;
      updated: number;
      skipped: number;
    };
  };
  error?: string;
}

// 新增用户登录接口
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean; // 新增记住我选项
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
  userId?: number;
}

// 注册接口
export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
}

// 密码重置接口
export interface ResetPasswordRequest {
  username: string;
  newPassword: string;
  code: string; // 新增验证码字段
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

// 发送验证码接口
export interface SendCodeRequest {
  email: string;
  username: string;
}

export interface SendCodeResponse {
  success: boolean;
  message?: string;
  code?: string; // 开发模式：返回验证码用于自动填充
}

// API 类
export class NavigationAPI {
  private db: D1Database;
  private authEnabled: boolean;
  private username: string;
  private passwordHash: string; // 存储bcrypt哈希而非明文密码
  private secret: string;
  public currentUserId: number | null = null; // Changed to public so worker can set it

  constructor(envOrUrl: Env | string) {
    if (typeof envOrUrl === 'string') {
      // Frontend client mode
      this.db = null as any;
      this.authEnabled = true;
      this.username = '';
      this.passwordHash = '';
      this.secret = '';
    } else {
      // Backend/Worker mode
      const env = envOrUrl as Env;
      this.db = env.DB;
      this.authEnabled = env.AUTH_ENABLED === 'true';
      this.username = env.AUTH_USERNAME || '';
      this.passwordHash = env.AUTH_PASSWORD || '';
      this.secret = env.AUTH_SECRET || 'your-secret-key';
    }
  }

  // 初始化数据库表
  // 修改initDB方法，将SQL语句分开执行
  async initDB(): Promise<{ success: boolean; alreadyInitialized: boolean }> {
    // 尝试自动修复缺失的字段 (即使已初始化也尝试执行，以修复旧版本数据库)


    // 迁移：groups 表添加 user_id 字段
    // --- 快速路径：检查是否已经完全初始化 ---
    try {
      const isInitialized = await this.db
        .prepare("SELECT value FROM configs WHERE key = 'DB_INITIALIZED' AND user_id = 1")
        .first<{ value: string }>();

      if (isInitialized?.value === 'true') {
        // console.log('[DB Init] Fast-path: Already initialized, skipping heavy migrations.');
        return { success: true, alreadyInitialized: true };
      }
    } catch (e) {
      // 报错说明表可能不存在，继续执行初始化
    }

    try {
      await this.db.exec('ALTER TABLE groups ADD COLUMN user_id INTEGER DEFAULT 1;'); // 默认为 admin(1)
    } catch { }
    try {
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);');
    } catch { }

    // 创建 users 表（即使已初始化也尝试创建，以支持旧版本升级）
    try {
      await this.db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, email TEXT, role TEXT DEFAULT \'user\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');
    } catch { }

    // 迁移：为 users 表添加 email 字段
    try {
      await this.db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
    } catch { }

    // 迁移环境变量中的管理员到 users 表
    try {
      if (this.username && this.passwordHash) {
        const existingAdmin = await this.db
          .prepare('SELECT id FROM users WHERE username = ?')
          .bind(this.username)
          .first();
        if (!existingAdmin) {
          await this.db
            .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
            .bind(this.username, this.passwordHash, 'admin')
            .run();
        }
      }
    } catch { }

    // 首先检查数据库是否已初始化
    // 即使已初始化，我们也继续检查是否需要迁移或补充数据 (CREATE TABLE IF NOT EXISTS 是安全的)
    try {
      /* 移除旧的提前返回逻辑，确保新功能（如数据初始化）能执行
      const isInitialized = await this.getConfig('DB_INITIALIZED');
      if (isInitialized === 'true') {
        return { success: true, alreadyInitialized: true };
      }
      */
    } catch { }

    // 先创建groups表
    await this.db.exec(
      `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, order_num INTEGER NOT NULL, is_public INTEGER DEFAULT 1, user_id INTEGER DEFAULT 1, is_protected INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
    );;

    // 再创建sites表
    await this.db.exec(
      `CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, icon TEXT, description TEXT, notes TEXT, order_num INTEGER NOT NULL, is_public INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0, deleted_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);`
    );

    // 创建配置表
    await this.db.exec(
      'CREATE TABLE IF NOT EXISTS configs (key TEXT NOT NULL, value TEXT NOT NULL, user_id INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (key, user_id));'
    );

    // 数据库迁移：添加 user_id 到 groups 表
    try {
      await this.db.exec("ALTER TABLE groups ADD COLUMN user_id INTEGER DEFAULT 1");
      console.log('Migrated: Added user_id to groups table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 数据库迁移：添加 is_deleted 到 groups 表
    try {
      await this.db.exec("ALTER TABLE groups ADD COLUMN is_deleted INTEGER DEFAULT 0");
      await this.db.exec("CREATE INDEX IF NOT EXISTS idx_groups_is_deleted ON groups(is_deleted)");
      console.log('Migrated: Added is_deleted to groups table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 数据库迁移：添加 deleted_at 到 groups 表
    try {
      await this.db.exec("ALTER TABLE groups ADD COLUMN deleted_at TIMESTAMP");
      console.log('Migrated: Added deleted_at to groups table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 数据库迁移：添加 is_protected 到 groups 表
    try {
      await this.db.exec("ALTER TABLE groups ADD COLUMN is_protected INTEGER DEFAULT 0");
      console.log('Migrated: Added is_protected to groups table');
      // 将现有的“常用工具”标记为受保护
      await this.db.exec("UPDATE groups SET is_protected = 1 WHERE name = '常用工具'");
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 数据库迁移：添加 user_id 到 configs 表并更改主键
    try {
      // 1. 检查是否已经迁移过
      const tableInfo = await this.db.prepare("PRAGMA table_info(configs)").all();
      const hasUserId = (tableInfo.results as any[]).some((col: any) => col.name === 'user_id');

      if (!hasUserId) {
        // SQLite 不支持直接 ALTER TABLE 更改主键，需要：
        // a. 重命名旧表
        // b. 创建新表
        // c. 迁移数据
        // d. 删除旧表
        await this.db.batch([
          this.db.prepare("ALTER TABLE configs RENAME TO configs_old"),
          this.db.prepare("CREATE TABLE configs (key TEXT NOT NULL, value TEXT NOT NULL, user_id INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (key, user_id))"),
          this.db.prepare("INSERT INTO configs (key, value, created_at, updated_at) SELECT key, value, created_at, updated_at FROM configs_old"),
          this.db.prepare("DROP TABLE configs_old")
        ]);
        console.log('Migrated: Added user_id to configs table and updated primary key');
      }
    } catch (e) {
      console.error('Migration failed for configs table:', e);
    }

    // 数据库迁移：添加 avatar_url 到 users 表
    try {
      await this.db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
      console.log('Migrated: Added avatar_url to users table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 数据库迁移：添加 is_featured 到 sites 表
    try {
      await this.db.exec("ALTER TABLE sites ADD COLUMN is_featured INTEGER DEFAULT 0");
      console.log('Migrated: Added is_featured column to sites table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 初始化默认数据 (仅当从未初始化数据时)
    try {
      const isDataInitialized = await this.getConfig('DATA_INITIALIZED');
      if (isDataInitialized !== 'true') {
        console.log('Initializing default data...');

        // 1. 插入默认分组 (User ID 1 = Admin)
        await this.db.prepare(
          `INSERT INTO groups (name, order_num, is_public, user_id) VALUES 
           ('常用工具', 1, 1, 1),
           ('开发社区', 2, 1, 1)
           RETURNING id`
        ).run();

        // 由于 D1 批量插入返回 ID 可能有限制，简单起见我们假设 ID 是连续的 (或查询获取)
        // 这里为了稳健，分别插入

        // 重新查询刚才插入的分组 ID
        const toolsGroup = await this.db.prepare("SELECT id FROM groups WHERE name = '常用工具' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
        const devGroup = await this.db.prepare("SELECT id FROM groups WHERE name = '开发社区' ORDER BY id DESC LIMIT 1").first<{ id: number }>();

        if (toolsGroup && devGroup) {
          // 2. 插入默认站点
          await this.db.prepare(`
             INSERT INTO sites (group_id, name, url, icon, description, order_num, is_public) VALUES 
             (?, 'Google', 'https://www.google.com', 'https://www.google.com/favicon.ico', '全球最大的搜索引擎', 1, 1),
             (?, 'GitHub', 'https://github.com', 'https://github.com/favicon.ico', '代码托管平台', 2, 1),
             (?, 'ChatGPT', 'https://chat.openai.com', 'https://chat.openai.com/favicon.ico', 'AI 助手', 3, 1)
           `).bind(toolsGroup.id, toolsGroup.id, toolsGroup.id).run();

          await this.db.prepare(`
             INSERT INTO sites (group_id, name, url, icon, description, order_num, is_public) VALUES 
             (?, 'Stack Overflow', 'https://stackoverflow.com', 'https://www.google.com/s2/favicons?domain=stackoverflow.com&sz=64', '开发者问答社区', 1, 1),
             (?, 'MDN Web Docs', 'https://developer.mozilla.org', 'https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64', 'Web 开发文档', 2, 1),
             (?, 'V2EX', 'https://www.v2ex.com', 'https://www.v2ex.com/favicon.ico', '创意工作者社区', 3, 1)
           `).bind(devGroup.id, devGroup.id, devGroup.id).run();
        }

        await this.setConfig('DATA_INITIALIZED', 'true', 1);
        await this.setConfig('site.iconApi', 'https://www.faviconextractor.com/favicon/{domain}', 1);
        console.log('Default data initialized.');
      }
    } catch (e) {
      console.error('Failed to initialize default data:', e);
    }

    // 设置 DB 初始化标志
    await this.setConfig('DB_INITIALIZED', 'true', 1);

    return { success: true, alreadyInitialized: false };
  }

  // 验证用户登录
  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    // 如果未启用身份验证，直接返回成功
    if (!this.authEnabled) {
      return {
        success: true,
        token: await this.generateToken({ username: 'guest' }, false),
        message: '身份验证未启用，默认登录成功',
      };
    }

    // 优先从 users 表查询用户
    try {
      const user = await this.db
        .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
        .bind(loginRequest.username)
        .first<{ id: number; username: string; password_hash: string; role: string }>();

      if (user) {
        const isPasswordValid = compareSync(loginRequest.password, user.password_hash);
        if (isPasswordValid) {
          const token = await this.generateToken(
            { id: user.id, username: user.username, role: user.role },
            loginRequest.rememberMe || false
          );
          return { success: true, token, message: '登录成功', userId: user.id };
        }
        return { success: false, message: '用户名或密码错误' };
      }
    } catch (e) {
      // users 表可能不存在（旧版数据库），回退到环境变量认证
      console.warn('Users table query failed, falling back to env auth:', e);
    }

    // 回退：使用环境变量中的管理员账号（兼容旧版）
    if (loginRequest.username !== this.username) {
      return { success: false, message: '用户名或密码错误' };
    }

    const isPasswordValid = compareSync(loginRequest.password, this.passwordHash);
    if (isPasswordValid) {
      const token = await this.generateToken(
        { id: 0, username: loginRequest.username, role: 'admin' }, // 使用 0 作为环境变量管理员的专用 ID
        loginRequest.rememberMe || false
      );
      return { success: true, token, message: '登录成功', userId: 0 };
    }

    return { success: false, message: '用户名或密码错误' };
  }

  // 获取用户信息
  async getUserProfile(userId?: number): Promise<{ id: number; username: string; email: string | null; role: string; avatar_url: string | null }> {
    const targetId = userId !== undefined ? userId : this.currentUserId;

    if (targetId === undefined) {
      throw new Error('未指定用户 ID 且当前无登录上下文');
    }

    console.log('[DB GetProfile] Fetching profile for ID:', targetId);
    const user = await this.db
      .prepare('SELECT id, username, email, role, avatar_url FROM users WHERE id = ?')
      .bind(targetId)
      .first<{ id: number; username: string; email: string | null; role: string; avatar_url: string | null }>();

    console.log('[DB GetProfile] Result:', JSON.stringify(user));

    if (!user) {
      throw new Error('用户不存在');
    }

    return user;
  }

  // 更新用户信息
  async updateUserProfile(profile: { userId?: number; email?: string; avatar_url?: string }): Promise<{ success: boolean; message: string }> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (profile.email !== undefined) {
        updates.push('email = ?');
        values.push(profile.email);
      }

      if (profile.avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        values.push(profile.avatar_url);
        if (profile.avatar_url && profile.avatar_url.startsWith('data:image/')) {
          console.log('[DB Update] Avatar type: Base64 (length:', profile.avatar_url.length, ')');
        } else {
          console.log('[DB Update] Avatar type: URL (', profile.avatar_url, ')');
        }
      }

      if (updates.length === 0) {
        return { success: true, message: '没有需要更新的内容' };
      }

      const query = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      values.push(profile.userId || this.currentUserId || 1);

      console.log('[DB Update] Query:', query);
      console.log('[DB Update] Values:', JSON.stringify(values));

      const dbResult = await this.db.prepare(query).bind(...values).run();
      console.log('[DB Update] Success:', dbResult.success);
      return { success: true, message: '更新成功' };
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return { success: false, message: '更新失败: ' + (error instanceof Error ? error.message : '未知错误') };
    }
  }

  // 根据用户名获取邮箱 (用于重置密码回显)
  async getUserEmail(username: string): Promise<string | null> {
    const user = await this.db
      .prepare('SELECT email FROM users WHERE username = ?')
      .bind(username)
      .first<{ email: string | null }>();

    // 数据库中有邮箱则直接返回
    if (user?.email) {
      return user.email;
    }

    // 特殊处理：如果是管理员且数据库中未设置邮箱（旧数据升级情况），返回默认邮箱
    if (username === 'admin' || (this.username && username === this.username)) {
      return `${username}@example.com`;
    }

    return null;
  }

  // 注册新用户
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    console.log(`[DEBUG] Registering user: ${request.username}, email: ${request.email}`);
    try {
      // 检查用户名是否已存在
      const existing = await this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(request.username)
        .first();

      if (existing) {
        return { success: false, message: '用户名已存在' };
      }

      // bcrypt 哈希密码
      const passwordHash = hashSync(request.password, 10);

      // 插入新用户
      const userResult = await this.db
        .prepare('INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)')
        .bind(request.username, passwordHash, request.email, 'user')
        .run();

      console.log(`[DEBUG] Insert user result:`, userResult);

      // 获取新创建的用户 ID (对于 D1, meta.last_row_id 可能有用，或者直接查询)
      const newUser = await this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(request.username)
        .first<{ id: number }>();

      if (newUser) {
        // 为新用户创建一个默认的“常用工具”分组，并标记为受保护
        await this.db.prepare(
          "INSERT INTO groups (name, order_num, is_public, user_id, is_protected) VALUES ('常用工具', 1, 1, ?, 1)"
        ).bind(newUser.id).run();
        console.log(`[DEBUG] Created default protected group for user ${newUser.id}`);
      }

      return { success: true, message: '注册成功' };
    } catch (error) {
      console.error('注册失败:', error);
      return { success: false, message: '注册失败，请稍后重试' };
    }
  }

  // 重置密码
  async resetPassword(request: ResetPasswordRequest, env?: Env): Promise<ResetPasswordResponse> {
    try {
      // 1. 验证验证码
      if (env && env.KV) {
        const storedCode = await env.KV.get(`reset_code:${request.username}`);
        if (!storedCode || storedCode !== request.code) {
          return { success: false, message: '验证码无效或已过期' };
        }
        // 验证码使用后立即删除
        await env.KV.delete(`reset_code:${request.username}`);
      } else if (this.authEnabled) {
        // 如果启用了认证但没有 KV，处于降级模式或本地开发未配置 KV
        console.warn('KV 存储未配置，跳过验证码校验');
      }

      // 查找用户
      const user = await this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(request.username)
        .first<{ id: number }>();

      if (!user) {
        // 也检查环境变量中的管理员
        if (request.username === this.username) {
          // 更新环境变量管理员的密码 —— 需要将其迁移到 users 表
          const passwordHash = hashSync(request.newPassword, 10);
          await this.db
            .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash = ?, updated_at = CURRENT_TIMESTAMP')
            .bind(request.username, passwordHash, 'admin', passwordHash)
            .run();
          return { success: true, message: '密码重置成功' };
        }
        return { success: false, message: '用户名不存在' };
      }

      // 更新密码
      const passwordHash = hashSync(request.newPassword, 10);
      await this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(passwordHash, user.id)
        .run();

      return { success: true, message: '密码重置成功' };
    } catch (error) {
      console.error('密码重置失败:', error);
      return { success: false, message: '密码重置失败，请稍后重试' };
    }
  }

  /**
   * 发送重置密码验证码
   */
  async sendResetCode(request: SendCodeRequest, env: Env): Promise<SendCodeResponse> {
    try {
      // 1. 校验用户是否存在及其邮箱
      const user = await this.db
        .prepare('SELECT email FROM users WHERE username = ?')
        .bind(request.username)
        .first<{ email: string }>();

      if (!user) {
        return { success: false, message: '用户名不存在' };
      }

      if (!user.email || user.email.toLowerCase() !== request.email.toLowerCase()) {
        return { success: false, message: '输入的邮箱与注册邮箱不匹配' };
      }

      // 2. 生成 6 位数字验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // 3. 存储到 KV，有效期 10 分钟
      if (env.KV) {
        await env.KV.put(`reset_code:${request.username}`, code, { expirationTtl: 600 });
      } else {
        console.error('KV 绑定缺失');
        return { success: false, message: '系统配置错误：KV 缺失' };
      }

      // 4. 发送邮件
      const emailResult = await this.sendEmail(
        request.email,
        'NavTools 密码重置验证码',
        `您的重置密码验证码是：${code}。有效期为 10 分钟。如果您没有尝试重置密码，请忽略此邮件。`,
        env
      );

      if (!emailResult) {
        // 开发/调试模式：如果邮件发送失败且处于特定环境，可以从日志查看验证码
        // 用户请求：先不实现发送验证码，先前端回显，且算验证码获取成功
        console.log(`[DEBUG] 验证码发送失败，当前生成的验证码为: ${code}`);
        return { success: true, message: '验证码发送模拟成功（邮件未配置）', code };
      }

      return { success: true, message: '验证码已发送到您的邮箱', code };
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, message: '发送验证码失败，请稍后重试' };
    }
  }

  /**
   * 辅助方法：发送验证码邮件
   * 使用 Resend (每天 100 封免费额度，无需域名验证即可使用测试域名)
   */
  private async sendEmail(to: string, subject: string, content: string, env: Env): Promise<boolean> {
    // 调试输出：即使邮件没发出去，你也能在控制台看到验证码
    console.log(`[EMAIL DEBUG] 发送至: ${to}, 主题: ${subject}, 内容: ${content}`);

    if (!env.EMAIL_API_KEY) {
      console.warn('EMAIL_API_KEY 未配置，跳过真实邮件发送。');
      // 注意：返回 false 意味着 API 会告诉前端发送失败，但你可以通过日志看到验证码
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'onboarding@resend.dev',
          to: [to],
          subject: subject,
          text: content,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Resend API 调用失败:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Resend API 连接错误:', error);
      return false;
    }
  }

  // 验证令牌有效性
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
    if (!this.authEnabled) {
      return { valid: true };
    }

    try {
      // 解析JWT
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false };
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Validate all parts exist
      if (!encodedHeader || !encodedPayload || !signature) {
        return { valid: false };
      }

      // 重新生成签名进行验证
      const encoder = new TextEncoder();
      const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
      const keyData = encoder.encode(this.secret);

      // 导入密钥
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      // 解码签名
      const signatureBytes = this.base64UrlDecode(signature);

      // 验证签名
      const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);

      if (!isValid) {
        return { valid: false };
      }

      // 解码并验证 payload
      const payloadStr = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadStr) as Record<string, unknown>;

      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && typeof payload.exp === 'number' && payload.exp < now) {
        return { valid: false };
      }

      return { valid: true, payload };
    } catch (error) {
      console.error('Token验证失败:', error);
      return { valid: false };
    }
  }

  // 生成JWT令牌
  private async generateToken(
    payload: Record<string, unknown>,
    rememberMe: boolean = false
  ): Promise<string> {
    // 准备payload
    const expiresIn = rememberMe
      ? 30 * 24 * 60 * 60 // 30天 (一个月)
      : 24 * 60 * 60; // 24小时

    const tokenPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      iat: Math.floor(Date.now() / 1000),
    };

    // 创建Header和Payload部分
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(tokenPayload));

    // 使用 Web Crypto API 进行 HMAC-SHA256 签名
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const keyData = encoder.encode(this.secret);

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // 生成签名
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    const signature = this.base64UrlEncode(signatureBuffer);

    // 组合JWT
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // 辅助方法：base64url 编码（支持字符串和 ArrayBuffer）
  private base64UrlEncode(data: string | ArrayBuffer): string {
    let base64: string;

    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      // ArrayBuffer 转 base64
      const bytes = new Uint8Array(data);
      const binary = Array.from(bytes)
        .map((byte) => String.fromCharCode(byte))
        .join('');
      base64 = btoa(binary);
    }

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // 辅助方法：base64url 解码为 ArrayBuffer
  private base64UrlDecode(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // 检查认证是否启用
  isAuthEnabled(): boolean {
    return this.authEnabled;
  }

  // 分组相关 API
  // 获取所有分组
  async getGroups(userId?: number): Promise<Group[]> {
    let query = 'SELECT * FROM groups';
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY order_num ASC';

    const result = await this.db.prepare(query).bind(...params).all<Group>();
    return result.results || [];
  }

  async getGroup(id: number): Promise<Group | null> {
    const result = await this.db
      .prepare('SELECT id, name, order_num, created_at, updated_at FROM groups WHERE id = ?')
      .bind(id)
      .first<Group>();
    return result;
  }

  async createGroup(group: Group, userId?: number): Promise<Group> {
    const finalUserId = userId || 1; // 默认为 admin

    // 1. 尝试查找同名分组（忽略大小写和首尾空格）
    const existingGroup = await this.getGroupByName(group.name, finalUserId);
    if (existingGroup) {
      throw new Error('分组名称已存在');
    }

    // 2. 如果不存在，则创建
    const result = await this.db
      .prepare(
        'INSERT INTO groups (name, order_num, is_public, user_id) VALUES (?, ?, ?, ?) RETURNING id, name, order_num, is_public, user_id, created_at, updated_at'
      )
      .bind(group.name.trim(), group.order_num, group.is_public ?? 1, finalUserId)
      .all<Group>();
    if (!result.results || result.results.length === 0) {
      throw new Error('创建分组失败');
    }
    const createdGroup = result.results[0];
    if (!createdGroup) {
      throw new Error('创建分组失败');
    }
    return createdGroup;
  }

  async updateGroup(id: number, group: Partial<Group>): Promise<Group | null> {
    // 字段白名单
    const ALLOWED_FIELDS = ['name', 'order_num', 'is_public'] as const;
    type AllowedField = (typeof ALLOWED_FIELDS)[number];

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    // 只允许更新白名单中的字段
    Object.entries(group).forEach(([key, value]) => {
      if (ALLOWED_FIELDS.includes(key as AllowedField) && value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        console.warn(`尝试更新不允许的字段: ${key}`);
      }
    });

    if (updates.length === 1) {
      // 只有 updated_at，没有实际更新
      throw new Error('没有可更新的字段');
    }

    // 构建安全的参数化查询
    const query = `UPDATE groups SET ${updates.join(
      ', '
    )} WHERE id = ? RETURNING id, name, order_num, created_at, updated_at`;
    params.push(id);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Group>();

    if (!result.results || result.results.length === 0) {
      return null;
    }
    const updatedGroup = result.results[0];
    return updatedGroup || null;
  }

  async deleteGroup(id: number): Promise<boolean> {
    // 默认执行软删除
    return this.softDeleteGroup(id);
  }

  // 软删除分组
  async softDeleteGroup(id: number): Promise<boolean> {
    try {
      // 检查是否为受保护的分组 (使用 is_protected 标志)
      const group = await this.getGroup(id);
      if (group?.is_protected === 1) {
        throw new Error('此分组是受保护的，不允许删除');
      }

      await this.db
        .prepare('UPDATE groups SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(id)
        .run();
      return true;
    } catch (error) {
      console.error('软删除分组失败:', error);
      return false;
    }
  }

  // 恢复分组
  async restoreGroup(id: number): Promise<Group | null> {
    try {
      await this.db
        .prepare('UPDATE groups SET is_deleted = 0, deleted_at = NULL WHERE id = ?')
        .bind(id)
        .run();
      return this.getGroup(id);
    } catch (error) {
      console.error('恢复分组失败:', error);
      return null;
    }
  }

  // 彻底删除分组
  async deleteGroupPermanently(id: number): Promise<boolean> {
    try {
      // 检查是否为受保护的分组 (使用 is_protected 标志)
      const group = await this.getGroup(id);
      if (group?.is_protected === 1) {
        throw new Error('此分组是受保护的，不允许彻底删除');
      }

      await this.db.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
      return true;
    } catch (error) {
      console.error('彻底删除分组失败:', error);
      return false;
    }
  }

  // 获取回收站中的分组
  async getTrashGroups(userId?: number): Promise<Group[]> {
    console.log(`[DEBUG] getTrashGroups called for userId: ${userId}`);
    // Use LEFT JOIN to count sites that are NOT deleted (or were deleted with the group)
    // Actually, if a group is soft-deleted, its sites are usually NOT soft-deleted individually
    // but hidden because the group is hidden.
    // So we just count sites where is_deleted is 0 or NULL
    let query = `
      SELECT g.*, COUNT(s.id) as site_count
      FROM groups g
      LEFT JOIN sites s ON g.id = s.group_id AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
      WHERE g.is_deleted = 1
    `;
    const params: number[] = [];

    if (userId !== undefined) {
      query += ' AND g.user_id = ?';
      params.push(userId);
    }

    query += ' GROUP BY g.id ORDER BY g.deleted_at DESC';

    try {
      // Use raw query result mapping if needed, but D1 usually handles this well
      const result = await this.db.prepare(query).bind(...params).all<Group>();
      console.log(`[DEBUG] getTrashGroups result count: ${result.results?.length}`);
      return result.results || [];
    } catch (error) {
      console.error('[ERROR] getTrashGroups failed:', error);
      return [];
    }
  }

  // 网站相关 API
  async getSites(groupId?: number, userId?: number): Promise<Site[]> {
    let query = `
      SELECT s.id, s.group_id, s.name, s.url, s.icon, s.description, s.notes, s.order_num, s.is_public, s.is_featured, s.last_clicked_at, s.created_at, s.updated_at 
      FROM sites s
    `;

    if (userId !== undefined) {
      query += ` JOIN groups g ON s.group_id = g.id WHERE g.user_id = ? AND (s.is_deleted = 0 OR s.is_deleted IS NULL)`;
    } else {
      query += ` WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)`;
    }

    const params: (string | number)[] = userId !== undefined ? [userId] : [];

    if (groupId !== undefined) {
      query += ' AND s.group_id = ?';
      params.push(groupId);
    }

    query += ' ORDER BY s.order_num';

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Site>();
    return result.results || [];
  }

  /**
   * 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
   * 返回格式: GroupWithSites[] (每个分组包含其站点数组)
   */
  // 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
  async getGroupsWithSites(userId?: number): Promise<GroupWithSites[]> {
    // 使用 LEFT JOIN 一次性获取所有数据
    const query = `
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.order_num as group_order,
        g.is_public as group_is_public,
        g.is_protected as group_is_protected,
        g.created_at as group_created_at,
        g.updated_at as group_updated_at,
        s.id as site_id,
        s.name as site_name,
        s.url as site_url,
        s.icon as site_icon,
        s.description as site_description,
        s.notes as site_notes,
        s.order_num as site_order,
        s.is_public as site_is_public,
        s.last_clicked_at as site_last_clicked_at,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at,
        s.is_featured as site_is_featured
      FROM groups g
      LEFT JOIN sites s ON g.id = s.group_id AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
      WHERE (g.is_deleted = 0 OR g.is_deleted IS NULL) ${userId !== undefined ? 'AND g.user_id = ?' : ''}
      ORDER BY g.order_num ASC, s.order_num ASC
    `;

    const result = await this.db.prepare(query).bind(...(userId !== undefined ? [userId] : [])).all<{
      group_id: number;
      group_name: string;
      group_order: number;
      group_is_public?: number;
      group_is_protected: number;
      group_created_at: string;
      group_updated_at: string;
      site_id: number | null;
      site_name: string | null;
      site_url: string | null;
      site_icon: string | null;
      site_description: string | null;
      site_notes: string | null;
      site_order: number | null;
      site_is_public?: number;
      site_is_featured?: number;
      site_last_clicked_at: string | null;
      site_created_at: string | null;
      site_updated_at: string | null;
    }>();

    // 将查询结果转换为 GroupWithSites 格式
    const groupsMap = new Map<number, GroupWithSites>();

    for (const row of result.results || []) {
      // 如果分组不存在,创建它
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          order_num: row.group_order,
          is_public: row.group_is_public,
          is_protected: row.group_is_protected,
          created_at: row.group_created_at,
          updated_at: row.group_updated_at,
          sites: [],
        });
      }

      // 如果有站点数据,添加到分组的 sites 数组
      if (row.site_id !== null) {
        const group = groupsMap.get(row.group_id)!;
        group.sites.push({
          id: row.site_id,
          group_id: row.group_id,
          name: row.site_name!,
          url: row.site_url!,
          icon: row.site_icon || '',
          description: row.site_description || '',
          notes: row.site_notes || '',
          is_featured: row.site_is_featured || 0,
          order_num: row.site_order!,
          is_public: row.site_is_public,
          last_clicked_at: row.site_last_clicked_at || undefined,
          created_at: row.site_created_at!,
          updated_at: row.site_updated_at!,
        });
      }
    }

    return Array.from(groupsMap.values());
  }

  // 随机获取站点（访客模式）
  async getRandomSites(limit: number = 20): Promise<{
    site: Site;
    groupName: string;
    ownerName: string;
  }[]> {
    // 确保 groups 和 sites 都是公开的
    const query = `
      SELECT 
        s.id as site_id,
        s.group_id,
        s.name as site_name,
        s.url as site_url,
        s.icon as site_icon,
        s.description as site_description,
        s.notes as site_notes,
        s.order_num as site_order,
        s.is_public as site_is_public,
        s.last_clicked_at as site_last_clicked_at,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at,
        g.name as group_name,
        u.username as owner_name
      FROM sites s
      JOIN groups g ON s.group_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE s.is_public = 1 AND g.is_public = 1 AND s.is_featured = 1
      ORDER BY RANDOM()
      LIMIT ?
    `;

    const result = await this.db.prepare(query).bind(limit).all<{
      site_id: number;
      group_id: number;
      site_name: string;
      site_url: string;
      site_icon: string;
      site_description: string;
      site_notes: string;
      site_order: number;
      site_is_public: number;
      site_last_clicked_at: string | null;
      site_created_at: string;
      site_updated_at: string;
      group_name: string;
      owner_name: string;
    }>();

    return (result.results || []).map(row => ({
      site: {
        id: row.site_id,
        group_id: row.group_id,
        name: row.site_name,
        url: row.site_url,
        icon: row.site_icon,
        description: row.site_description,
        notes: row.site_notes,
        order_num: row.site_order,
        is_public: row.site_is_public,
        last_clicked_at: row.site_last_clicked_at || undefined,
        created_at: row.site_created_at,
        updated_at: row.site_updated_at
      },
      groupName: row.group_name,
      ownerName: row.owner_name
    }));
  }

  async getSite(id: number): Promise<Site | null> {
    const result = await this.db
      .prepare(
        'SELECT id, group_id, name, url, icon, description, notes, order_num, is_public, is_featured, last_clicked_at, created_at, updated_at FROM sites WHERE id = ?'
      )
      .bind(id)
      .first<Site>();
    return result;
  }

  async createSite(site: Site): Promise<Site> {
    // 1. 规范化 URL（小写化域名部分，移除末尾斜杠）
    const trimmedUrl = site.url.trim();
    const normalizedUrl = trimmedUrl.replace(/\/+$/, '');

    // 2. 局部查重：检查该分组下是否已存在该 URL
    const existingSite = await this.getSiteByGroupIdAndUrl(site.group_id, trimmedUrl);
    if (existingSite) {
      return existingSite;
    }

    // 3. 规范化后再次检查 (针对末尾斜杠差异)
    if (normalizedUrl !== trimmedUrl) {
      const existingNormalizedSite = await this.getSiteByGroupIdAndUrl(site.group_id, normalizedUrl);
      if (existingNormalizedSite) {
        return existingNormalizedSite;
      }
    }

    const icon = site.icon || this.getIconFromUrl(site.url);

    const result = await this.db
      .prepare(
        `
      INSERT INTO sites (group_id, name, url, icon, description, notes, order_num, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id, group_id, name, url, icon, description, notes, order_num, is_public, last_clicked_at, created_at, updated_at
    `
      )
      .bind(
        site.group_id,
        site.name,
        site.url,
        icon,
        site.description || '',
        site.notes || '',
        site.order_num,
        site.is_public ?? 1
      )
      .all<Site>();

    if (!result.results || result.results.length === 0) {
      throw new Error('创建站点失败');
    }
    const createdSite = result.results[0];
    if (!createdSite) {
      throw new Error('创建站点失败');
    }
    return createdSite;
  }

  async updateSite(id: number, site: Partial<Site>): Promise<Site | null> {
    // 字段白名单
    const ALLOWED_FIELDS = [
      'group_id',
      'name',
      'url',
      'icon',
      'description',
      'notes',
      'order_num',
      'is_public',
      'is_featured',
    ] as const;
    type AllowedField = (typeof ALLOWED_FIELDS)[number];

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    // 只允许更新白名单中的字段
    Object.entries(site).forEach(([key, value]) => {
      if (ALLOWED_FIELDS.includes(key as AllowedField) && value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        console.warn(`尝试更新不允许的字段: ${key}`);
      }
    });

    if (updates.length === 1) {
      // 只有 updated_at，没有实际更新
      throw new Error('没有可更新的字段');
    }

    // 构建安全的参数化查询
    const query = `UPDATE sites SET ${updates.join(
      ', '
    )} WHERE id = ? RETURNING id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at`;
    params.push(id);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Site>();

    if (!result.results || result.results.length === 0) {
      return null;
    }
    const updatedSite = result.results[0];
    return updatedSite || null;
  }

  async deleteSite(id: number): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    return result.success;
  }

  // Soft delete site
  async softDeleteSite(id: number): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE sites SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  async clickSite(id: number): Promise<boolean> {
    try {
      // 生成北京时间 (UTC+8)
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

      const result = await this.db
        .prepare('UPDATE sites SET last_clicked_at = ? WHERE id = ?')
        .bind(beijingTime, id)
        .run();
      return result.success;
    } catch (error) {
      console.error('记录点击时间失败:', error);
      return false;
    }
  }

  // Restore site
  async restoreSite(id: number): Promise<Site | null> {
    const result = await this.db
      .prepare('UPDATE sites SET is_deleted = 0, deleted_at = NULL WHERE id = ? RETURNING *')
      .bind(id)
      .first<Site>();
    return result || null;
  }

  // Get trash sites
  async getTrashSites(userId?: number): Promise<Site[]> {
    console.log(`[DEBUG] getTrashSites called for userId: ${userId}`);
    let query = `
      SELECT s.*
      FROM sites s
      JOIN groups g ON s.group_id = g.id
      WHERE s.is_deleted = 1
    `;
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' AND g.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY s.deleted_at DESC';

    try {
      const result = await this.db.prepare(query).bind(...params).all<Site>();
      console.log(`[DEBUG] getTrashSites result count: ${result.results?.length}`);
      return result.results || [];
    } catch (error) {
      console.error('[ERROR] getTrashSites failed:', error);
      return [];
    }
  }

  // 配置相关API
  async getConfigs(userId: number = 1): Promise<Record<string, string>> {
    // 获取全局配置(1)和当前用户配置(userId)
    // 按 user_id 升序排序，这样后续的用户配置会覆盖全局配置
    const result = await this.db
      .prepare('SELECT key, value, user_id FROM configs WHERE user_id = 1 OR user_id = ? ORDER BY user_id ASC')
      .bind(userId)
      .all<Config>();

    // 将结果转换为键值对对象
    const configs: Record<string, string> = {};
    for (const config of result.results || []) {
      configs[config.key] = config.value;
    }

    return configs;
  }

  async getConfig(key: string, userId: number = 1): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT value FROM configs WHERE key = ? AND user_id = ?')
      .bind(key, userId)
      .first<{ value: string }>();

    return result ? result.value : null;
  }

  async setConfig(key: string, value: string, userId: number = 1): Promise<boolean> {
    try {
      // 一些系统级配置强制归属于 admin (userId = 1)
      const SYSTEM_KEYS = ['DB_INITIALIZED', 'DATA_INITIALIZED'];
      const targetUserId = SYSTEM_KEYS.includes(key) ? 1 : userId;

      // 使用UPSERT语法（SQLite支持）
      const result = await this.db
        .prepare(
          `INSERT INTO configs (key, value, user_id, updated_at) 
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
                    ON CONFLICT(key, user_id) 
                    DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`
        )
        .bind(key, value, targetUserId, value)
        .run();

      return result.success;
    } catch (error) {
      console.error('设置配置失败:', error);
      return false;
    }
  }

  async deleteConfig(key: string, userId: number = 1): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM configs WHERE key = ? AND user_id = ?')
      .bind(key, userId)
      .run();

    return result.success;
  }

  // 批量更新排序
  async updateGroupOrder(groupOrders: { id: number; order_num: number }[]): Promise<boolean> {
    // 使用事务确保所有更新一起成功或失败
    return await this.db
      .batch(
        groupOrders.map((item) =>
          this.db
            .prepare('UPDATE groups SET order_num = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(item.order_num, item.id)
        )
      )
      .then(() => true)
      .catch(() => false);
  }

  async updateSiteOrder(siteOrders: { id: number; order_num: number }[]): Promise<boolean> {
    // 使用事务确保所有更新一起成功或失败
    return await this.db
      .batch(
        siteOrders.map((item) =>
          this.db
            .prepare('UPDATE sites SET order_num = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(item.order_num, item.id)
        )
      )
      .then(() => true)
      .catch(() => false);
  }

  async deleteSites(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;

    // 使用 batch 执行多个单独的更新或者使用 IN 子句
    // 考虑到 D1 的 prepare 限制，对于批量操作，使用 batch 的 prepare 列表通常更稳健
    return await this.db
      .batch(
        ids.map((id) =>
          this.db
            .prepare('UPDATE sites SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(id)
        )
      )
      .then(() => true)
      .catch((err) => {
        console.error('批量删除站点失败:', err);
        return false;
      });
  }

  async restoreSites(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;

    return await this.db
      .batch(
        ids.map((id) =>
          this.db
            .prepare('UPDATE sites SET is_deleted = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(id)
        )
      )
      .then(() => true)
      .catch((err) => {
        console.error('批量恢复站点失败:', err);
        return false;
      });
  }

  async deleteSitesPermanently(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;

    return await this.db
      .batch(
        ids.map((id) =>
          this.db
            .prepare('DELETE FROM sites WHERE id = ?')
            .bind(id)
        )
      )
      .then(() => true)
      .catch((err) => {
        console.error('批量永久删除站点失败:', err);
        return false;
      });
  }

  // 导出所有数据
  async exportData(): Promise<ExportData> {
    // 获取所有分组
    const groups = await this.getGroups();

    // 获取所有站点
    const sites = await this.getSites();

    // 获取所有配置
    const configs = await this.getConfigs();

    return {
      groups,
      sites,
      configs,
      version: '1.0', // 数据版本号，便于后续兼容性处理
      exportDate: new Date().toISOString(),
    };
  }

  // 导入所有数据
  async importData(data: ExportData, userId: number = 1): Promise<ImportResult> {
    try {
      // 1. 获取当前用户的所有现有分组和站点，用于重用或冲突检测
      const existingGroups = await this.getGroups(userId);
      const existingSites = await this.getSites(undefined, userId);

      const groupMap = new Map<number, number>(); // 旧ID -> 新ID
      const groupByName = new Map<string, Group>();
      for (const g of existingGroups) {
        groupByName.set(g.name.trim().toLowerCase(), g);
      }

      // 站点按 分组ID+URL 映射，用于冲突检测
      const siteByKey = new Map<string, Site>();
      for (const s of existingSites) {
        const key = `${s.group_id}|${s.url.trim().toLowerCase()}`;
        siteByKey.set(key, s);
      }

      const stats = {
        groups: { total: data.groups.length, created: 0, merged: 0 },
        sites: { total: data.sites.length, created: 0, updated: 0, skipped: 0 },
      };

      const siteStmts: D1PreparedStatement[] = [];
      const configStmts: D1PreparedStatement[] = [];

      // 第一步：处理分组
      // 注意：由于我们需要新创建的分组 ID 来插入站点，
      // 但 D1 batch() 不支持中间状态获取 ID。
      // 因此，我们必须先同步创建不存在的分组。
      for (const group of data.groups) {
        const normalizedName = group.name.trim().toLowerCase();
        const existing = groupByName.get(normalizedName);

        if (existing) {
          if (group.id) groupMap.set(group.id, existing.id as number);
          stats.groups.merged++;
        } else {
          // 同步创建分组以获取 ID（虽然牺牲了一点性能，但保证了逻辑正确性）
          const newGroup = await this.createGroup({
            name: group.name,
            order_num: group.order_num,
            is_public: group.is_public ?? 1
          }, userId);
          if (group.id && newGroup.id) {
            groupMap.set(group.id, newGroup.id);
          }
          stats.groups.created++;
        }
      }

      // 第二步：处理站点
      for (const site of data.sites) {
        const newGroupId = groupMap.get(site.group_id);
        if (!newGroupId) {
          stats.sites.skipped++;
          continue;
        }

        const siteKey = `${newGroupId}|${site.url.trim().toLowerCase()}`;
        const existing = siteByKey.get(siteKey);
        const icon = site.icon || this.getIconFromUrl(site.url);

        if (existing) {
          siteStmts.push(
            this.db.prepare(
              'UPDATE sites SET name = ?, icon = ?, description = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(site.name, icon, site.description || '', site.notes || '', existing.id)
          );
          stats.sites.updated++;
        } else {
          siteStmts.push(
            this.db.prepare(
              'INSERT INTO sites (group_id, name, url, icon, description, notes, order_num, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
            ).bind(
              newGroupId,
              site.name,
              site.url,
              icon,
              site.description || '',
              site.notes || '',
              site.order_num || 0,
              site.is_public ?? 1
            )
          );
          stats.sites.created++;
        }
      }

      // 第三步：处理配置
      for (const [key, value] of Object.entries(data.configs)) {
        if (key !== 'DB_INITIALIZED' && key !== 'DATA_INITIALIZED') {
          configStmts.push(
            this.db.prepare(
              `INSERT INTO configs (key, value, user_id, updated_at) 
               VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
               ON CONFLICT(key, user_id) 
               DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`
            ).bind(key, value, userId, value)
          );
        }
      }

      // 第四步：执行批量更新 (Sites + Configs)
      const allStmts = [...siteStmts, ...configStmts];
      if (allStmts.length > 0) {
        // 分批执行，防止超过 D1 100 statements 的限制
        const batchSize = 100;
        for (let i = 0; i < allStmts.length; i += batchSize) {
          await this.db.batch(allStmts.slice(i, i + batchSize));
        }
      }

      return { success: true, stats };
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // 根据名称查询分组
  // 根据名称查询分组 (不区分大小写，且忽略首尾空格)
  async getGroupByName(name: string, userId: number = 1): Promise<Group | null> {
    const result = await this.db
      .prepare('SELECT id, name, order_num, created_at, updated_at FROM groups WHERE (user_id = ? OR user_id IS NULL) AND TRIM(LOWER(name)) = TRIM(LOWER(?))')
      .bind(userId, name)
      .first<Group>();
    return result;
  }

  // 查询特定分组下是否已存在指定URL的站点
  async getSiteByGroupIdAndUrl(groupId: number, url: string): Promise<Site | null> {
    const trimmedUrl = url.trim();
    const normalizedUrl = trimmedUrl.replace(/\/+$/, '');

    const result = await this.db
      .prepare(
        'SELECT id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at FROM sites WHERE group_id = ? AND (url = ? OR url = ? OR url = ? OR url = ?)'
      )
      .bind(groupId, trimmedUrl, normalizedUrl, normalizedUrl + '/', trimmedUrl + '/')
      .first<Site>();
    return result;
  }

  /**
   * 清空当前用户的所有数据 (分组和站点)
   * 利用外键级联删除 (ON DELETE CASCADE)
   */
  async clearAllData(userId: number): Promise<boolean> {
    try {
      // 1. 删除当前用户的所有分组 (会触发表定义中的 ON DELETE CASCADE 级联删除 sites)
      await this.db.prepare('DELETE FROM groups WHERE user_id = ?').bind(userId).run();

      // 2. 重新插入默认数据 for this user，防止页面完全空白
      // 这里我们复用 initDB 的逻辑部分，或者手动插入一个
      await this.db.prepare(
        "INSERT INTO groups (name, order_num, is_public, user_id) VALUES ('常用工具', 1, 1, ?)"
      ).bind(userId).run();

      return true;
    } catch (error) {
      console.error('清空数据失败:', error);
      return false;
    }
  }

  /**
   * 批量更新站点属性
   */
  async batchUpdateSites(ids: number[], data: Partial<Site>): Promise<{ success: boolean; message: string; count: number }> {
    try {
      if (!ids.length) return { success: true, message: '没有选中的站点', count: 0 };

      const keys = Object.keys(data);
      if (keys.length === 0) return { success: true, message: '没有需要更新的内容', count: 0 };

      // Generate base update parts
      const updates: string[] = [];
      const baseValues: any[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          baseValues.push(value);
        }
      }
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const updateClause = updates.join(', ');
      const query = `UPDATE sites SET ${updateClause} WHERE id = ?`;

      // Create individual statements for each ID
      const stmts = ids.map(id => {
        // Values for this specific statement: base values + current ID
        return this.db.prepare(query).bind(...baseValues, id);
      });

      console.log(`[Worker Debug] Batch updating ${stmts.length} sites with query: ${query}`);

      // Execute as a batch
      const results = await this.db.batch(stmts);

      // Check results
      const success = results.every(r => r.success);
      if (!success) {
        throw new Error('部分或全部更新失败');
      }

      return { success: true, message: '批量更新成功', count: ids.length };
    } catch (error) {
      console.error('Failed to batch update sites:', error);
      return { success: false, message: '批量更新失败: ' + (error instanceof Error ? error.message : String(error)), count: 0 };
    }
  }

  /**
   * 批量更新所有站点的图标为统一 API 格式
   * 格式: https://www.faviconextractor.com/favicon/{domain}
   */
  async batchUpdateIcons(userId?: number): Promise<{ success: boolean; count: number }> {
    try {
      // 1. 获取该用户的所有站点 (已包含 userId 过滤)
      const sites = await this.getSites(undefined, userId);
      const stmts: D1PreparedStatement[] = [];

      // 提取域名的简单逻辑
      const getDomain = (url: string) => {
        try {
          const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im);
          return match && match[1] ? match[1] : null;
        } catch {
          return null;
        }
      };

      // 2. 准备批量更新语句
      for (const site of sites) {
        if (site.id && site.url) {
          const domain = getDomain(site.url);
          if (domain) {
            const newIcon = `https://www.faviconextractor.com/favicon/${domain}`;
            if (site.icon !== newIcon) {
              stmts.push(
                this.db
                  .prepare('UPDATE sites SET icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                  .bind(newIcon, site.id)
              );
            }
          }
        }
      }

      if (stmts.length > 0) {
        await this.db.batch(stmts);
      }

      return { success: true, count: stmts.length };
    } catch (error) {
      console.error('批量更新图标失败:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * 根据 URL 自动生成图标链接
   */
  private getIconFromUrl(url: string): string {
    try {
      const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im);
      const domain = match && match[1] ? match[1] : null;
      return domain ? `https://www.faviconextractor.com/favicon/${domain}` : '';
    } catch {
      return '';
    }
  }
}

// 创建 API 辅助函数
export function createAPI(env: Env): NavigationAPI {
  return new NavigationAPI(env);
}
