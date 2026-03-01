import { Group, Site, LoginResponse, RegisterResponse, ResetPasswordResponse, ExportData, ImportResult, GroupWithSites, SendCodeResponse, UserListItem } from './http';
export type { Site };

export class NavigationClient {
  protected baseUrl: string;
  public isAuthenticated: boolean = false; // 新增：公开认证状态

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    // 不再使用 localStorage 存储 token，改用 HttpOnly Cookie
  }

  // 检查是否已登录（通过尝试请求来判断）
  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  // 登录API
  async login(
    username: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 重要：包含 Cookie
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data: LoginResponse = await response.json();

      // 根据登录结果更新认证状态
      this.isAuthenticated = data.success === true;

      // Cookie 会自动由浏览器设置，无需手动处理
      return data;
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        message: '登录请求失败，请检查网络连接',
      };
    }
  }

  // 注册API
  async register(username: string, password: string, email: string): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, email }),
      });

      const data: RegisterResponse = await response.json();
      return data;
    } catch (error) {
      console.error('注册失败:', error);
      return { success: false, message: '注册请求失败，请检查网络连接' };
    }
  }

  // 密码重置API
  async resetPassword(username: string, newPassword: string, code: string): Promise<ResetPasswordResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, newPassword, code }),
      });

      const data: ResetPasswordResponse = await response.json();
      return data;
    } catch (error) {
      console.error('密码重置失败:', error);
      return { success: false, message: '密码重置请求失败，请检查网络连接' };
    }
  }

  // 发送重置验证码API
  async sendResetCode(username: string, email: string): Promise<SendCodeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email }),
      });

      const data: SendCodeResponse = await response.json();
      return data;
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, message: '发送验证码请求失败，请检查网络连接' };
    }
  }

  // 登出
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      // 登出成功，更新认证状态
      this.isAuthenticated = false;
    } catch (error) {
      console.error('登出失败:', error);
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Cookie 会自动包含在请求中，无需手动设置
    console.log(`[API Request] ${options.method || 'GET'} ${this.baseUrl}/${endpoint}`, options.body ? `Payload: ${options.body}` : '');

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      headers,
      credentials: 'include', // 重要：自动包含 Cookie
      ...options,
    });

    if (response.status === 401) {
      // 认证失败
      this.isAuthenticated = false;

      // 对于 GET 请求（只读操作），允许返回数据而不抛出异常 (如果后端允许访客访问)
      if (!options.method || options.method === 'GET') {
        try {
          // 这里返回 JSON，即使状态码是 401，后端可能仍然返回了公开数据
          return await response.json();
        } catch {
          return endpoint.includes('config') ? {} : [];
        }
      }

      throw new Error('认证已过期或无效，请重新登录');
    }

    if (!response.ok) {
      let errorMessage = `API错误: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // 无法解析 JSON，使用默认错误信息
      }
      console.error('[Client Debug] Backend returned error:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  }

  // 获取随机推荐站点
  async getRandomSites(limit: number = 20): Promise<{
    site: Site;
    groupName: string;
    ownerName: string;
  }[]> {
    const response = await fetch(`${this.baseUrl}/sites/random?limit=${limit}`);
    if (!response.ok) {
      throw new Error('获取推荐内容失败');
    }
    return response.json();
  }

  // 初始化数据库
  async initDB(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/init`, { method: 'GET' });
    } catch (error) {
      console.error('初始化数据库失败:', error);
    }
  }

  // 检查身份验证状态
  async checkAuthStatus(): Promise<boolean> {
    try {
      // 调用专门的认证状态检查端点
      const response = await fetch(`${this.baseUrl}/auth/status`, {
        method: 'GET',
        credentials: 'include', // 包含 Cookie
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.authenticated === true;
    } catch (error) {
      console.log('认证状态检查失败:', error);
      return false;
    }
  }

  async getUserProfile(userId?: number): Promise<{ username: string; email: string; role: string; avatar_url: string | null; last_login_at?: string | null }> {
    const endpoint = userId ? `user/profile?userId=${userId}` : 'user/profile';
    return this.request(endpoint) as Promise<{ username: string; email: string; role: string; avatar_url: string | null; last_login_at?: string | null }>;
  }

  // 获取所有用户 (管理员专用)
  async getAdminUsers(): Promise<UserListItem[]> {
    return this.request('admin/users');
  }

  // 获取用户邮箱（公开接口，用于密码重置）
  async getUserEmail(username: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/email?username=${encodeURIComponent(username)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.email || null;
    } catch {
      return null;
    }
  }

  // 更新用户信息
  async updateUserProfile(data: { email?: string; avatar_url?: string; userId?: number }): Promise<{ success: boolean; message?: string }> {
    return this.request('user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // 分组相关API
  async getGroups(): Promise<Group[]> {
    return this.request('groups');
  }

  // 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
  async getGroupsWithSites(userId?: number, options?: { includeDeleted?: boolean }): Promise<GroupWithSites[]> {
    const params = new URLSearchParams();
    if (userId !== undefined) {
      params.set('userId', userId.toString());
    }
    if (options?.includeDeleted) {
      params.set('includeDeleted', 'true');
    }
    const endpoint = params.toString() ? `groups-with-sites?${params.toString()}` : 'groups-with-sites';
    return this.request(endpoint);
  }

  async getGroup(id: number): Promise<Group | null> {
    return this.request(`groups/${id}`);
  }

  async createGroup(group: Group): Promise<Group> {
    return this.request('groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async updateGroup(id: number, group: Partial<Group>): Promise<Group | null> {
    return this.request(`groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(group),
    });
  }

  async deleteGroup(id: number): Promise<boolean> {
    const response = await this.request(`groups/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  }

  async restoreGroup(id: number): Promise<Group | null> {
    const response = await this.request(`groups/${id}/restore`, {
      method: 'POST',
    });
    return response;
  }

  async deleteGroupPermanently(id: number): Promise<boolean> {
    const response = await this.request(`groups/${id}/permanent`, {
      method: 'DELETE',
    });
    return response.success;
  }

  async getTrashGroups(): Promise<Group[]> {
    return this.request('groups/trash');
  }

  // 网站相关API
  async getSites(groupId?: number): Promise<Site[]> {
    const endpoint = groupId ? `sites?groupId=${groupId}` : 'sites';
    return this.request(endpoint);
  }

  async getSite(id: number): Promise<Site | null> {
    return this.request(`sites/${id}`);
  }

  async createSite(site: Site): Promise<Site> {
    return this.request('sites', {
      method: 'POST',
      body: JSON.stringify(site),
    });
  }

  async updateSite(id: number, site: Partial<Site>): Promise<Site | null> {
    return this.request(`sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(site),
    });
  }

  async deleteSite(id: number): Promise<boolean> {
    const response = await this.request(`sites/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  }

  async clickSite(id: number): Promise<boolean> {
    const response = await this.request(`sites/${id}/click`, {
      method: 'POST',
    });
    return response.success;
  }

  async deleteSites(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;
    const response = await this.request('sites/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return response.success;
  }

  async restoreSites(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;
    const response = await this.request('sites/batch-restore', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return response.success;
  }

  async deleteSitesPermanently(ids: number[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;
    const response = await this.request('sites/batch-delete-permanent', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return response.success;
  }

  async batchUpdateSites(ids: number[], data: Partial<Site>): Promise<{ success: boolean; message: string; count: number }> {
    if (!ids || ids.length === 0) return { success: true, message: '没有选中的站点', count: 0 };
    return this.request('sites/batch', {
      method: 'PUT',
      body: JSON.stringify({ ids, data }),
    });
  }

  async batchSyncSiteInfo(updates: { id: number; data: Partial<Site> }[]): Promise<boolean> {
    if (!updates || updates.length === 0) return true;
    const response = await this.request('sites/batch-sync-info', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
    return response.success === true;
  }

  async restoreSite(id: number): Promise<Site | null> {
    const response = await this.request(`sites/${id}/restore`, {
      method: 'POST',
    });
    return response;
  }

  async getTrashSites(): Promise<Site[]> {
    return this.request('sites/trash');
  }

  async deleteSitePermanently(id: number): Promise<boolean> {
    const response = await this.request(`sites/${id}/permanent`, {
      method: 'DELETE',
    });
    return response.success;
  }

  // 配置相关API
  async getConfigs(): Promise<Record<string, string>> {
    return this.request('configs');
  }

  async getConfig(key: string): Promise<string | null> {
    try {
      const response = await this.request(`configs/${key}`);
      return response.value;
    } catch {
      return null;
    }
  }

  async setConfig(key: string, value: string): Promise<boolean> {
    const response = await this.request(`configs/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
    return response.success;
  }

  async deleteConfig(key: string): Promise<boolean> {
    const response = await this.request(`configs/${key}`, {
      method: 'DELETE',
    });
    return response.success;
  }

  // 批量更新排序
  async updateGroupOrder(groupOrders: { id: number; order_num: number }[]): Promise<boolean> {
    const response = await this.request('group-orders', {
      method: 'PUT',
      body: JSON.stringify(groupOrders),
    });
    return response.success;
  }

  async updateSiteOrder(siteOrders: { id: number; order_num: number }[]): Promise<boolean> {
    const response = await this.request('site-orders', {
      method: 'PUT',
      body: JSON.stringify(siteOrders),
    });
    return response.success;
  }

  // 数据导出
  async exportData(): Promise<ExportData> {
    return this.request('export');
  }

  // 数据导入
  async importData(data: ExportData): Promise<ImportResult> {
    const response = await this.request('import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  }

  // 清空所有数据
  async clearAllData(): Promise<boolean> {
    const response = await this.request('clear-all', {
      method: 'DELETE',
    });
    return response.success;
  }

  // AI 智能问答 (流式)
  async chatStream(
    message: string,
    history: { role: string; content: string }[],
    onUpdate: (text: string) => void,
    model?: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, history, model }),
      });

      if (!response.ok) {
        throw new Error('AI 服务暂不可用');
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完整的行

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              // 兼容 Cloudflare AI 和 OpenAI 格式
              const content = data.response || data.choices?.[0]?.delta?.content || '';
              if (content) {
                onUpdate(content);
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI 流式问答失败:', error);
      throw error;
    }
  }

  // AI 智能问答 (普通)
  async chat(
    message: string,
    history: { role: string; content: string }[] = [],
    model?: string
  ): Promise<{ success: boolean; reply?: string; message?: string }> {
    try {
      return await this.request('chat', {
        method: 'POST',
        body: JSON.stringify({ message, history, model }),
      });
    } catch (error) {
      console.error('AI 问答失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AI 服务暂不可用',
      };
    }
  }

  // 获取可用 AI 模型列表
  async getAIModels(): Promise<any> {
    return this.request('ai/models');
  }

  /**
   * 直接从前端获取站点元数据 (尝试绕过后端以减少日志和超时)
   * 注意: 许多站点会因为 CORS 策略拦截此请求
   */
  async fetchSiteInfoDirectly(url: string): Promise<{ success: boolean; name?: string; description?: string; icon?: string; message?: string; deadLink?: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        mode: 'cors' // 尝试 CORS 请求
      });

      clearTimeout(timeoutId);

      // 如果返回 404 或其他明确的错误代码，且不是由于 CORS 导致的
      if (!response.ok) {
        return {
          success: false,
          message: `HTTP error! status: ${response.status}`,
          deadLink: response.status === 404 || response.status === 410
        };
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const title = doc.querySelector('title')?.textContent || '';
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

      let icon = '';
      const iconEl = doc.querySelector('link[rel*="icon"]');
      if (iconEl) {
        const href = iconEl.getAttribute('href') || '';
        try {
          icon = new URL(href, url).toString();
        } catch {
          icon = href;
        }
      }

      return {
        success: true,
        name: title.trim(),
        description: description.trim(),
        icon,
        deadLink: false
      };
    } catch (error) {
      // 如果是 TypeError 且不是 AbortError (超时)，可能是由于链接失效（DNS 错误或彻底无法访问）
      // 但在前端，CORS 错误也会表现为 TypeError。
      // 我们谨慎判断：仅在明确的网络错误且非超时情况下考虑为潜在死链。
      const isAbort = error instanceof Error && error.name === 'AbortError';

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Frontend fetch failed',
        deadLink: !isAbort && error instanceof TypeError // 网络层面彻底失败（且非超时）
      };
    }
  }

  // 获取站点元数据 (后端代理版本，支持静默模式以减少日志)
  async fetchSiteInfo(url: string, options: { silent?: boolean } = {}): Promise<{ success: boolean; name?: string; description?: string; icon?: string; message?: string; deadLink?: boolean }> {
    try {
      const silentParam = options.silent ? '&silent=true' : '';
      return await this.request(`utils/fetch-site-info?url=${encodeURIComponent(url)}${silentParam}`);
    } catch (error) {
      if (!options.silent) console.error('获取站点信息失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '获取站点信息失败',
        deadLink: true,
      };
    }
  }

  async batchUpdateIcons(): Promise<{ success: boolean; count: number }> {
    const response = await this.request('utils/batch-update-icons', {
      method: 'POST',
    });
    return response;
  }

  // 批量维护站点 (后端执行，不受 CORS 限制)
  async batchMaintenance(ids: number[], options: { autoComplete?: boolean; autoClean?: boolean; silent?: boolean } = {}): Promise<{ success: boolean; results: any[] }> {
    if (!ids || ids.length === 0) return { success: true, results: [] };
    return this.request('sites/batch-maintenance', {
      method: 'POST',
      body: JSON.stringify({ ids, ...options }),
    });
  }
}

/**
 * 模拟客户端，用于前端开发和测试
 */
export class MockNavigationClient {
  public isAuthenticated: boolean = true;
  isLoggedIn() { return true; }
  async login() { return { success: true, token: 'mock-token' }; }
  async register() { return { success: true }; }
  async resetPassword() { return { success: true }; }
  async sendResetCode() { return { success: true }; }
  async logout() { this.isAuthenticated = false; }
  async getRandomSites() { return []; }
  async initDB() { }
  async checkAuthStatus() { return true; }
  async getUserProfile() { return { username: 'MockUser', email: 'mock@example.com', role: 'user', avatar_url: null }; }
  async updateUserProfile() { return { success: true }; }
  async getGroups() { return []; }
  async getGroupsWithSites(_userId?: number, _options?: { includeDeleted?: boolean }) { return []; }
  async getGroup() { return { id: 1, name: 'Mock' } as any; }
  async createGroup() { return { id: Date.now() } as any; }
  async updateGroup() { return { id: 1 } as any; }
  async deleteGroup() { return true; }
  async restoreGroup() { return { id: 1 } as any; }
  async deleteGroupPermanently() { return true; }
  async getTrashGroups() { return []; }
  async getSites() { return []; }
  async getSite() { return { id: 1, name: 'Mock' } as any; }
  async createSite() { return { id: Date.now() } as any; }
  async updateSite() { return { id: 1 } as any; }
  async deleteSite() { return true; }
  async clickSite() { return true; }
  async deleteSites() { return true; }
  async restoreSites() { return true; }
  async deleteSitesPermanently() { return true; }
  async batchUpdateSites() { return { success: true, message: '', count: 0 }; }
  async batchSyncSiteInfo() { return true; }
  async restoreSite() { return { id: 1 } as any; }
  async getTrashSites() { return []; }
  async deleteSitePermanently() { return true; }
  async getConfigs() { return {}; }
  async getConfig() { return null; }
  async setConfig() { return true; }
  async deleteConfig() { return true; }
  async updateGroupOrder() { return true; }
  async updateSiteOrder() { return true; }
  async exportData() { return {} as any; }
  async importData() { return { success: true, message: '' }; }
  async clearAllData() { return true; }
  async chatStream() { }
  async chat() { return { success: true }; }
  async getAIModels() { return []; }
  async fetchSiteInfo() { return { success: true }; }
  async fetchSiteInfoDirectly() { return { success: false, message: 'Mock' }; }
  async batchUpdateIcons() { return { success: true, count: 0 }; }
  async batchMaintenance() { return { success: true, results: [] }; }
  async getAdminUsers(): Promise<UserListItem[]> { return []; }
}
