import { Group, Site, LoginResponse, RegisterResponse, ResetPasswordResponse, ExportData, ImportResult, GroupWithSites, SendCodeResponse, UserListItem } from './db';
import { NavigationClient } from './client';
import { mockGroups as importedMockGroups, mockSites as importedMockSites, mockConfigs as importedMockConfigs } from './mockData';

// 本地存储键名
const STORAGE_KEYS = {
  GROUPS: 'mock_groups',
  SITES: 'mock_sites',
  CONFIGS: 'mock_configs',
};

// 从localStorage加载数据，如果不存在则使用导入的mock数据
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn(`解析localStorage数据失败: ${key}`, e);
      }
    }
  }
  return defaultValue;
}

// 保存数据到localStorage
function saveToStorage<T>(key: string, data: T): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`保存localStorage数据失败: ${key}`, e);
    }
  }
}

// 使用localStorage持久化的mock数据
const mockGroups: Group[] = loadFromStorage(STORAGE_KEYS.GROUPS, [...importedMockGroups]);
const mockSites: Site[] = loadFromStorage(STORAGE_KEYS.SITES, [...importedMockSites]);
const mockConfigs: Record<string, string> = loadFromStorage(STORAGE_KEYS.CONFIGS, { ...importedMockConfigs });

// 保存当前状态的辅助函数
function saveGroupsToStorage(): void {
  saveToStorage(STORAGE_KEYS.GROUPS, mockGroups);
}

function saveSitesToStorage(): void {
  saveToStorage(STORAGE_KEYS.SITES, mockSites);
}

function saveConfigsToStorage(): void {
  saveToStorage(STORAGE_KEYS.CONFIGS, mockConfigs);
}

// 模拟API实现
export class MockNavigationClient extends NavigationClient {
  private token: string | null = null;
  public isAuthenticated: boolean = false; // 公开认证状态
  // baseUrl is inherited

  constructor() {
    super(); // 必须调用父类构造函数
    // 从本地存储加载令牌
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
      this.isAuthenticated = !!this.token;
    }
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!this.token;
  }

  // 设置认证令牌
  setToken(token: string): void {
    this.token = token;
    this.isAuthenticated = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  // 清除认证令牌
  async logout(): Promise<void> {
    this.token = null;
    this.isAuthenticated = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // 登录API
  async login(
    username: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<LoginResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(username, password, rememberMe ? '记住登录' : '标准登录');
    // 模拟登录验证逻辑 - 在Mock环境中任何账号密码都能登录
    const token = btoa(`${username}:${new Date().getTime()}:${rememberMe}`);
    this.setToken(token);

    return {
      success: true,
      token: token,
      message: `登录成功(模拟环境)${rememberMe ? '，已记住登录状态' : ''}`,
    };
  }

  // 注册API
  async register(
    username: string,
    password: string
  ): Promise<RegisterResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('模拟注册:', username, password);
    return {
      success: true,
      message: '注册成功(模拟环境)',
    };
  }

  // 密码重置API
  async resetPassword(
    username: string,
    newPassword: string,
    code: string
  ): Promise<ResetPasswordResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('模拟密码重置:', username, newPassword, '验证码:', code);
    if (code === '123456' || code.length === 6) { // 模拟校验逻辑
      return {
        success: true,
        message: '密码重置成功(模拟环境)',
      };
    }
    return {
      success: false,
      message: '验证码错误(模拟环境：请输入6位数字)',
    };
  }

  // 发送重置验证码API
  async sendResetCode(username: string, email: string): Promise<SendCodeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('模拟发送验证码:', username, email);
    return {
      success: true,
      message: '验证码已发送(模拟环境: 123456)',
    };
  }



  // 初始化数据库（模拟）
  async initDB(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // 检查身份验证状态
  async checkAuthStatus(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 模拟真实环境中的行为：如果有token则认为已认证
    if (this.token) {
      return true;
    }

    // 开发环境中，也可以设置为总是返回true，便于开发
    // return true;

    // 没有token则需要登录
    return false;
  }

  // 获取用户信息
  async getUserProfile(userId?: number): Promise<{ username: string; email: string; role: string; avatar_url: string | null; last_login_at?: string | null }> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    // 模拟返回当前用户信息
    if (this.isAuthenticated) {
      // 尝试解析 token Payload
      console.log('[Mock GetProfile] Fetching profile for ID:', userId);
      try {
        if (this.token) {
          const parts = atob(this.token).split(':');
          if (parts.length >= 1) {
            return { username: parts[0]!, email: `${parts[0]}@example.com`, role: 'admin', avatar_url: null, last_login_at: new Date().toISOString() };
          }
        }
      } catch { }
      return { username: 'mockuser', email: 'mockuser@example.com', role: 'admin', avatar_url: null };
    }
    throw new Error('未登录');
  }

  // 获取用户邮箱（模拟）
  async getUserEmail(username: string): Promise<string | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // 简单的模拟逻辑：如果用户名不是 admin，则返回 username@example.com
    if (username) {
      return `${username}@example.com`;
    }
    return null;
  }

  // 更新用户信息
  async updateUserProfile(data: { email?: string; avatar_url?: string; userId?: number }): Promise<{ success: boolean; message?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('模拟更新用户信息:', data);
    return {
      success: true,
      message: '个人资料已更新(模拟环境)',
    };
  }

  async getGroups(): Promise<Group[]> {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 根据认证状态过滤分组
    let filtered = [...mockGroups];
    if (!this.isAuthenticated) {
      filtered = filtered.filter((g) => g.is_public === 1);
    }
    // 过滤已删除的分组
    return filtered.filter(g => !g.is_deleted);
  }

  // 获取随机推荐站点
  async getRandomSites(limit: number = 20): Promise<{
    site: Site;
    groupName: string;
    ownerName: string;
  }[]> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 随机选择站点
    const shuffled = [...mockSites].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    return selected.map(site => {
      const group = mockGroups.find(g => g.id === site.group_id);
      return {
        site,
        groupName: group?.name || '未知分组',
        ownerName: 'MockUser'
      };
    });
  }

  // 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
  async getGroupsWithSites(userId?: number, options?: { includeDeleted?: boolean }): Promise<GroupWithSites[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    let groups = [...mockGroups];
    let sites = [...mockSites];

    // 根据认证状态过滤
    if (!this.isAuthenticated) {
      // 访客只能看到公开分组下的公开站点
      groups = groups.filter((g) => g.is_public === 1);
      const publicGroupIds = groups.map((g) => g.id!);
      sites = sites.filter(
        (site) => site.is_public === 1 && publicGroupIds.includes(site.group_id)
      );
    }

    // 根据userId过滤（如果提供）
    if (userId) {
      groups = groups.filter(group => group.user_id === userId);
    }

    // 根据 includeDeleted 选项过滤已删除的分组和站点
    const includeDeleted = options?.includeDeleted ?? false;
    if (!includeDeleted) {
      groups = groups.filter(g => !g.is_deleted);
      sites = sites.filter(s => !s.is_deleted);
    }

    // 组合分组和站点
    return groups.map((group) => ({
      ...group,
      id: group.id!, // 确保 id 存在
      sites: sites.filter((site) => site.group_id === group.id),
    }));
  }

  async getGroup(id: number): Promise<Group | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockGroups.find((g) => g.id === id) || null;
  }

  async createGroup(group: Group): Promise<Group> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const newGroup = {
      ...group,
      id: Math.max(0, ...mockGroups.map((g) => g.id || 0)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGroups.push(newGroup);
    saveGroupsToStorage();
    return newGroup;
  }

  async updateGroup(id: number, group: Partial<Group>): Promise<Group | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const existing = mockGroups[index];
    if (!existing) return null;

    mockGroups[index] = {
      ...existing,
      ...group,
      updated_at: new Date().toISOString(),
    };
    const updated = mockGroups[index];
    saveGroupsToStorage();
    return updated || null;
  }

  async deleteGroup(id: number): Promise<boolean> {
    return this.softDeleteGroup(id);
  }

  async softDeleteGroup(id: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) return false;

    const existing = mockGroups[index];
    if (existing) {
      mockGroups[index] = {
        ...existing,
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      };
      saveGroupsToStorage();
    }
    return true;
  }

  async restoreGroup(id: number): Promise<Group | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const existing = mockGroups[index];
    if (existing) {
      mockGroups[index] = {
        ...existing,
        is_deleted: 0,
        deleted_at: undefined
      };
      saveGroupsToStorage();
      return mockGroups[index];
    }
    return null;
  }

  async deleteGroupPermanently(id: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) return false;

    mockGroups.splice(index, 1);
    saveGroupsToStorage();
    return true;
  }

  async getTrashGroups(): Promise<Group[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockGroups.filter(g => g.is_deleted === 1).sort((a, b) => {
      return new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime();
    });
  }

  async getSites(groupId?: number): Promise<Site[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    let sites = [...mockSites];

    // 根据认证状态过滤站点
    if (!this.isAuthenticated) {
      // 访客只能看到公开分组下的公开站点
      const publicGroupIds = mockGroups.filter((g) => g.is_public === 1).map((g) => g.id);

      sites = sites.filter(
        (site) => site.is_public === 1 && publicGroupIds.includes(site.group_id)
      );
    }

    // 过滤掉已删除的站点
    sites = sites.filter(s => !s.is_deleted);

    // 按分组过滤
    if (groupId) {
      return sites.filter((site) => site.group_id === groupId);
    }

    return sites;
  }

  // 实现其他方法，与NavigationClient保持一致的接口...
  async getSite(id: number): Promise<Site | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockSites.find((s) => s.id === id) || null;
  }

  async createSite(site: Site): Promise<Site> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const newSite = {
      ...site,
      id: Math.max(0, ...mockSites.map((s) => s.id || 0)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSites.push(newSite);
    saveSitesToStorage();
    return newSite;
  }

  async updateSite(id: number, site: Partial<Site>): Promise<Site | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockSites.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = mockSites[index];
    if (!existing) return null;

    mockSites[index] = {
      ...existing,
      ...site,
      updated_at: new Date().toISOString(),
    };
    const updated = mockSites[index];
    saveSitesToStorage();
    return updated || null;
  }

  async softDeleteSite(id: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockSites.findIndex((s) => s.id === id);
    if (index === -1) return false;

    const existing = mockSites[index];
    if (existing) {
      mockSites[index] = {
        ...existing,
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      };
      saveSitesToStorage();
    }
    return true;
  }

  // 保持兼容性，deleteSite 指向 softDeleteSite
  async deleteSite(id: number): Promise<boolean> {
    return this.softDeleteSite(id);
  }

  async restoreSite(id: number): Promise<Site | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockSites.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = mockSites[index];
    if (existing) {
      mockSites[index] = {
        ...existing,
        is_deleted: 0,
        deleted_at: undefined
      };
      saveSitesToStorage();
      return mockSites[index];
    }
    return null;
  }

  async getTrashSites(): Promise<Site[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    // 简单模拟，忽略 userId 过滤（假设都是当前用户的）
    return mockSites.filter(s => s.is_deleted === 1).sort((a, b) => {
      return new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime();
    });
  }

  async deleteSitePermanently(id: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = mockSites.findIndex((s) => s.id === id);
    if (index === -1) return false;

    mockSites.splice(index, 1);
    saveSitesToStorage();
    return true;
  }

  async clickSite(id: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const index = mockSites.findIndex((s) => s.id === id);
    if (index !== -1) {
      const site = mockSites[index];
      if (site) {
        // 生成北京时间 (UTC+8)
        const now = new Date();
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '');
        site.last_clicked_at = beijingTime;
        saveSitesToStorage();
        return true;
      }
    }
    return false;
  }

  async deleteSites(ids: number[]): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const id of ids) {
      const index = mockSites.findIndex((s) => s.id === id);
      if (index !== -1) {
        const existing = mockSites[index];
        if (existing) {
          mockSites[index] = {
            ...existing,
            is_deleted: 1,
            deleted_at: new Date().toISOString()
          };
        }
      }
    }
    saveSitesToStorage();
    return true;
  }

  async deleteSitesPermanently(ids: number[]): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const id of ids) {
      const index = mockSites.findIndex((s) => s.id === id);
      if (index !== -1) {
        mockSites.splice(index, 1);
      }
    }
    saveSitesToStorage();
    return true;
  }

  async restoreSites(ids: number[]): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const id of ids) {
      const index = mockSites.findIndex((s) => s.id === id);
      if (index !== -1) {
        const existing = mockSites[index];
        if (existing) {
          mockSites[index] = {
            ...existing,
            is_deleted: 0,
            deleted_at: undefined,
            updated_at: new Date().toISOString(),
          };
        }
      }
    }
    saveSitesToStorage();
    return true;
  }

  async updateGroupOrder(groupOrders: { id: number; order_num: number }[]): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const order of groupOrders) {
      const index = mockGroups.findIndex((g) => g.id === order.id);
      if (index !== -1) {
        const group = mockGroups[index];
        if (group) {
          group.order_num = order.order_num;
        }
      }
    }
    saveGroupsToStorage();
    return true;
  }

  async updateSiteOrder(siteOrders: { id: number; order_num: number }[]): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const order of siteOrders) {
      const index = mockSites.findIndex((s) => s.id === order.id);
      if (index !== -1) {
        const site = mockSites[index];
        if (site) {
          site.order_num = order.order_num;
        }
      }
    }
    saveSitesToStorage();
    return true;
  }

  // 配置相关API
  async getConfigs(): Promise<Record<string, string>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { ...mockConfigs };
  }

  async getConfig(key: string): Promise<string | null> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockConfigs[key] || null;
  }

  async setConfig(key: string, value: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockConfigs[key] = value;
    saveConfigsToStorage();
    return true;
  }

  async deleteConfig(key: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (key in mockConfigs) {
      delete mockConfigs[key];
      saveConfigsToStorage();
      return true;
    }
    return false;
  }

  // 数据导出
  async exportData(): Promise<ExportData> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      groups: [...mockGroups],
      sites: [...mockSites],
      configs: { ...mockConfigs },
      version: '1.0',
      exportDate: new Date().toISOString(),
    };
  }

  // 清空所有数据 (模拟)
  async clearAllData(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    mockGroups.length = 0;
    mockSites.length = 0;

    // 模拟后端重新创建一个默认分组
    const defaultGroup = {
      id: 1,
      name: '常用工具',
      order_num: 1,
      is_public: 1,
      user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGroups.push(defaultGroup);

    saveGroupsToStorage();
    saveSitesToStorage();
    return true;
  }

  async batchMaintenance(ids: number[], options: any = {}): Promise<{ success: boolean; results: any[] }> {
    console.log('Mock batch maintenance:', ids, options);
    return { success: true, results: [] };
  }

  async batchSyncSiteInfo(updates: any[]): Promise<boolean> {
    console.log('Mock batch sync info:', updates);
    return true;
  }

  async getAdminUsers(): Promise<UserListItem[]> {
    return [
      { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', avatar_url: null, created_at: new Date().toISOString(), last_login_at: new Date().toISOString(), login_count: 42, group_count: mockGroups.length, site_count: mockSites.length, ai_usage_count: 0 }
    ];
  }

  async getAIModels(): Promise<string[]> {
    return ['gemini-3.1-pro-high', 'kimi-k2.5', 'claude-sonnet-4-6', 'gemini-2.5-flash'];
  }

  async fetchSiteInfo(url: string): Promise<any> {
    console.log('Mock fetch site info:', url);
    return { success: true, name: 'Mock Site', description: 'Mock Description', icon: '' };
  }

  async fetchSiteInfoDirectly(url: string): Promise<any> {
    console.log('Mock fetch site info directly:', url);
    return { success: true, name: 'Mock Site (Direct)', description: 'Mock Description', icon: '' };
  }

  async batchUpdateIcons(): Promise<{ success: boolean; count: number }> {
    return { success: true, count: 0 };
  }

  // 数据导入
  async importData(data: ExportData): Promise<ImportResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      // 统计信息
      const stats = {
        groups: {
          total: data.groups.length,
          created: 0,
          merged: 0,
        },
        sites: {
          total: data.sites.length,
          created: 0,
          updated: 0,
          skipped: 0,
        },
      };

      // 模拟合并处理
      // 为分组创建映射 - 旧ID到新ID
      const groupMap = new Map<number, number>();

      // 处理分组
      for (const importGroup of data.groups) {
        // 检查是否存在同名分组
        const existingGroupIndex = mockGroups.findIndex((g) => g.name === importGroup.name);

        if (existingGroupIndex >= 0) {
          // 已存在同名分组，添加到映射
          const existingGroup = mockGroups[existingGroupIndex];
          if (importGroup.id && existingGroup && existingGroup.id) {
            groupMap.set(importGroup.id, existingGroup.id);
          }
          stats.groups.merged++;
        } else {
          // 创建新分组
          const newId = Math.max(0, ...mockGroups.map((g) => g.id || 0)) + 1;
          const newGroup = {
            ...importGroup,
            id: newId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          mockGroups.push(newGroup);

          // 添加到映射
          if (importGroup.id) {
            groupMap.set(importGroup.id, newId);
          }
          stats.groups.created++;
        }
      }

      // 处理站点
      for (const importSite of data.sites) {
        // 获取新分组ID
        const newGroupId = groupMap.get(importSite.group_id);

        // 如果没有映射的分组ID，跳过该站点
        if (!newGroupId) {
          stats.sites.skipped++;
          continue;
        }

        // 检查是否有相同URL的站点在同一分组下
        const existingSiteIndex = mockSites.findIndex(
          (s) => s.group_id === newGroupId && s.url === importSite.url
        );

        if (existingSiteIndex >= 0) {
          // 更新现有站点
          const existingSite = mockSites[existingSiteIndex];
          if (existingSite) {
            mockSites[existingSiteIndex] = {
              ...existingSite,
              name: importSite.name,
              icon: importSite.icon,
              description: importSite.description,
              notes: importSite.notes,
              updated_at: new Date().toISOString(),
            };
            stats.sites.updated++;
          }
        } else {
          // 创建新站点
          const newId = Math.max(0, ...mockSites.map((s) => s.id || 0)) + 1;
          const newSite = {
            ...importSite,
            id: newId,
            group_id: newGroupId, // 使用新的分组ID
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          mockSites.push(newSite);
          stats.sites.created++;
        }
      }

      // 导入配置数据
      Object.entries(data.configs).forEach(([key, value]) => {
        mockConfigs[key] = value;
      });

      // 保存所有数据
      saveGroupsToStorage();
      saveSitesToStorage();
      saveConfigsToStorage();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('模拟导入数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // AI 智能问答 (流式 - 模拟)
  async chatStream(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _history: { role: string; content: string }[],
    onUpdate: (text: string) => void
  ): Promise<void> {
    // 复用 chat 方法获取完整回复
    const result = await this.chat(message, []);
    if (!result.success || !result.reply) return;

    const reply = result.reply;
    const chunkSize = 5; // 每次发送5个字符
    let current = 0;

    return new Promise<void>((resolve) => {
      // onUpdate(''); // 移除初始化调用，模拟真实网络延迟
      const interval = setInterval(() => {
        if (current >= reply.length) {
          clearInterval(interval);
          resolve();
          return;
        }
        const chunk = reply.slice(current, current + chunkSize);
        onUpdate(chunk);
        current += chunkSize;
      }, 30); // 每30ms发送一次
    });
  }

  // AI 智能问答（模拟）
  async chat(
    message: string,
    _history: { role: string; content: string }[] = []
  ): Promise<{ success: boolean; reply?: string; message?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 简单的模拟回复
    const lowerMessage = message.toLowerCase();
    let reply = '';

    if (lowerMessage.includes('书签') || lowerMessage.includes('网站') || lowerMessage.includes('推荐')) {
      const siteNames = mockSites.slice(0, 5).map(s => s.name).join('、');
      reply = `根据你的书签库，我找到了这些相关网站：${siteNames}。你想了解哪个网站的详细信息？`;
    } else if (lowerMessage.includes('你好') || lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      reply = '你好！我是 NavTools 智能助手 🤖 我可以帮你搜索书签、推荐网站，或者回答其他问题。有什么可以帮你的？';
    } else {
      reply = `这是一个模拟回复（开发模式）。你说的是："${message}"。在生产环境中，这里会调用 Cloudflare Workers AI 来生成真实的回答。`;
    }

    return { success: true, reply };
  }

  async batchUpdateSites(ids: number[], data: Partial<Site>): Promise<{ success: boolean; message: string; count: number }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    for (const id of ids) {
      const index = mockSites.findIndex((s) => s.id === id);
      if (index !== -1) {
        const existing = mockSites[index];
        if (existing) {
          mockSites[index] = {
            ...existing,
            ...data,
            updated_at: new Date().toISOString(),
          };
        }
      }
    }
    saveSitesToStorage();
    return { success: true, message: '批量更新成功(模拟环境)', count: ids.length };
  }
}
