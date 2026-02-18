import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { NavigationClient } from './API/client';
import { MockNavigationClient } from './API/mock';
import { Site, Group } from './API/http';
import { parseBookmarks, BookmarkGroup } from './utils/bookmarkParser';
import { GroupWithSites } from './types';
import ThemeToggle from './components/ThemeToggle';
import GroupCard from './components/GroupCard';
import SiteCard from './components/SiteCard';
import ModernLayout from './layouts/ModernLayout';
import ClassicLayout from './layouts/ClassicLayout';

// 懒加载大型组件
const LoginForm = lazy(() => import('./components/LoginForm'));
const VisitorHome = lazy(() => import('./components/VisitorHome'));
const UserAvatar = lazy(() => import('./components/UserAvatar'));
const AddGroupDialog = lazy(() => import('./components/AddGroupDialog'));
import SearchBox from './components/SearchBox';
const AIChatPanel = lazy(() => import('./components/AIChatPanel'));
import EditGroupDialog from './components/EditGroupDialog';
import SiteSettingsModal from './components/SiteSettingsModal';

import { sanitizeCSS, isSecureUrl, extractDomain } from './utils/url';
import { SearchResultItem } from './utils/search';
import './App.css';

// 缓存相关的常量和辅助函数
const CACHE_CONFIG_KEY = 'nav_configs_cache';
const CACHE_DATA_KEY = 'nav_data_cache';
const CACHE_PROFILE_KEY = 'nav_profile_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时
const IMPORT_TASK_KEY = 'navtools_import_task';

const saveToCache = (key: string, data: any) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('保存缓存失败:', e);
  }
};

const loadFromCache = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    // 检查是否过期
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('尝试加载缓存失败:', e);
    return null;
  }
};

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableGroupItem from './components/SortableGroupItem';
import PageSkeleton from './components/LoadingSkeleton';
// Material UI 导入
import {

  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stack,
  createTheme,
  ThemeProvider,
  CssBaseline,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,

  Snackbar,
  InputAdornment,
  Slider,
  FormControlLabel,
  Switch,
  Fab,
  Zoom,
  Fade,
  useScrollTrigger,
  Tabs,
  Tab,
  LinearProgress,
  Paper,
  Tooltip,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';


import CancelIcon from '@mui/icons-material/Cancel';
import GitHubIcon from '@mui/icons-material/GitHub';
import CloseIcon from '@mui/icons-material/Close';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import RecommendIcon from '@mui/icons-material/Recommend';

// 根据环境选择使用真实API还是模拟API
// @cloudflare/vite-plugin 在 npm run dev 时自动代理 Worker + 本地 D1
// 设置 VITE_USE_MOCK=true 可以回退到 mock 模式
const useMockApi = import.meta.env.VITE_USE_MOCK === 'true';

const api = useMockApi
  ? new MockNavigationClient()
  : new NavigationClient('/api');

// 将全局 api 实例挂载到 window 方便调试和部分组件访问 (可选)
if (typeof window !== 'undefined') {
  (window as any).navigationApi = api;
}

// 排序模式枚举
enum SortMode {
  None, // 不排序
  GroupSort, // 分组排序
  SiteSort, // 站点排序
  CrossGroupDrag, // 跨分组拖动
}

// 默认配置
const DEFAULT_CONFIGS = {
  'site.title': 'NavTools',
  'site.name': 'NavTools',
  'site.customCss': '',
  'site.backgroundImage': '', // 背景图片URL
  'site.backgroundOpacity': '0.15', // 背景蒙版透明度
  'site.iconApi': 'https://www.faviconextractor.com/favicon/{domain}', // 默认使用的API接口
  'site.searchBoxEnabled': 'true', // 是否启用搜索框
  'ui.style': 'modern', // UI风格: 'modern' | 'classic'
  isAdmin: 'false',
};

function ScrollTop(props: { children: React.ReactElement; window?: () => Window }) {
  const { children, window } = props;
  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (
      (event.target as HTMLDivElement).ownerDocument || document
    ).querySelector('#back-to-top-anchor');

    if (anchor) {
      anchor.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 96, right: 16, zIndex: 100 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

function App() {
  // 主题模式状态
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });


  // 切换主题的回调函数
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
  };

  const [groups, setGroups] = useState<GroupWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(SortMode.None);
  const [currentSortingGroupId, setCurrentSortingGroupId] = useState<number | null>(null);

  // 新增认证状态
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // 使用 ref 追踪 groups 的最新状态，避免 handleExportData 频繁更新导致 UserAvatar 重渲染
  const groupsRef = useRef<GroupWithSites[]>(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);


  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // 注册状态
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 密码重置状态
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);

  // 访问模式状态 (readonly: 访客模式, edit: 编辑模式)
  type ViewMode = 'readonly' | 'edit';
  const [viewMode, setViewMode] = useState<ViewMode>('readonly');

  // 配置状态
  const [configs, setConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);
  const [openConfig, setOpenConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);

  // Ensure document title updates with config
  useEffect(() => {
    if (configs['site.title']) {
      document.title = configs['site.title'];
    }
  }, [configs]);

  // Create Material UI Theme
  const uiStyle = configs['ui.style'] || 'modern';

  const theme = useMemo(
    () => {
      const isModern = uiStyle === 'modern';

      // Modern Theme (Glassmorphism)
      const modernTheme = {
        palette: {
          mode: darkMode ? 'dark' : 'light' as 'dark' | 'light',
          primary: {
            main: darkMode ? '#8b5cf6' : '#6366f1', // Violet / Indigo
          },
          background: {
            default: 'transparent',
            paper: darkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.7)',
          },
        },
        shape: {
          borderRadius: 4, // Reset to default (4px base)
        },
        typography: {
          fontFamily: '"Roboto", "Inter", "Helvetica", "Arial", sans-serif',
          h1: { fontWeight: 700 },
          h2: { fontWeight: 700 },
          h3: { fontWeight: 600 },
          h4: { fontWeight: 600 },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
          button: { textTransform: 'none' as const, fontWeight: 600 },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: 'transparent',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backdropFilter: 'blur(10px)',
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--glass-shadow)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(10px)',
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--glass-shadow)',
                transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.15)',
                },
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                },
              },
              containedPrimary: {
                background: darkMode
                  ? 'linear-gradient(45deg, #8b5cf6 30%, #6366f1 90%)'
                  : 'linear-gradient(45deg, #6366f1 30%, #8b5cf6 90%)',
              }
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 16,
                backdropFilter: 'blur(16px)',
                backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                  backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
                  '& fieldset': {
                    borderColor: 'rgba(128, 128, 128, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                  },
                },
              },
            },
          },
        },
      };

      // Classic Theme (Restored)
      const classicTheme = {
        palette: {
          mode: darkMode ? 'dark' : 'light' as 'dark' | 'light',
          primary: { main: '#1976d2' }, // Default Blue
          secondary: { main: '#dc004e' },
          background: {
            default: darkMode ? '#121212' : '#f5f5f5',
            paper: darkMode ? '#1e1e1e' : '#ffffff',
          },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: darkMode ? '#121212' : '#f5f5f5',
              }
            }
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              }
            }
          }
        }
      };

      return createTheme(isModern ? modernTheme : classicTheme);
    },
    [darkMode, uiStyle]
  );

  // Update body class for modern theme animation
  useEffect(() => {
    if (uiStyle === 'modern') {
      document.body.classList.add('modern-theme');
    } else {
      document.body.classList.remove('modern-theme');
    }
  }, [uiStyle]);

  // 取消导入的标记
  const isImportCancelled = useRef(false);

  // 渐进式加载状态：初始显示的分组数量
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(5);

  // 登录界面状态
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // 配置传感器，支持鼠标、触摸和键盘操作
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 移动 5px 后才触发，减少误触和闲置计算
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 新增状态管理
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [openAddSite, setOpenAddSite] = useState(false);
  // newGroup state moved to AddGroupDialog
  const [newSite, setNewSite] = useState<Partial<Site>>({
    name: '',
    url: '',
    icon: '',
    description: '',
    notes: '',
    order_num: 0,
    group_id: 0,
    is_public: 1, // 默认为公开
  });

  // 新增导入对话框状态
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importType, setImportType] = useState<'json' | 'chrome'>('json');
  const [chromeImportProgress, setChromeImportProgress] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);
  const [importRemainingSeconds, setImportRemainingSeconds] = useState<number | null>(null);

  // 全局折叠/展开指令转换版本
  const [globalToggleVersion, setGlobalToggleVersion] = useState<{ type: 'expand' | 'collapse', ts: number } | undefined>(undefined);

  // 错误提示框状态
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('error');
  // 导入结果提示框状态
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');

  // 清除所有数据确认框状态
  const [clearDataConfirmOpen, setClearDataConfirmOpen] = useState(false);

  // 打开清除数据确认框 (Memoized)
  const handleOpenResetData = useCallback(() => {
    setClearDataConfirmOpen(true);
  }, []);

  // 清除所有数据处理函数
  const handleClearAllData = async () => {
    try {
      setLoading(true);
      const success = await api.clearAllData();
      if (success) {
        handleSuccess('所有书签已清除，系统已重置');
        setClearDataConfirmOpen(false);
        // 清空后再加载一遍数据（后端会重置一个默认分组）
        await fetchData();
      } else {
        handleError('清除数据失败，请重试');
      }
    } catch (error) {
      console.error('清除所有数据失败:', error);
      handleError('操作失败，请检查网络或权限');
    } finally {
      setLoading(false);
    }
  };

  // 持久化辅助函数
  const saveImportTask = (task: any) => {
    try {
      localStorage.setItem(IMPORT_TASK_KEY, JSON.stringify({ ...task, timestamp: Date.now() }));
    } catch (e) {
      console.warn('保存任务失败:', e);
    }
  };

  const clearImportTask = () => {
    localStorage.removeItem(IMPORT_TASK_KEY);
  };

  // 恢复导入任务的函数
  const handleResumeImport = async (task: any) => {
    const { bookmarkGroups, processed, totalBookmarks, groupsCreated, groupsMerged, sitesCreated, sitesSkipped, type } = task;
    if (type !== 'chrome' || !bookmarkGroups) return;

    setImportLoading(true);
    setImportType('chrome');
    setChromeImportProgress(Math.round((processed / totalBookmarks) * 100));

    // 由于现在有了 InitialDataLoaded 栅栏，我们可以立即执行，无需延时
    runImportIteration(bookmarkGroups, processed, totalBookmarks, groupsCreated, groupsMerged, sitesCreated, sitesSkipped);
  };

  // 跨分组拖拽状态
  const [draggedSiteId, setDraggedSiteId] = useState<string | null>(null);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [dragStartGroupId, setDragStartGroupId] = useState<number | null>(null);
  const [groupToEdit, setGroupToEdit] = useState<Group | null>(null);
  const [siteToSettings, setSiteToSettings] = useState<Site | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 预加载配置到状态 (Early Config SWR)
  useEffect(() => {
    const cachedConfigs = loadFromCache(CACHE_CONFIG_KEY);
    if (cachedConfigs) {
      setConfigs(prev => ({ ...prev, ...cachedConfigs }));
      setTempConfigs(prev => ({ ...prev, ...cachedConfigs }));
    }
  }, []);

  // 页面加载完成后，检查是否有未完成的导入任务
  useEffect(() => {
    // 只有在认证通过 且 初始数据（groups/configs）加载完成后才尝试恢复
    if (isAuthenticated && isInitialDataLoaded) {
      const savedTask = localStorage.getItem(IMPORT_TASK_KEY);
      if (savedTask) {
        try {
          const task = JSON.parse(savedTask);
          if (Date.now() - task.timestamp < 3600000) { // 1小时有效期
            console.log('[Import] 检测到未完成任务，准备恢复...', task.type);
            handleResumeImport(task);
          } else {
            console.log('[Import] 任务已过期');
            clearImportTask();
          }
        } catch (e) {
          clearImportTask();
        }
      }
    }
  }, [isAuthenticated, isInitialDataLoaded]);

  // 菜单打开关闭
  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      console.log('开始检查认证状态...');

      // 尝试进行API调用,检查是否需要认证
      const result = await api.checkAuthStatus();
      console.log('认证检查结果:', result);

      if (!result) {
        // 未认证，设置为访客模式
        console.log('未认证，设置访客模式');
        api.isAuthenticated = false; // 同步 API 客户端状态
        setIsAuthenticated(false);
        setIsAdmin(false);
        setViewMode('readonly');

        // 注意：这里不再主动清空 groups，以便在刷新瞬间保持本地数据的可见性
        // 由 fetchData 根据 API 返回值决定最终内容
      } else {
        // 已认证，设置为编辑模式
        console.log('认证成功');
        api.isAuthenticated = true; // 同步 API 客户端状态
        setIsAuthenticated(true);
        setViewMode('edit');

        // 已认证情况下，尝试从缓存快速加载数据以实现 Early SWR
        const cachedData = loadFromCache(CACHE_DATA_KEY);
        if (cachedData && groups.length === 0) {
          setGroups(cachedData);
        }

        // 尝试从缓存加载用户资料 (优先显示)
        const cachedProfile = loadFromCache(CACHE_PROFILE_KEY);
        if (cachedProfile) {
          setUsername(cachedProfile.username);
          setAvatarUrl(cachedProfile.avatar_url || null);
          const adminStatus = cachedProfile.role === 'admin';
          setIsAdmin(adminStatus);
          setConfigs(prev => ({ ...prev, isAdmin: adminStatus ? 'true' : 'false' }));
        }

        // 获取详细用户资料以确定角色 (并行更新)
        try {
          const profile = await (api as any).getUserProfile();
          setUsername(profile.username);
          setAvatarUrl(profile.avatar_url || null);
          const adminStatus = profile.role === 'admin';
          setIsAdmin(adminStatus);
          setConfigs(prev => {
            const next = { ...prev, isAdmin: adminStatus ? 'true' : 'false' };
            console.log('[Debug] checkAuthStatus - Setting configs:', next);
            return next;
          });
          // 更新缓存
          saveToCache(CACHE_PROFILE_KEY, profile);
        } catch (e) {
          console.warn('获取用户资料失败，回退到默认设置:', e);
        }

        // 只有且仅当认证成功后，才加载业务数据
        await fetchData();
      }
    } catch (error) {
      console.error('认证检查及数据加载流程失败:', error);
      setIsAuthenticated(false);
      setViewMode('readonly');
    } finally {
      setIsAuthChecking(false);
      setLoading(false); // 确保 loading 也会关闭
    }
  };


  // 登录功能
  const handleLogin = async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoginLoading(true); // Use the new state variable
      setLoginError(null);

      // 调用登录接口
      const loginResponse = await api.login(username, password, rememberMe);

      if (loginResponse?.success) {
        // 登录成功，立即切换状态并关闭登录界面
        api.isAuthenticated = true; // 同步 API 客户端状态
        setIsAuthenticated(true);

        setViewMode('edit');
        setUsername(username);
        // 获取用户头像
        try {
          if (loginResponse.userId) {
            const profile = await api.getUserProfile(loginResponse.userId);
            if (profile) {
              if (profile.avatar_url) {
                setAvatarUrl(profile.avatar_url);
              }
              // 保存到缓存
              saveToCache(CACHE_PROFILE_KEY, profile);
            }
          }
        } catch (e) {
          console.warn('登录后获取用户资料失败:', e);
        }
        // 根据用户指示，只有 admin 是管理员
        const adminStatus = username === 'admin';
        setIsAdmin(adminStatus);
        setConfigs(prev => {
          const next = { ...prev, isAdmin: adminStatus ? 'true' : 'false' };
          console.log('[Debug] handleLogin - Setting configs:', next);
          return next;
        });
        setIsLoginOpen(false);
        setLoginLoading(false);

        // 如果勾选了“记住我”，保存加密后的账号密码
        if (rememberMe) {
          try {
            const credentials = btoa(`${username}:${password}`);
            localStorage.setItem('saved_credentials', credentials);
          } catch (e) {
            console.error('保存凭据失败:', e);
          }
        } else {
          localStorage.removeItem('saved_credentials');
        }

        // 单独加载数据，失败不影响登录成功状态
        try {
          await fetchData();
          await fetchConfigs();
        } catch (dataError) {
          console.error('登录后加载数据失败:', dataError);
          // 不回滚认证状态，仅提示数据加载问题
        }
      } else {
        // 登录失败
        const message = loginResponse?.message || '用户名或密码错误';
        handleError(message);
        setLoginError(message);
        setIsAuthenticated(false);
        setViewMode('readonly');
      }
    } catch (error) {
      console.error('登录失败:', error);
      handleError('登录失败: ' + (error instanceof Error ? error.message : '未知错误'));
      setIsAuthenticated(false);
      setViewMode('readonly');
    } finally {
      setLoginLoading(false); // Use the new state variable
    }
  };

  // 注册功能
  const handleRegister = async (username: string, password: string, email: string) => {
    try {
      setRegisterLoading(true);
      setRegisterError(null);
      setRegisterSuccess(null);

      const result = await api.register(username, password, email);

      if (result?.success) {
        setRegisterSuccess(result.message || '注册成功，正在自动登录...');
        // 注册成功后自动登录
        setTimeout(() => {
          handleLogin(username, password, true);
        }, 1500);
      } else {
        setRegisterError(result?.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      setRegisterError('注册失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setRegisterLoading(false);
    }
  };

  // 密码重置功能
  const handleResetPassword = async (username: string, newPassword: string, code: string) => {
    try {
      setResetPasswordLoading(true);
      setResetPasswordError(null);
      setResetPasswordSuccess(null);

      const result = await api.resetPassword(username, newPassword, code);

      if (result?.success) {
        setResetPasswordSuccess(result.message || '密码重置成功，正在自动登录...');
        // 重置成功后自动登录
        setTimeout(() => {
          handleLogin(username, newPassword, true);
        }, 500);
      } else {
        setResetPasswordError(result?.message || '密码重置失败');
      }
    } catch (error) {
      console.error('密码重置失败:', error);
      setResetPasswordError('密码重置失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // 发送重置验证码
  const handleSendCode = async (username: string, email: string) => {
    try {
      return await api.sendResetCode(username, email);
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, message: '请求失败，请稍后重试' };
    }
  };

  // 获取用户邮箱（用于自动回显）
  const handleGetEmail = async (username: string) => {
    try {
      const result = await (api as any).getUserEmail(username);
      return result;
    } catch (error) {
      console.error('获取邮箱失败:', error);
      return null;
    }
  };

  // 加载配置
  const fetchConfigs = useCallback(async () => {
    try {
      const configsData = await api.getConfigs();
      const finalConfigs = {
        ...DEFAULT_CONFIGS,
        ...configsData,
      };

      setConfigs(finalConfigs);
      setTempConfigs(finalConfigs);

      // 保存到缓存
      saveToCache(CACHE_CONFIG_KEY, configsData);
    } catch (error) {
      console.error('加载配置失败:', error);
      // 如果没有缓存也没有接口数据，使用默认配置（已经在初期状态中设置）
    }
  }, [api]);

  // 登出功能
  const handleLogout = useCallback(async () => {
    // 强制取消正在进行的导入任务
    isImportCancelled.current = true;
    setImportLoading(false);
    setChromeImportProgress(0);
    clearImportTask();

    await api.logout();
    setIsAuthenticated(false);
    setUsername('User'); // 重置用户名
    setAvatarUrl(null); // 重置头像
    setIsAdmin(false); // 显式重置管理员权限

    setViewMode('readonly'); // 切换到只读模式

    // 登出后清空数据，显示访客主页
    setGroups([]);
    localStorage.removeItem(CACHE_DATA_KEY);
    // await fetchData(); // 不再加载公开数据
    await fetchConfigs(); // 配置可能需要重置（如标题等）
    localStorage.removeItem(CACHE_PROFILE_KEY); // 清除用户资料缓存
  }, [api, fetchConfigs]);

  useEffect(() => {
    // 立即开始并行初始化
    const init = async () => {
      try {
        console.log('[Init] 启动初始化流程...');
        // 如果没有缓存数据，才展示 loading
        const hasCache = !!localStorage.getItem(CACHE_DATA_KEY);
        if (!hasCache) setLoading(true);

        setIsAuthChecking(true);

        // 1. 初始化数据库和加载基础配置
        await Promise.allSettled([
          api.initDB(),
          fetchConfigs()
        ]);

        // 2. 检查认证状态（内部会触发 fetchData）
        await checkAuthStatus();

        // 3. 标记初次数据加载完成
        setIsInitialDataLoaded(true);
        console.log('[Init] 初始化流程完成，栅栏已开启');

      } catch (error) {
        console.error('初始化失败:', error);
      } finally {
        setIsAuthChecking(false);
        setLoading(false);
      }
    };
    init();

    // 检查 URL 参数是否请求登录 (隐式入口)
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') !== null || params.get('admin') !== null) {
      setIsLoginOpen(true);
    }

    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  }, []);

  // 渐进式加载逻辑：逐步增加显示的分组数量，直到全部显示
  useEffect(() => {
    if (!loading && groups.length > visibleGroupsCount) {
      const timer = setTimeout(() => {
        // 每次增加 5 个，直到涵盖所有分组
        setVisibleGroupsCount(prev => Math.min(prev + 5, groups.length));
      }, 100); // 100ms 间隔，既能保证流畅度又能分批渲染
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, groups.length, visibleGroupsCount]);

  // 设置文档标题
  useEffect(() => {
    document.title = configs['site.title'] || '导航站';
  }, [configs]);

  // 应用自定义CSS
  useEffect(() => {
    const customCss = configs['site.customCss'];
    let styleElement = document.getElementById('custom-style');

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style';
      document.head.appendChild(styleElement);
    }

    // 使用安全的 CSS 清理函数，防止XSS攻击
    const sanitized = sanitizeCSS(customCss || '');
    styleElement.textContent = sanitized;

    // 清理函数：组件卸载时移除样式
    return () => {
      const el = document.getElementById('custom-style');
      if (el) {
        el.remove();
      }
    };
  }, [configs]);

  // 同步HTML的class以保持与现有CSS兼容
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 处理错误的函数
  const handleError = useCallback((errorMessage: string) => {
    setSnackbarSeverity('error');
    setSnackbarMessage(errorMessage);
    setSnackbarOpen(true);
    console.error(errorMessage);
  }, []);

  // 处理成功的函数
  const handleSuccess = useCallback((successMessage: string) => {
    setSnackbarSeverity('success');
    setSnackbarMessage(successMessage);
    setSnackbarOpen(true);
  }, []);

  // 关闭提示框
  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  // 后台自动补全缺失的站点信息
  const scavengeSiteInfo = useCallback(async () => {
    // 权限校验：仅在登录状态下启动自动补全和清理流程
    if (!isAuthenticated) return;

    // 找出名称或描述为空的站点
    const sitesToRefresh: Site[] = [];
    groups.forEach(group => {
      group.sites.forEach(site => {
        if (!site.name || !site.description || site.name === site.url) {
          sitesToRefresh.push(site);
        }
      });
    });

    if (sitesToRefresh.length === 0) return;

    console.log(`发现 ${sitesToRefresh.length} 个站点缺少信息，准备后台补全...`);

    // 逐个补全，避免并发过高
    for (const site of sitesToRefresh) {
      try {
        // 再次检查是否已经补全（避免重复请求）
        if (site.url) {
          const info = await api.fetchSiteInfo(site.url) as any;

          if (info.deadLink) {
            // 检查是否启用了自动清理死链
            const isAutoCleanEnabled = configs['site.autoCleanDeadLinks'] === 'true';

            if (isAutoCleanEnabled) {
              console.warn(`检测到死链，且用户开启了自动清理: ${site.url}`);

              // 1. 添加自动删除备注
              const autoNote = `系统自动识别：该网站打不开（${new Date().toLocaleString()}），已自动移动到回收站`;
              const updatedNote = site.notes ? `${site.notes}\n\n${autoNote}` : autoNote;

              // 2. 先更新备注，再删除（删除其实是移动到回收站）
              await api.updateSite(site.id!, { notes: updatedNote });
              await api.deleteSite(site.id!);

              // 3. 同步更新本地状态，从界面移除
              setGroups(prev => prev.map(g => ({
                ...g,
                sites: g.sites.filter(s => s.id !== site.id)
              })));

              handleError(`自动清理死链: ${site.name || site.url} (已移至回收站)`);
            } else {
              console.log(`检测到可能失效的链接，但自动清理未开启，跳过处理: ${site.url}`);
            }
            continue; // 继续下一个
          }

          if (info.success && (info.name || info.description)) {
            const updatedData: Partial<Site> = {
              name: site.name || info.name || '',
              description: site.description || info.description || '',
            };

            // 提交更新到服务器
            await api.updateSite(site.id!, updatedData);

            // 同步更新本地状态，让 UI 实时响应
            setGroups(prev => prev.map(g => ({
              ...g,
              sites: g.sites.map(s => s.id === site.id ? { ...s, ...updatedData } : s)
            })));

            console.log(`后台自动补全成功: ${site.url}`);
          }
        }
        // 每个请求之间稍微停顿一下，友好访问
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.warn(`后台自动补全失败 [${site.url}]:`, err);
      }
    }
  }, [groups, configs, api, isAdmin]);

  // 计算总书签数
  const totalBookmarkCount = useMemo(() => {
    return groups.reduce((total, group) => total + (group.sites?.length || 0), 0);
  }, [groups]);


  const fetchData = useCallback(async (silent = false) => {
    try {
      // 只有在完全没有数据（缓存也没）时且非静默加载才展示 loading
      if (!silent && groups.length === 0) {
        setLoading(true);
      }
      setError(null);

      // 同时也获取该用户的配置
      const userConfigs = await api.getConfigs();
      setConfigs(prev => ({ ...prev, ...userConfigs, isAdmin: isAdmin ? 'true' : 'false' }));

      // 获取所有分组和站点数据
      const groupsWithSites = await api.getGroupsWithSites();
      setGroups(groupsWithSites);

      // 只有在已认证模式下才缓存业务数据
      if (isAuthenticated) {
        saveToCache(CACHE_DATA_KEY, groupsWithSites);
        saveToCache(CACHE_CONFIG_KEY, userConfigs);
      }
    } catch (error) {
      console.error('加载数据失败:', error);

      // 仅在完全没有数据可显示时才弹出错误
      if (groups.length === 0) {
        handleError('加载数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      // 加载完成后，如果是编辑模式且已认证，触发后台自动补全
      if (viewMode === 'edit' && isAuthenticated) {
        scavengeSiteInfo();
      }
    }
  }, [isAuthenticated, viewMode, api, scavengeSiteInfo, handleError, isAdmin]);



  // 更新站点
  const handleSiteUpdate = async (updatedSite: Site) => {
    try {
      if (updatedSite.id) {
        // 查找旧的站点信息以对比变化
        let oldSite: Site | undefined;
        let oldGroupId: number | undefined;

        for (const g of groups) {
          const found = g.sites.find(s => s.id === updatedSite.id);
          if (found) {
            oldSite = found;
            oldGroupId = g.id;
            break;
          }
        }

        await api.updateSite(updatedSite.id, updatedSite);

        // 局部更新本地状态，避免 fetchData 全量刷新
        setGroups(prevGroups => {
          // 如果分组发生了变化
          if (oldGroupId !== undefined && oldGroupId !== updatedSite.group_id) {
            return prevGroups.map(group => {
              // 从旧分组移除
              if (group.id === oldGroupId) {
                return {
                  ...group,
                  sites: group.sites.filter(s => s.id !== updatedSite.id)
                };
              }
              // 添加到新分组
              if (group.id === updatedSite.group_id) {
                return {
                  ...group,
                  sites: [...group.sites, updatedSite]
                };
              }
              return group;
            });
          }

          // 如果是在同一个分组内更新
          return prevGroups.map(group => {
            if (group.id === updatedSite.group_id) {
              return {
                ...group,
                sites: group.sites.map(s => s.id === updatedSite.id ? updatedSite : s)
              };
            }
            return group;
          });
        });

        // 根据变化显示不同的提示
        if (oldSite && oldSite.is_featured !== updatedSite.is_featured) {
          handleSuccess(updatedSite.is_featured ? '已成功设为精选' : '已成功取消精选');
        } else {
          handleSuccess('书签更新成功');
        }

        // 检查是否需要后台补全
        // 启发式规则：如果名称等于 URL 的域名，且描述为空，则认为是“占位符”状态，尝试补全
        const domain = extractDomain(updatedSite.url);
        if (updatedSite.name === domain && !updatedSite.description) {
          enrichSiteInBackground(updatedSite.id, updatedSite.url);
        }
      }
    } catch (error) {
      console.error('更新站点失败:', error);
      handleError('更新站点失败: ' + (error as Error).message);
    }
  };

  // 删除站点
  const handleSiteDelete = async (siteId: number) => {
    // 记录旧状态以便回滚
    const previousGroups = [...groups];

    // 1. 乐观更新：立即从前端界面移除
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        sites: group.sites.filter((site) => site.id !== siteId),
      }))
    );

    try {
      // 2. 异步后台删除
      await api.deleteSite(siteId);

      // 3. 响应删除完成（显示成功提示）
      handleSuccess('书签已成功删除');
    } catch (error) {
      console.error('删除站点失败:', error);
      // 回滚
      setGroups(previousGroups);
      handleError('删除站点失败: ' + (error as Error).message);
    }
  };



  // 保存站点排序
  const handleSaveSiteOrder = async (groupId: number, sites: Site[]) => {
    try {
      console.log('保存站点排序', groupId, sites);

      // 构造需要更新的站点顺序数据
      const siteOrders = sites.map((site, index) => ({
        id: site.id as number,
        order_num: index,
      }));

      // 调用API更新站点顺序
      const result = await api.updateSiteOrder(siteOrders);

      if (result) {
        console.log('站点排序更新成功');
        // 重新获取最新数据
        // 重新获取最新数据
        // await fetchData();
      } else {
        throw new Error('站点排序更新失败');
      }



      // setSortMode(SortMode.None);
      // setCurrentSortingGroupId(null);
    } catch (error) {
      console.error('更新站点排序失败:', error);
      handleError('更新站点排序失败: ' + (error as Error).message);
    }
  };

  // 启动分组排序
  const startGroupSort = useCallback(() => {
    console.log('开始分组排序');
    setSortMode(SortMode.GroupSort);
    setCurrentSortingGroupId(null);

  }, []);

  // 启动站点排序
  const startSiteSort = useCallback((groupId: number) => {
    console.log('开始站点排序');
    setSortMode(SortMode.SiteSort);
    setCurrentSortingGroupId(groupId);

  }, []);

  // 取消排序
  const cancelSort = useCallback(() => {
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  }, []);

  // 处理恢复 (站点或分组)
  const handleRestore = useCallback((itemOrItems: Site | Site[] | Group | Group[]) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;

    // 区分站点和分组
    const sitesToRestore = items.filter(item => 'url' in item) as Site[];
    // @ts-ignore - group doesn't have url
    const groupsToRestore = items.filter(item => !('url' in item)) as Group[];

    if (sitesToRestore.length > 0) {
      setGroups((prevGroups) => {
        const newGroups = [...prevGroups];
        let updated = false;

        // 按分组 ID 对要恢复的站点进行归类
        const sitesByGroup = sitesToRestore.reduce((acc, site) => {
          if (site.group_id !== undefined && site.group_id !== null) {
            const gid = site.group_id;
            if (!acc[gid]) acc[gid] = [];
            acc[gid]!.push(site);
          }
          return acc;
        }, {} as Record<number, Site[]>);

        for (const [groupIdStr, sites] of Object.entries(sitesByGroup)) {
          const groupId = Number(groupIdStr);
          const groupIndex = newGroups.findIndex((g) => g.id === groupId);

          if (groupIndex !== -1) {
            const targetGroup = { ...newGroups[groupIndex] };
            const existingSites = targetGroup.sites ? [...targetGroup.sites] : [];
            let groupUpdated = false;

            for (const site of sites) {
              if (!existingSites.find((s) => s.id === site.id)) {
                existingSites.push(site);
                groupUpdated = true;
              }
            }

            if (groupUpdated) {
              existingSites.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
              targetGroup.sites = existingSites;
              newGroups[groupIndex] = targetGroup as GroupWithSites;
              updated = true;
            }
          }
        }

        return updated ? newGroups : prevGroups;
      });
    }

    // 如果恢复了分组，或者恢复了站点，我们最好都静默刷新一下以确保同步最新状态
    fetchData(true);
    handleSuccess(`成功恢复了 ${items.length} 个项目`);
  }, [fetchData, handleSuccess]);

  // 辅助函数：从URL获取站点信息
  const handleUrlBlur = async (url: string) => {
    if (!url) return;

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
      setNewSite(prev => ({ ...prev, url: targetUrl }));
    }

    try {
      new URL(targetUrl);
    } catch {
      return;
    }

    // 1. 自动获取图标
    const domain = extractDomain(targetUrl);
    if (domain) {
      const config = await api.getConfigs();
      const iconApi = config.icon_api || 'https://www.faviconextractor.com/favicon/{domain}?larger=true';
      const iconUrl = iconApi.replace('{domain}', domain);
      if (!newSite.icon) {
        setNewSite(prev => ({ ...prev, icon: iconUrl }));
      }
    }

    // 2. 自动获取标题和描述
    if (!newSite.name || !newSite.description) {
      try {
        const info = await api.fetchSiteInfo(targetUrl);
        if (info.success) {
          setNewSite(prev => ({
            ...prev,
            name: prev.name || info.name || prev.name,
            description: prev.description || info.description || prev.description,
          }));
        }
      } catch (err) {
        console.error('自动获取站点信息失败:', err);
      }
    }
  };

  // 提交修改分组
  // 启动跨分组拖动模式
  const startCrossGroupDrag = useCallback(() => {
    console.log('开始跨分组拖动');
    setSortMode(SortMode.CrossGroupDrag);
    setCurrentSortingGroupId(null);

  }, []);

  // 处理跨分组拖拽的 DragOver 事件
  const handleSiteDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (sortMode !== SortMode.CrossGroupDrag) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (!activeId.startsWith('site-')) return;
    const activeSiteId = parseInt(activeId.replace('site-', ''));

    // 查找 active 所在的 Group
    const activeGroup = groups.find(g => g.sites.some(s => s.id === activeSiteId));
    if (!activeGroup) return;

    // 查找 over 所在的 Group
    let overGroupId: number | null = null;
    if (overId.startsWith('group-')) {
      overGroupId = parseInt(overId.replace('group-', ''));
    } else if (overId.startsWith('site-')) {
      const overSiteId = parseInt(overId.replace('site-', ''));
      const g = groups.find(g => g.sites.some(s => s.id === overSiteId));
      if (g) overGroupId = g.id;
    }

    if (!overGroupId || activeGroup.id === overGroupId) return;

    const overSiteId = overId.startsWith('site-') ? parseInt(overId.replace('site-', '')) : null;

    // 移动站点以显示占位
    setGroups((prev) => {
      // 找到源分组和目标分组
      const sourceIndex = prev.findIndex(g => g.sites.some(s => s.id === activeSiteId));
      const targetIndex = overId.startsWith('group-')
        ? prev.findIndex(g => g.id === overGroupId)
        : prev.findIndex(g => g.sites.some(s => s.id === overSiteId));

      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const source = prev[sourceIndex];
      const target = prev[targetIndex];

      if (!source || !target) return prev;

      // 如果源和目标相同，且是 site-to-site，dnd-kit-sortable 会处理，这里不处理
      if (sourceIndex === targetIndex) return prev;

      const siteIndex = source.sites.findIndex(s => s.id === activeSiteId);
      if (siteIndex === -1) return prev;

      // 仅在真正发生跨组变化或位置变化时更新状态
      const movedSite = source.sites[siteIndex];

      // 创建新数组，仅克隆受影响的分组
      const newGroups = [...prev];

      // 更新源分组：移除站点
      const newSourceSites = [...source.sites];
      newSourceSites.splice(siteIndex, 1);
      newGroups[sourceIndex] = { ...source, sites: newSourceSites } as any;

      // 更新目标分组：插入站点
      const newTargetSites = [...target.sites];
      const siteToInsert = { ...movedSite, group_id: target.id as number } as any;

      let insertIndex = newTargetSites.length;
      if (overId.startsWith('site-')) {
        const idx = newTargetSites.findIndex(s => s.id === overSiteId);
        if (idx !== -1) {
          const activeRect = active.rect.current.translated;
          const overRect = over.rect;
          if (activeRect && overRect) {
            const isAfter = activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2 ||
              (Math.abs(activeRect.top - overRect.top) < 10 && activeRect.left > overRect.left);
            insertIndex = idx + (isAfter ? 1 : 0);
          } else {
            insertIndex = idx;
          }
        }
      }

      newTargetSites.splice(insertIndex, 0, siteToInsert);
      newGroups[targetIndex] = { ...target, sites: newTargetSites } as any;

      return newGroups;
    });
  };

  // 处理跨分组拖拽结束事件
  const handleCrossGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id.toString();

    setDraggedSiteId(null);
    setActiveSite(null);
    const startGroupId = dragStartGroupId;
    setDragStartGroupId(null);

    if (!over || !activeId.startsWith('site-')) return;

    const activeSiteId = parseInt(activeId.replace('site-', ''));

    // 查找当前所在的组 (可能已经在 DragOver 中移动了)
    const currentGroup = groups.find(g => g.sites.some(s => s.id === activeSiteId));
    if (!currentGroup) return;

    let finalSites = [...currentGroup.sites];
    let orderChanged = false;

    // 处理同组内的排序
    if (over.id.toString().startsWith('site-')) {
      const overSiteId = parseInt(over.id.toString().replace('site-', ''));
      const oldIndex = currentGroup.sites.findIndex(s => s.id === activeSiteId);
      const overIndex = currentGroup.sites.findIndex(s => s.id === overSiteId);

      if (oldIndex !== -1 && overIndex !== -1) {
        let newIndex = overIndex;

        // 使用 Rect 判断相对位置，修正 finalIndex
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        if (activeRect && overRect) {
          const activeCenterY = activeRect.top + activeRect.height / 2;
          const overCenterY = overRect.top + overRect.height / 2;
          const activeCenterX = activeRect.left + activeRect.width / 2;
          const overCenterX = overRect.left + overRect.height / 2; // Corrected to overRect.height / 2 for vertical center

          let isAfter = false;
          if (activeCenterY > overCenterY + overRect.height / 2) {
            isAfter = true;
          } else if (activeCenterY < overCenterY - overRect.height / 2) {
            isAfter = false;
          } else {
            if (activeCenterX > overCenterX) isAfter = true;
          }

          // 根据拖拽方向和相对位置修正索引
          if (oldIndex < overIndex) {
            // 向下拖拽，默认是放在 over 后面 (Index=overIndex)
            // 如果判断实际上是 Before (Top half)，则 -1
            if (!isAfter) newIndex = overIndex - 1;
          } else {
            // 向上拖拽，默认是放在 over 前面 (Index=overIndex)
            // 如果判断实际上是 After (Bottom half)，则 +1
            if (isAfter) newIndex = overIndex + 1;
          }
        }

        if (oldIndex !== newIndex) {
          finalSites = arrayMove(currentGroup.sites, oldIndex, newIndex);
          orderChanged = true;

          // 更新本地状态
          setGroups(prev => prev.map(g =>
            g.id === currentGroup.id ? { ...g, sites: finalSites } : g
          ));
        }
      }
    }

    // 同步到 API
    try {
      // 检查是否跨组移动
      if (startGroupId && currentGroup.id !== startGroupId) {
        await api.updateSite(activeSiteId, { group_id: currentGroup.id });
        await handleSaveSiteOrder(currentGroup.id, finalSites);
        setSnackbarMessage('已移动站点');
        setSnackbarOpen(true);
      } else if (orderChanged) {
        // 仅排序
        await handleSaveSiteOrder(currentGroup.id, finalSites);
      }
    } catch (error) {
      console.error('移动/排序失败:', error);
      handleError('移动/排序失败: ' + (error as Error).message);
      await fetchData(); // 失败回滚
    }
  };

  // 处理拖拽开始事件
  const handleDragStart = (event: any) => {
    const { active } = event;
    setDraggedSiteId(active.id.toString());

    // 查找拖拽的站点
    const activeId = active.id.toString();
    if (activeId.startsWith('site-')) {
      const activeSiteId = parseInt(activeId.replace('site-', ''));
      for (const group of groups) {
        const site = group.sites.find((s) => s.id === activeSiteId);
        if (site) {
          setActiveSite(site);
          setDragStartGroupId(group.id);
          break;
        }
      }
    }
  };

  // 处理拖拽结束事件
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedSiteId(null);
    setActiveSite(null);

    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // 处理分组排序
    if (!activeId.startsWith('site-') && !overId.startsWith('site-')) {
      if (activeId !== overId) {
        const oldIndex = groups.findIndex((group) => `group-${group.id}` === activeId);
        const newIndex = groups.findIndex((group) => `group-${group.id}` === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newGroups = arrayMove(groups, oldIndex, newIndex);
          setGroups(newGroups);

          // 自动保存分组顺序
          const groupOrders = newGroups.map((group, index) => ({
            id: group.id as number,
            order_num: index,
          }));
          api.updateGroupOrder(groupOrders).catch(err => {
            console.error('自动保存分组排序失败:', err);
            handleError('自动保存分组排序失败: ' + err.message);
          });
        }
      }
    }
    // 处理站点排序 (同组内)
    else if (activeId.startsWith('site-') && overId.startsWith('site-')) {
      // 只有在 SiteSort 模式且在当前编辑组内才处理
      if (sortMode === SortMode.SiteSort && currentSortingGroupId) {
        const activeSiteId = parseInt(activeId.replace('site-', ''));
        const overSiteId = parseInt(overId.replace('site-', ''));

        const currentGroupId = currentSortingGroupId;
        const groupIndex = groups.findIndex(g => g.id === currentGroupId);
        if (groupIndex !== -1) {
          const targetGroup = groups[groupIndex];
          if (targetGroup) {
            const oldIndex = targetGroup.sites.findIndex(s => s.id === activeSiteId);
            const newIndex = targetGroup.sites.findIndex(s => s.id === overSiteId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newSites = arrayMove(targetGroup.sites, oldIndex, newIndex);
              const newGroups = [...groups];
              newGroups[groupIndex] = { ...targetGroup, sites: newSites } as any;
              setGroups(newGroups);

              // 自动保存站点顺序
              handleSaveSiteOrder(currentGroupId!, newSites).catch(err => {
                console.error('自动保存站点排序失败:', err);
              });
            }
          }
        }
      }
    }
  };

  // 新增分组相关函数
  const handleOpenAddGroup = useCallback(() => {
    setOpenAddGroup(true);
  }, []);

  // 优化：使用 useCallback 避免 UserAvatar 重复渲染
  const handleAvatarUpdate = useCallback((url: string | null) => {
    setAvatarUrl(url);
  }, []);

  const handleCloseAddGroup = () => {
    setOpenAddGroup(false);
  };

  // handleGroupInputChange and handleCreateGroup moved to AddGroupDialog

  // 新增站点相关函数
  const handleOpenAddSite = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const maxOrderNum = group?.sites.length
      ? Math.max(...group.sites.map((s) => s.order_num)) + 1
      : 0;

    setNewSite({
      name: '',
      url: '',
      icon: '',
      description: '',
      notes: '',
      group_id: groupId,
      order_num: maxOrderNum,
      is_public: 1, // 默认为公开
    });

    setOpenAddSite(true);
  };

  const handleCloseAddSite = () => {
    setOpenAddSite(false);
  };

  const handleSiteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSite({
      ...newSite,
      [e.target.name]: e.target.value,
    });
  };

  // 后台补充站点信息
  const enrichSiteInBackground = async (siteId: number, url: string) => {
    try {
      console.log(`[后台补全] 开始获取信息: ${url}`);
      const info = await api.fetchSiteInfo(url) as any;

      if (info.success && (info.name || info.description || info.icon)) {
        console.log(`[后台补全] 获取成功:`, info.name);

        // 构建更新对象，只更新有值的字段
        const updates: Partial<Site> = {};
        if (info.name) updates.name = info.name;
        if (info.description) updates.description = info.description;
        // 如果原有图标是默认的 faviconextractor，尝试替换为更精准的图标
        if (info.icon) updates.icon = info.icon;

        if (Object.keys(updates).length > 0) {
          await api.updateSite(siteId, updates);

          // 更新本地状态 - 仅更新该站点
          setGroups(prevGroups => {
            const newGroups = prevGroups.map(group => {
              // 找到包含该站点的组
              if (group.sites.some(s => s.id === siteId)) {
                return {
                  ...group,
                  sites: group.sites.map(s => s.id === siteId ? { ...s, ...updates } : s)
                };
              }
              return group;
            });
            return newGroups;
          });
        }
      }
    } catch (error) {
      console.warn(`[后台补全] 失败:`, error);
    }
  };

  const handleCreateSite = async () => {
    try {
      if (!newSite.url) {
        handleError('站点URL不能为空');
        return;
      }

      // 如果没有名称，使用域名
      let finalName = newSite.name;
      if (!finalName) {
        finalName = extractDomain(newSite.url) || 'New Site';
      }

      // 准备提交的数据
      const siteToCreate = {
        ...newSite,
        name: finalName
      };

      const createdSite = await api.createSite(siteToCreate as Site);

      // 局部更新本地状态，避免 fetchData 全量刷新
      if (createdSite && createdSite.id) {
        setGroups(prevGroups => prevGroups.map(group => {
          if (group.id === createdSite.group_id) {
            return {
              ...group,
              sites: [...group.sites, createdSite]
            };
          }
          return group;
        }));
        handleSuccess('书签创建成功');

        // 如果用户没填名称或描述，触发后台补全
        if (!newSite.name || !newSite.description) {
          enrichSiteInBackground(createdSite.id, createdSite.url);
        }
      }

      handleCloseAddSite();
    } catch (error) {
      console.error('创建站点失败:', error);
      handleError('创建站点失败: ' + (error as Error).message);
    }
  };

  // 配置相关函数
  const handleOpenConfig = useCallback(() => {
    setTempConfigs({ ...configs });
    setOpenConfig(true);
  }, [configs]);

  const handleCloseConfig = useCallback(() => {
    setOpenConfig(false);
  }, []);

  const handleConfigInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempConfigs({
      ...tempConfigs,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveConfig = async () => {
    try {
      // 保存所有配置
      for (const [key, value] of Object.entries(tempConfigs)) {
        if (configs[key] !== value) {
          await api.setConfig(key, value);
        }
      }

      // 更新配置状态
      setConfigs(prev => ({ ...prev, ...tempConfigs }));
      handleCloseConfig();
      handleSuccess('配置保存成功');
    } catch (error) {
      console.error('保存配置失败:', error);
      handleError('保存配置失败: ' + (error as Error).message);
    }
  };

  // 快捷更新配置函数（供其他组件直接调用）
  const handleUpdateConfigs = useCallback(async (newConfigs: Record<string, string>) => {
    try {
      // 找出有变化的配置项并同步到后端
      for (const [key, value] of Object.entries(newConfigs)) {
        if (configs[key] !== value) {
          await api.setConfig(key, value);
        }
      }
      // 更新本地状态
      setConfigs(prev => ({ ...prev, ...newConfigs }));
      handleSuccess('设置已更新');
    } catch (error) {
      console.error('更新配置失败:', error);
      handleError('更新配置失败: ' + (error as Error).message);
    }
  }, [api, configs]);

  // 处理导出数据
  const handleExportData = useCallback(async () => {
    try {
      setLoading(true);

      const currentGroups = groupsRef.current;

      // 提取所有站点数据为单独的数组
      const allSites: Site[] = [];
      currentGroups.forEach((group) => {
        if (group.sites && group.sites.length > 0) {
          allSites.push(...group.sites);
        }
      });

      const exportData = {
        // 只导出分组基本信息，不包含站点
        groups: currentGroups.map((group) => ({
          id: group.id,
          name: group.name,
          order_num: group.order_num,
        })),
        // 站点数据作为单独的顶级数组
        sites: allSites,
        configs: configs,
        // 添加版本和导出日期
        version: '1.0',
        exportDate: new Date().toISOString(),
      };

      // 创建并下载JSON文件
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileName = `导航站备份_${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
    } catch (error) {
      console.error('导出数据失败:', error);
      handleError('导出数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [configs]); // 移除 groups 依赖，现在使用 groupsRef

  // 处理导入对话框
  const handleOpenImport = useCallback(() => {
    setImportFile(null);
    setImportError(null);
    setImportType('json');
    setChromeImportProgress(0);
    setImportRemainingSeconds(null);
    setImportStartTime(null);
    setOpenImport(true);
  }, []);

  const handleCloseImport = () => {
    if (importLoading) {
      setSnackbarMessage('导入任务正在后台运行');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    }
    setOpenImport(false);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setImportFile(selectedFile);
        setImportError(null);
      }
    }
  };

  // 处理导入数据
  const handleImportData = async () => {
    if (!importFile) {
      handleError('请选择要导入的文件');
      return;
    }

    // 根据导入类型分流处理
    if (importType === 'chrome') {
      await handleImportChromeBookmarks();
      return;
    }

    try {
      setImportLoading(true);
      setImportError(null);

      const fileReader = new FileReader();
      fileReader.readAsText(importFile, 'UTF-8');

      fileReader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('读取文件失败');
          }

          const importData = JSON.parse(e.target.result as string);

          // 验证导入数据格式
          if (!importData.groups || !Array.isArray(importData.groups)) {
            throw new Error('导入文件格式错误：缺少分组数据');
          }

          if (!importData.sites || !Array.isArray(importData.sites)) {
            throw new Error('导入文件格式错误：缺少站点数据');
          }

          // configs 是可选字段，如果缺失则使用空对象
          if (!importData.configs) {
            importData.configs = {};
          } else if (typeof importData.configs !== 'object') {
            throw new Error('导入文件格式错误：配置数据格式无效');
          }

          // 调用API导入数据
          const result = await api.importData(importData);

          if (!result.success) {
            throw new Error(result.error || '导入失败');
          }

          // 显示导入结果统计
          const stats = result.stats;
          if (stats) {
            const summary = [
              `导入成功！`,
              `分组：发现${stats.groups.total}个，新建${stats.groups.created}个，合并${stats.groups.merged}个`,
              `卡片：发现${stats.sites.total}个，新建${stats.sites.created}个，更新${stats.sites.updated}个，跳过${stats.sites.skipped}个`,
            ].join('\n');

            setImportResultMessage(summary);
            setImportResultOpen(true);
          }

          // 刷新数据（使用静默加载，并通过 fetchData 内部逻辑决定是否显示骨架屏）
          // 强制不使用缓存：fetchData(false)
          await fetchData(false);
          handleCloseImport();
        } catch (error) {
          console.error('解析导入数据失败:', error);
          handleError('解析导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
        } finally {
          setImportLoading(false);
        }
      };

      fileReader.onerror = () => {
        handleError('读取文件失败');
        setImportLoading(false);
      };
    } catch (error) {
      console.error('导入数据失败:', error);
      handleError('导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setImportLoading(false);
    }
  };

  // 处理 Chrome 书签导入
  const handleImportChromeBookmarks = async () => {
    if (!importFile) return;

    try {
      isImportCancelled.current = false;
      setImportLoading(true);
      setImportError(null);
      setChromeImportProgress(0);
      setImportRemainingSeconds(null);
      setImportStartTime(Date.now());

      // --- 第一阶段：文件分析 ---
      setSnackbarMessage('正在分析书签文件...');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);

      const htmlContent = await importFile.text();
      const bookmarkGroups = parseBookmarks(htmlContent, '书签');

      if (bookmarkGroups.length === 0) {
        throw new Error('未在书签文件中找到任何有效书签');
      }

      // 统计分析结果
      let totalBookmarks = 0;
      bookmarkGroups.forEach(g => { totalBookmarks += g.bookmarks.length; });

      // 分析完成，按用户要求设置进度为 100
      setChromeImportProgress(100);
      setSnackbarMessage(`分析完成，发现 ${totalBookmarks} 个书签，正在开始导入...`);
      setSnackbarOpen(true);

      // --- 第二阶段：执行导入 ---
      await fetchData();
      await runImportIteration(bookmarkGroups, 0, totalBookmarks, 0, 0, 0, 0);
    } catch (error) {
      console.error('导入Chrome书签失败:', error);
      handleError('导入Chrome书签失败: ' + (error instanceof Error ? error.message : '未知错误'));
      setImportLoading(false);
      setChromeImportProgress(0);
      clearImportTask();
    }
  };



  const runImportIteration = async (
    bookmarkGroups: BookmarkGroup[],
    initialProcessed: number,
    totalBookmarks: number,
    initialGroupsCreated: number,
    initialGroupsMerged: number,
    initialSitesCreated: number,
    initialSitesSkipped: number
  ) => {
    try {
      let groupsCreated = initialGroupsCreated;
      let groupsMerged = initialGroupsMerged;
      let sitesCreated = initialSitesCreated;
      let sitesSkipped = initialSitesSkipped;
      let processed = initialProcessed;

      // 使用本地副本实时跟踪分组，包括本次导入新建的分组
      let workingGroups = [...groups];

      for (const bookmarkGroup of bookmarkGroups) {
        // --- 取消检查 ---
        if (isImportCancelled.current) {
          clearImportTask();
          setImportLoading(false);
          setChromeImportProgress(0);
          return;
        }

        const { groupName, bookmarks } = bookmarkGroup;

        // 在实时更新的 workingGroups 中查找是否有同名分组
        let targetGroup = workingGroups.find(
          g => g.name.trim().toLowerCase() === groupName.trim().toLowerCase()
        );

        if (targetGroup) {
          groupsMerged++;
        } else {
          try {
            // --- 取消检查 ---
            if (isImportCancelled.current) {
              clearImportTask();
              setImportLoading(false);
              setChromeImportProgress(0);
              return;
            }

            const newGroup = await api.createGroup({
              name: groupName.trim(),
              order_num: workingGroups.length,
              is_public: 1,
            } as Group);
            targetGroup = { ...newGroup, sites: [] } as GroupWithSites;

            // 关键：立即更新本地 workingGroups 引用，供下一个循环查重使用
            workingGroups = [...workingGroups, targetGroup];

            // 同步 UI 状态
            setGroups(workingGroups);
            groupsCreated++;
          } catch (error) {
            console.error(`恢复/创建分组 "${groupName}" 失败:`, error);
            processed += bookmarks.length;
            sitesSkipped += bookmarks.length;
            continue;
          }
        }

        const existingSites = targetGroup.sites || [];
        let maxOrderNum = existingSites.length > 0
          ? Math.max(...existingSites.map(s => s.order_num)) + 1
          : 0;

        // URL 规范化函数
        const normalizeUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '');
        const existingUrls = new Set(existingSites.map(s => normalizeUrl(s.url)));

        // --- 核心：50 个一组进行逻辑分段 ---
        const chunkSize = 50;
        for (let j = 0; j < bookmarks.length; j += chunkSize) {
          // --- 取消检查 ---
          if (isImportCancelled.current) {
            clearImportTask();
            setImportLoading(false);
            setChromeImportProgress(0);
            return;
          }

          const currentChunk = bookmarks.slice(j, j + chunkSize);
          const isChunked = bookmarks.length > chunkSize;

          if (isChunked) {
            console.log(`[Import] 分组 "${groupName}" 正在处理第 ${Math.floor(j / chunkSize) + 1} 批次 (${currentChunk.length} 个书签)`);
          }

          for (let k = 0; k < currentChunk.length; k++) {
            const bookmark = currentChunk[k];
            const currentNormalizedUrl = normalizeUrl(bookmark.url);

            if (existingUrls.has(currentNormalizedUrl)) {
              sitesSkipped++;
            } else {
              const siteName = bookmark.title || extractDomain(bookmark.url) || 'New Site';

              // 构造后端需要的批量导入格式
              const importPayload = {
                groups: [{
                  id: targetGroup.id as number,
                  name: groupName,
                  order_num: targetGroup.order_num,
                  is_public: 1
                }],
                sites: [{
                  group_id: targetGroup.id as number,
                  name: siteName,
                  url: bookmark.url,
                  order_num: maxOrderNum++,
                  is_public: 1
                }],
                configs: {}
              };

              try {
                // 真正的批量提交（虽然这里是 chunk 内部的一组，但后端 importData 本身已优化）
                // 为了严格符合用户“50个一导入”且日志能反映出来，我们应该在这层进行批量调用
                // 注意：为了保持进度实时性，我们保持这个循环，但改用一次性提交整个 chunk 的策略
              } catch (e) { }
            }
          }

          // --- 修正：将这 50 个书签一次性打包提交 ---
          const sitesToImport = currentChunk
            .filter(b => !existingUrls.has(normalizeUrl(b.url)))
            .map(b => ({
              group_id: targetGroup!.id as number,
              name: b.title || extractDomain(b.url) || 'New Site',
              url: b.url,
              order_num: maxOrderNum++,
              is_public: 1
            }));

          if (sitesToImport.length > 0) {
            try {
              const batchResult = await api.importData({
                groups: [{
                  id: targetGroup!.id as number,
                  name: groupName,
                  order_num: targetGroup!.order_num,
                  is_public: 1
                }],
                sites: sitesToImport,
                configs: {}
              });

              if (batchResult.success && batchResult.stats) {
                // 使用后端返回的真实统计数据
                const { created, skipped } = batchResult.stats.sites;
                sitesCreated += created;
                sitesSkipped += skipped;

                console.log(`[Import] 分组 "${groupName}": 第 ${Math.floor(j / chunkSize) + 1} 批次导入完成 (新增 ${created} 个，跳过 ${skipped} 个)`);

                // --- 视觉优化：局部状态乐观追加 ---
                // 注意：如果后端有跳过，这里按 sitesToImport 全量追加会有微小视觉误差，但 fetchData(false) 最终会修正
                const sitesAdded = sitesToImport as any[];

                setGroups(prevGroups => {
                  const updatedGroups = prevGroups.map(g => {
                    if (g.id === targetGroup!.id) {
                      return {
                        ...g,
                        sites: [...(g.sites || []), ...sitesAdded]
                      };
                    }
                    return g;
                  });

                  // 关键细节：同步更新外部 workingGroups，确保后续循环拿到最新 site 列表
                  workingGroups = updatedGroups;
                  return updatedGroups;
                });

                // 暂时放开渐进式渲染限制
                setVisibleGroupsCount(prev => Math.max(prev, workingGroups.length));
              }
            } catch (error) {
              console.error(`[Import] 批量导入批次失败:`, error);
            }
          }

          processed += currentChunk.length;

          // 核心：不再在分批中途执行 fetchData(true)，防止 API 快照回滚导致的数值跳动
          // 我们依赖上面的 setGroups 局部更新来维持 UI 的最新状态

          const progress = totalBookmarks > 0 ? Math.min(100, Math.round((sitesCreated / totalBookmarks) * 100)) : 0;
          setChromeImportProgress(progress);

          // 计算预计剩余时间
          if (importStartTime && (sitesCreated + sitesSkipped) > 0) {
            const elapsed = (Date.now() - importStartTime) / 1000;
            const itemsProcessed = sitesCreated + sitesSkipped;
            const itemsRemaining = totalBookmarks - itemsProcessed;
            const speed = itemsProcessed / elapsed; // items per second
            if (speed > 0) {
              const remaining = Math.round(itemsRemaining / speed);
              setImportRemainingSeconds(remaining);
            }
          }

          // 每批次强制持久化一次
          saveImportTask({
            type: 'chrome',
            bookmarkGroups,
            processed,
            totalBookmarks,
            groupsCreated,
            groupsMerged,
            sitesCreated,
            sitesSkipped
          });

          // 释放主线程
          await new Promise(resolve => setTimeout(resolve, 50));
        } // chunks loop end
      } // outer loop end

      // 书签统计
      const actualSitesCreated = sitesCreated;
      const actualSitesSkipped = sitesSkipped;

      const summary = [
        `Chrome 书签导入完成！`,
        `分组：发现 ${bookmarkGroups.length} 个，新建 ${groupsCreated} 个`,
        `书签：共 ${totalBookmarks} 个，实际新增 ${actualSitesCreated} 个`,
      ].join('\n');

      setImportResultMessage(summary);
      setImportResultOpen(true);
      clearImportTask();

      // 完成后撤销计时器
      setImportRemainingSeconds(null);
      setImportStartTime(null);

      // 完成后执行无缓存同步
      await fetchData(false);
    } catch (error) {
      console.error('迭代导入失败:', error);
    } finally {
      setImportLoading(false);
      setChromeImportProgress(0);
      setImportRemainingSeconds(null);
      setImportStartTime(null);
    }
  };

  // 渲染登录页面
  const renderLoginForm = () => {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <LoginForm
          onLogin={handleLogin}
          onRegister={handleRegister}
          onResetPassword={handleResetPassword}
          onSendCode={handleSendCode}
          onGetEmail={handleGetEmail}
          loading={loginLoading}
          error={loginError}
          registerLoading={registerLoading}
          registerError={registerError}
          registerSuccess={registerSuccess}
          resetPasswordLoading={resetPasswordLoading}
          resetPasswordError={resetPasswordError}
          resetPasswordSuccess={resetPasswordSuccess}
        />
        {/* 如果不是强制认证（比如访客模式点击登录），显示返回按钮 */}
        {!isAuthenticated && (
          <Button
            onClick={() => setIsLoginOpen(false)}
            sx={{ mt: 2 }}
            variant="text"
          >
            返回访客模式
          </Button>
        )}
      </Box>
    );
  };

  // 如果正在检查认证状态，只有在没有缓存且不在访客模式时才显示全屏加载
  // 这里我们改为不阻塞渲染，让组件根据 groups 长度自行决定是否显示骨架屏
  // 原有的 isAuthChecking 阻断逻辑移除，改为在 background 运行

  // 显式显示登录界面 - 注意：此处已移动到下方 return 中以支持 Hooks 规则

  // 更新分组
  const handleGroupUpdate = async (updatedGroup: Group) => {
    try {
      if (updatedGroup.id) {
        await api.updateGroup(updatedGroup.id, updatedGroup);

        // 局部更新本地状态
        setGroups(prevGroups => prevGroups.map(group => {
          if (group.id === updatedGroup.id) {
            return { ...group, ...updatedGroup };
          }
          return group;
        }));

        handleSuccess('分组更新成功');
      }
    } catch (error) {
      console.error('更新分组失败:', error);
      handleError('更新分组失败: ' + (error as Error).message);
    }
  };

  // 删除分组
  const handleGroupDelete = async (groupId: number) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (groupToDelete?.is_protected === 1) {
      handleError('此分组是受保护的，不允许删除');
      return;
    }

    // 乐观更新：先在 UI 上移除
    const previousGroups = [...groups];
    setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));

    try {
      const success = await api.deleteGroup(groupId);

      if (success) {
        handleSuccess('分组已删除');
      } else {
        // 如果后端返回 explicit failure (false)，回滚
        throw new Error('操作未成功');
      }
    } catch (error) {
      console.error('删除分组失败:', error);
      // 回滚状态
      setGroups(previousGroups);
      handleError('删除分组失败: ' + (error as Error).message);
    }
  };

  // 记录站点点击
  const handleSiteClick = async (siteId: number) => {
    try {
      await api.clickSite(siteId);
    } catch (error) {
      console.warn('记录点击失败:', error);
    }
  };

  // 打开站点设置时刷新数据
  const handleSiteSettingsOpen = (siteId: number) => {
    // 遍历所有分组查找站点
    for (const group of groups) {
      const site = group.sites.find(s => s.id === siteId);
      if (site) {
        setSiteToSettings(site);
        setIsSettingsOpen(true);
        break;
      }
    }
  };

  // 批量更新精选状态
  const handleBatchFeaturedUpdate = useCallback(async (siteIds: number[], isFeatured: number) => {
    try {
      if (!siteIds.length) return;

      const result = await api.batchUpdateSites(siteIds, { is_featured: isFeatured });

      if (result.success) {
        // 同步更新本地状态
        setGroups(prevGroups => prevGroups.map(group => ({
          ...group,
          sites: group.sites.map(s => {
            if (siteIds.includes(s.id!)) {
              return { ...s, is_featured: isFeatured };
            }
            return s;
          })
        })));

        handleSuccess(isFeatured ? '已批量设为精选' : '已批量取消精选');
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('批量更新精选失败:', error);
      handleError('批量更新精选失败: ' + (error as Error).message);
    }
  }, [api, handleError]);

  // 批量删除站点
  const handleBatchDeleteSites = async (siteIds: number[]) => {
    if (siteIds.length === 0) return;

    try {
      const success = await api.deleteSites(siteIds);
      if (success) {
        // 乐观更新 UI：从当前分组状态中移除被删除的站点
        setGroups(prev => prev.map(group => ({
          ...group,
          sites: group.sites.filter(site => !siteIds.includes(site.id as number))
        })));

        handleSuccess(`成功删除 ${siteIds.length} 个书签`);
      } else {
        handleError('批量删除书签失败');
      }
    } catch (error) {
      console.error('批量删除书签出错:', error);
      handleError('批量删除书签出错: ' + (error as Error).message);
    }
  };



  const ActiveLayout = configs['ui.style'] === 'classic' ? ClassicLayout : ModernLayout;

  // 过滤后的数据
  const displayGroups = useMemo(() => {
    if (!showFeaturedOnly) return groups;

    return groups.map(group => {
      const featuredSites = group.sites.filter(s => s.is_featured === 1);
      if (featuredSites.length === 0) return null;
      return { ...group, sites: featuredSites };
    }).filter(g => g !== null) as GroupWithSites[];
  }, [groups, showFeaturedOnly]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {isLoginOpen ? (
        <Box sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'background.default'
        }}>
          {renderLoginForm()}
        </Box>
      ) : (
        <>
          <div id="back-to-top-anchor" />

          {/* 错误提示 Snackbar */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={1000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbarSeverity}
              variant='filled'
              sx={{ width: '100%' }}
            >
              {snackbarMessage}
            </Alert>
          </Snackbar>

          {/* 导入结果提示 Snackbar */}
          <Snackbar
            open={importResultOpen}
            autoHideDuration={6000}
            onClose={() => setImportResultOpen(false)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert
              onClose={() => setImportResultOpen(false)}
              severity='success'
              variant='filled'
              sx={{
                width: '100%',
                whiteSpace: 'pre-line',
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2e7d32' : undefined),
                color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
                '& .MuiAlert-icon': {
                  color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
                },
              }}
            >
              {importResultMessage}
            </Alert>
          </Snackbar>

          {/* 后台任务进度条 (仅在对话框关闭且导入进行中显示) */}
          {!openImport && importLoading && (
            <Paper
              elevation={6}
              sx={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 3000,
                width: { xs: '90%', sm: 360 },
                p: 2,
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} thickness={5} />
                    正在执行导入任务...
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {importType === 'chrome' ? (
                      <>
                        {importRemainingSeconds !== null && importRemainingSeconds > 0 && (
                          <span style={{ marginRight: 8 }}>预计还需 {importRemainingSeconds} 秒</span>
                        )}
                        {chromeImportProgress}%
                      </>
                    ) : '后台处理中'}
                  </Typography>
                </Box>
                {importType === 'chrome' && (
                  <LinearProgress variant="determinate" value={chromeImportProgress} sx={{ borderRadius: 1, height: 6 }} />
                )}
                {importType === 'json' && (
                  <LinearProgress variant="indeterminate" sx={{ borderRadius: 1, height: 6 }} />
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => {
                      isImportCancelled.current = true;
                      setImportLoading(false);
                      setChromeImportProgress(0);
                      clearImportTask();
                      handleSuccess('导入已取消');
                    }}
                    sx={{ fontSize: '0.7rem', py: 0 }}
                  >
                    取消导入
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  您可以继续浏览其它内容，完成后会自动刷新
                </Typography>
              </Stack>
            </Paper>
          )}

          <Box
            sx={{
              minHeight: '100vh',
              bgcolor: 'background.default',
              color: 'text.primary',
              transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out',
              position: 'relative', // 添加相对定位，作为背景图片的容器
              overflow: 'hidden', // 防止背景图片溢出
            }}
          >
            {/* 背景图片 */}
            {configs['site.backgroundImage'] && isSecureUrl(configs['site.backgroundImage']) && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${configs['site.backgroundImage']})`,
                    backgroundSize: '100% auto', // 宽度铺满，高度按比例自适应
                    backgroundPosition: 'top center', // 从顶部开始
                    backgroundRepeat: 'repeat-y', // 纵向重复
                    zIndex: 0,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(0, 0, 0, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')'
                          : 'rgba(255, 255, 255, ' +
                          (1 - Number(configs['site.backgroundOpacity'])) +
                          ')',
                      zIndex: 1,
                    },
                  }}
                />
              </>
            )}

            <ActiveLayout
              title={configs['site.name'] || ''}
              configs={configs}
              bookmarkCount={totalBookmarkCount}
              headerContent={
                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  justifyContent={{ xs: 'center', sm: 'flex-end' }}
                  flexWrap='wrap'
                  sx={{ gap: 1 }}
                >
                  {sortMode !== SortMode.None ? (
                    <>

                      {sortMode === SortMode.CrossGroupDrag && (
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          sx={{ alignSelf: 'center', mr: 1 }}
                        >
                          拖动站点到其他分组
                        </Typography>
                      )}
                      <Button
                        variant='outlined'
                        color='inherit'
                        startIcon={<CancelIcon />}
                        onClick={cancelSort}
                        size='small'
                        sx={{
                          minWidth: 'auto',
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        }}
                      >
                        取消编辑
                      </Button>
                    </>
                  ) : (
                    <>
                      {viewMode === 'readonly' ? (
                        // 访客模式：隐藏登录按钮 (通过 URL ?login=1 进入)
                        null
                      ) : (
                        // 编辑模式：隐藏管理按钮 (已移至头像菜单)
                        null
                      )}
                    </>
                  )}
                  <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
                  <Tooltip title={uiStyle === 'modern' ? '切换到经典布局' : '切换到现代布局'}>
                    <IconButton
                      onClick={() => {
                        const newStyle = uiStyle === 'modern' ? 'classic' : 'modern';
                        setConfigs(prev => ({ ...prev, 'ui.style': newStyle }));
                        // 如果已登录，保存到后端
                        if (isAuthenticated) {
                          api.setConfig('ui.style', newStyle);
                        }
                      }}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: 'background.paper',
                        boxShadow: 1,
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      {uiStyle === 'modern' ? <ViewStreamIcon /> : <ViewQuiltIcon />}
                    </IconButton>
                  </Tooltip>
                  {/* GitHub 图标 */}
                  <IconButton
                    component='a'
                    href='https://github.com/zhumengstar/NavTools'
                    target='_blank'
                    rel='noopener noreferrer'
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      color: 'text.primary',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      // 移除 ml: 1，由 Stack spacing 处理
                    }}
                  >
                    <GitHubIcon />
                  </IconButton>
                  {isAuthenticated && (
                    <Suspense fallback={null}>
                      <UserAvatar
                        username={username}
                        isAdmin={isAdmin}
                        onLogout={handleLogout}
                        onRestore={handleRestore}
                        onStartGroupSort={startGroupSort}
                        onStartCrossGroupDrag={startCrossGroupDrag}
                        onOpenConfig={handleOpenConfig}
                        onExportData={handleExportData}
                        onOpenImport={handleOpenImport}
                        onOpenAddGroup={handleOpenAddGroup}
                        configs={configs}
                        onUpdateConfigs={handleUpdateConfigs}
                        onResetData={handleOpenResetData}
                        api={api}
                        avatarUrl={avatarUrl}
                        onAvatarUpdate={handleAvatarUpdate}
                      />
                    </Suspense>
                  )}
                </Stack>
              }
            >
              {isAuthChecking ? (
                <PageSkeleton />
              ) : (!isAuthenticated && groups.length === 0) ? (
                <Suspense fallback={<PageSkeleton />}>
                  <VisitorHome
                    api={api}
                    onLoginClick={() => setIsLoginOpen(true)}
                  />
                </Suspense>
              ) : (
                <Box>
                  {(groups.length > 0 || isAuthenticated) && (
                    <Box>
                      {/* 搜索框 ... */}
                      {(() => {
                        console.log('[Debug] App Render - isAdmin:', isAdmin, 'configs.isAdmin:', configs.isAdmin);
                        const searchBoxEnabled = configs['site.searchBoxEnabled'] === 'true';
                        if (!searchBoxEnabled) return null;

                        return (
                          <Box sx={{ mb: 4, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <SearchBox
                                groups={displayGroups}
                                sites={displayGroups.flatMap((g) => g.sites || [])}
                                onDelete={isAuthenticated ? handleSiteDelete : undefined}
                                onEditGroup={(id) => {
                                  const group = groups.find(g => g.id === id);
                                  if (group) setGroupToEdit(group);
                                }}
                                onMoveSite={(siteId) => handleSiteSettingsOpen(siteId)}
                                onInternalResultClick={(result?: SearchResultItem) => {
                                  if (result && (result.type === 'group' || (result.type === 'site' && result.groupId))) {
                                    const targetId = result.type === 'group' ? result.id : result.groupId!;
                                    const element = document.getElementById(`group-${targetId}`);
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }}
                              />
                            </Box>

                            {/* 批量收起/展开按钮组 */}
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                              {isAdmin && (
                                <Tooltip title={showFeaturedOnly ? "显示全部" : "只看精选"}>
                                  <IconButton
                                    size="medium"
                                    onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                                    sx={{
                                      bgcolor: showFeaturedOnly ? 'secondary.main' : 'background.paper',
                                      color: showFeaturedOnly ? 'white' : 'inherit',
                                      boxShadow: 1,
                                      '&:hover': { bgcolor: showFeaturedOnly ? 'secondary.dark' : 'action.hover' }
                                    }}
                                  >
                                    <RecommendIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="全部收起">
                                <IconButton
                                  size="medium"
                                  onClick={() => setGlobalToggleVersion({ type: 'collapse', ts: Date.now() })}
                                  sx={{
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': { bgcolor: 'action.hover' }
                                  }}
                                >
                                  <UnfoldLessIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="全部展开">
                                <IconButton
                                  size="medium"
                                  onClick={() => setGlobalToggleVersion({ type: 'expand', ts: Date.now() })}
                                  sx={{
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': { bgcolor: 'action.hover' }
                                  }}
                                >
                                  <UnfoldMoreIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        );
                      })()}

                      {loading && groups.length === 0 && <PageSkeleton />}

                      {!loading && !error && (
                        <Fade in={!loading} timeout={800}>
                          <Box sx={{ '& > *': { mb: 5 }, minHeight: '100px' }}>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={handleDragStart}
                              onDragEnd={sortMode === SortMode.CrossGroupDrag ? handleCrossGroupDragEnd : handleDragEnd}
                              onDragOver={handleSiteDragOver}
                            >
                              {sortMode === SortMode.GroupSort ? (
                                <SortableContext
                                  items={displayGroups.map((group) => `group-${group.id}`)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <Stack spacing={2}>
                                    {displayGroups.map((group) => (
                                      <SortableGroupItem
                                        key={group.id}
                                        id={`group-${group.id}`}
                                        group={group}
                                        onDelete={handleGroupDelete}
                                      />
                                    ))}
                                  </Stack>
                                </SortableContext>
                              ) : (
                                <Box sx={{ '& > *': { mb: 5 } }}>
                                  {displayGroups.slice(0, visibleGroupsCount).map((group, index) => (
                                    <GroupCard
                                      key={group.id}
                                      index={index} // 传递索引用于动画延迟
                                      group={group}
                                      sortMode={sortMode === SortMode.None ? 'None' : sortMode === SortMode.CrossGroupDrag ? 'CrossGroupDrag' : 'SiteSort'}
                                      currentSortingGroupId={currentSortingGroupId}
                                      viewMode={viewMode}
                                      onUpdate={handleSiteUpdate}
                                      onDelete={handleSiteDelete}
                                      onStartSiteSort={startSiteSort}
                                      onAddSite={handleOpenAddSite}
                                      onUpdateGroup={handleGroupUpdate}
                                      onDeleteGroup={handleGroupDelete}
                                      onBatchDelete={handleBatchDeleteSites}
                                      onSiteClick={handleSiteClick}
                                      onSettingsOpen={handleSiteSettingsOpen}
                                      configs={configs}
                                      draggedSiteId={draggedSiteId}
                                      globalToggleVersion={globalToggleVersion}
                                      onBatchFeaturedUpdate={handleBatchFeaturedUpdate}
                                      isAdmin={isAdmin}
                                    />
                                  ))}
                                  {displayGroups.length > visibleGroupsCount && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                      <CircularProgress size={24} />
                                    </Box>
                                  )}
                                </Box>
                              )}

                              <DragOverlay dropAnimation={{
                                duration: 200,
                                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                              }}>
                                {activeSite ? (
                                  <Box sx={{ width: { xs: 200, sm: 220, md: 250, lg: 280, xl: 300 }, padding: 1 }}>
                                    <SiteCard
                                      site={activeSite}
                                      onUpdate={() => { }}
                                      onDelete={() => { }}
                                      onSiteClick={() => { }}
                                      isEditMode={true}
                                      viewMode={viewMode}
                                      iconApi={configs['site.iconApi']}
                                    />
                                  </Box>
                                ) : null}
                              </DragOverlay>
                            </DndContext>
                          </Box>
                        </Fade>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* 新增分组对话框 */}
              {openAddGroup && (
                <Suspense fallback={null}>
                  <AddGroupDialog
                    open={openAddGroup}
                    onClose={handleCloseAddGroup}
                    api={api}
                    groups={groups}
                    onSuccess={() => {
                      handleSuccess('分组创建成功');
                      fetchData();
                    }}
                  />
                </Suspense>
              )}

              {/* 新增站点对话框 */}
              <Dialog
                open={openAddSite}
                onClose={handleCloseAddSite}
                maxWidth='md'
                fullWidth
                PaperProps={{
                  sx: {
                    m: { xs: 2, sm: 'auto' },
                    width: { xs: 'calc(100% - 32px)', sm: 'auto' },
                  },
                }}
              >
                <DialogTitle>
                  新增站点
                  <IconButton
                    aria-label='close'
                    onClick={handleCloseAddSite}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>请输入新站点的信息</DialogContentText>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        flexDirection: { xs: 'column', sm: 'row' },
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          autoFocus
                          margin='dense'
                          id='site-name'
                          name='name'
                          label='站点名称'
                          type='text'
                          fullWidth
                          variant='outlined'
                          value={newSite.name}
                          onChange={handleSiteInputChange}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          margin='dense'
                          id='site-url'
                          name='url'
                          label='站点URL'
                          type='url'
                          fullWidth
                          variant='outlined'
                          value={newSite.url}
                          onChange={handleSiteInputChange}
                          onBlur={(e) => handleUrlBlur(e.target.value)}
                        />
                      </Box>
                    </Box>
                    <TextField
                      margin='dense'
                      id='site-icon'
                      name='icon'
                      label='图标URL'
                      type='url'
                      fullWidth
                      variant='outlined'
                      value={newSite.icon}
                      onChange={handleSiteInputChange}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton
                              onClick={() => {
                                if (!newSite.url) {
                                  handleError('请先输入站点URL');
                                  return;
                                }
                                const domain = extractDomain(newSite.url);
                                if (domain) {
                                  const actualIconApi =
                                    configs['site.iconApi'] ||
                                    'https://www.faviconextractor.com/favicon/{domain}';
                                  const iconUrl = actualIconApi.replace('{domain}', domain);
                                  setNewSite({
                                    ...newSite,
                                    icon: iconUrl,
                                  });
                                } else {
                                  handleError('无法从URL中获取域名');
                                }
                              }}
                              edge='end'
                              title='自动获取图标'
                            >
                              <AutoFixHighIcon />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      margin='dense'
                      id='site-description'
                      name='description'
                      label='站点描述'
                      type='text'
                      fullWidth
                      variant='outlined'
                      value={newSite.description}
                      onChange={handleSiteInputChange}
                    />
                    <TextField
                      margin='dense'
                      id='site-notes'
                      name='notes'
                      label='备注'
                      type='text'
                      fullWidth
                      multiline
                      rows={2}
                      variant='outlined'
                      value={newSite.notes}
                      onChange={handleSiteInputChange}
                    />

                    {/* 公开/私密开关 */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={newSite.is_public !== 0}
                          onChange={(e) =>
                            setNewSite({ ...newSite, is_public: e.target.checked ? 1 : 0 })
                          }
                          color='primary'
                        />
                      }
                      label={
                        <Box>
                          <Typography variant='body1'>
                            {newSite.is_public !== 0 ? '公开站点' : '私密站点'}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {newSite.is_public !== 0
                              ? '所有访客都可以看到此站点'
                              : '只有管理员登录后才能看到此站点'}
                          </Typography>
                        </Box>
                      }
                    />
                  </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                  <Button onClick={handleCloseAddSite} variant='outlined'>
                    取消
                  </Button>
                  <Button onClick={handleCreateSite} variant='contained' color='primary'>
                    创建
                  </Button>
                </DialogActions>
              </Dialog>

              {/* 网站配置对话框 */}
              <Dialog
                open={openConfig}
                onClose={handleCloseConfig}
                maxWidth='sm'
                fullWidth
                PaperProps={{
                  sx: {
                    m: { xs: 2, sm: 3, md: 4 },
                    width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' },
                    maxWidth: { sm: '600px' },
                  },
                }}
              >
                <DialogTitle>
                  网站设置
                  <IconButton
                    aria-label='close'
                    onClick={handleCloseConfig}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>配置网站的基本信息和外观</DialogContentText>
                  <Stack spacing={2}>
                    <TextField
                      margin='dense'
                      id='site-title'
                      name='site.title'
                      label='网站标题 (浏览器标签)'
                      type='text'
                      fullWidth
                      variant='outlined'
                      value={tempConfigs['site.title']}
                      onChange={handleConfigInputChange}
                    />
                    <TextField
                      margin='dense'
                      id='site-name'
                      name='site.name'
                      label='网站名称 (显示在页面中)'
                      type='text'
                      fullWidth
                      variant='outlined'
                      value={tempConfigs['site.name']}
                      onChange={handleConfigInputChange}
                    />

                    {/* UI Style Toggle */}
                    <Box sx={{ mb: 1, mt: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Typography variant='subtitle1' gutterBottom>
                        界面风格
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={tempConfigs['ui.style'] !== 'classic'} // Default to modern if undefined or 'modern'
                            onChange={(e) =>
                              setTempConfigs({
                                ...tempConfigs,
                                'ui.style': e.target.checked ? 'modern' : 'classic',
                              })
                            }
                            color='primary'
                          />
                        }
                        label={
                          <Box>
                            <Typography variant='body1'>
                              {tempConfigs['ui.style'] === 'classic' ? '经典模式' : '现代模式 (Glassmorphism)'}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {tempConfigs['ui.style'] === 'classic'
                                ? '使用传统的卡片样式和背景图片'
                                : '使用毛玻璃特效和动态渐变背景'}
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                    {/* 获取图标API设置项 */}
                    <Box sx={{ mb: 1 }}>
                      <Typography variant='subtitle1' gutterBottom>
                        获取图标API设置
                      </Typography>
                      <TextField
                        margin='dense'
                        id='site-icon-api'
                        name='site.iconApi'
                        label='获取图标API URL'
                        type='text'
                        fullWidth
                        variant='outlined'
                        value={tempConfigs['site.iconApi']}
                        onChange={handleConfigInputChange}
                        placeholder='https://example.com/favicon/{domain}'
                        helperText='输入获取图标API的地址，使用 {domain} 作为域名占位符'
                      />
                    </Box>
                    {/* 新增背景图片设置 */}
                    <Box sx={{ mb: 1 }}>
                      <Typography variant='subtitle1' gutterBottom>
                        背景图片设置
                      </Typography>
                      <TextField
                        margin='dense'
                        id='site-background-image'
                        name='site.backgroundImage'
                        label='背景图片URL'
                        type='url'
                        fullWidth
                        variant='outlined'
                        value={tempConfigs['site.backgroundImage']}
                        onChange={handleConfigInputChange}
                        placeholder='https://example.com/background.jpg'
                        helperText='输入图片URL，留空则不使用背景图片'
                      />

                      <Box sx={{ mt: 2, mb: 1 }}>
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          id='background-opacity-slider'
                          gutterBottom
                        >
                          背景蒙版透明度: {Number(tempConfigs['site.backgroundOpacity']).toFixed(2)}
                        </Typography>
                        <Slider
                          aria-labelledby='background-opacity-slider'
                          name='site.backgroundOpacity'
                          min={0}
                          max={1}
                          step={0.01}
                          valueLabelDisplay='auto'
                          value={Number(tempConfigs['site.backgroundOpacity'])}
                          onChange={(_, value) => {
                            setTempConfigs({
                              ...tempConfigs,
                              'site.backgroundOpacity': String(value),
                            });
                          }}
                        />
                        <Typography variant='caption' color='text.secondary'>
                          值越大，背景图片越清晰，内容可能越难看清
                        </Typography>
                      </Box>
                    </Box>
                    {/* 搜索框功能设置 */}
                    <Box sx={{ mb: 1 }}>
                      <Typography variant='subtitle1' gutterBottom>
                        搜索框功能设置
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={tempConfigs['site.searchBoxEnabled'] === 'true'}
                            onChange={(e) =>
                              setTempConfigs({
                                ...tempConfigs,
                                'site.searchBoxEnabled': e.target.checked ? 'true' : 'false',
                              })
                            }
                            color='primary'
                          />
                        }
                        label={
                          <Box>
                            <Typography variant='body1'>启用搜索框</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              控制是否在页面中显示搜索框功能
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                    <TextField
                      margin='dense'
                      id='site-custom-css'
                      name='site.customCss'
                      label='自定义CSS'
                      type='text'
                      fullWidth
                      multiline
                      rows={6}
                      variant='outlined'
                      value={tempConfigs['site.customCss']}
                      onChange={handleConfigInputChange}
                      placeholder='/* 自定义样式 */\nbody { }'
                    />

                  </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                  <Button onClick={handleCloseConfig} variant='outlined'>
                    取消
                  </Button>
                  <Button onClick={handleSaveConfig} variant='contained' color='primary'>
                    保存设置
                  </Button>
                </DialogActions>
              </Dialog>

              {/* 导入数据对话框 */}
              <Dialog
                open={openImport}
                onClose={handleCloseImport}
                maxWidth='sm'
                fullWidth
                PaperProps={{
                  sx: {
                    m: { xs: 2, sm: 'auto' },
                    width: { xs: 'calc(100% - 32px)', sm: 500 },
                    minHeight: 450,
                  },
                }}
              >
                <DialogTitle>
                  导入数据
                  <IconButton
                    aria-label='close'
                    onClick={handleCloseImport}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </DialogTitle>
                <DialogContent sx={{ minHeight: 220 }}>
                  <Tabs
                    value={importType}
                    onChange={(_e, v) => {
                      setImportType(v as 'json' | 'chrome');
                      setImportError(null);
                    }}
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Tab label='JSON 数据' value='json' />
                    <Tab label='Chrome 书签' value='chrome' />
                  </Tabs>
                  <DialogContentText sx={{ mb: 2, minHeight: 40 }}>
                    {importType === 'json'
                      ? '请选择要导入的JSON文件，导入将覆盖现有数据。'
                      : '请选择 Chrome 导出的书签 HTML 文件，按文件夹分组导入，同名分组自动合并。'}
                  </DialogContentText>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant='outlined'
                      component='label'
                      startIcon={<FileUploadIcon />}
                      sx={{ mb: 2 }}
                      disabled={importLoading}
                    >
                      选择文件
                      <input
                        type='file'
                        hidden
                        accept={importType === 'json' ? '.json' : '.html,.htm'}
                        onChange={handleFileSelect}
                      />
                    </Button>
                    {importFile && (
                      <Typography variant='body2' sx={{ mt: 1 }}>
                        已选择: {importFile.name}
                      </Typography>
                    )}
                  </Box>
                  {importType === 'chrome' && importLoading && chromeImportProgress > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress variant='determinate' value={chromeImportProgress} />
                        </Box>
                        <Typography variant='body2' color='text.secondary' sx={{ minWidth: 40, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {importRemainingSeconds !== null && importRemainingSeconds > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.5)' }}>约 {importRemainingSeconds} 秒</span>
                          )}
                          <span>{chromeImportProgress}%</span>
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {importError && (
                    <Alert severity='error' sx={{ mb: 2 }}>
                      {importError}
                    </Alert>
                  )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                  <Button onClick={handleCloseImport} variant='outlined' disabled={importLoading}>
                    取消
                  </Button>
                  <Button
                    onClick={handleImportData}
                    variant='contained'
                    color='primary'
                    disabled={!importFile || importLoading}
                    startIcon={importLoading ? <CircularProgress size={20} /> : <FileUploadIcon />}
                  >
                    {importLoading ? '导入中...' : '导入'}
                  </Button>
                </DialogActions>
              </Dialog>

            </ActiveLayout>
            <ScrollTop>
              <Fab size="large" aria-label="scroll back to top" color="primary">
                <KeyboardArrowUpIcon fontSize="large" />
              </Fab>
            </ScrollTop>
          </Box >

          {/* AI 智能问答悬浮窗 */}
          {
            isAuthenticated && (
              <Suspense fallback={null}>
                <AIChatPanel
                  api={api}
                  username={username}
                  avatarUrl={avatarUrl}
                  groups={groups}
                  onAddSite={async (site) => {
                    const targetGroup = groups.find(g => g.id === site.groupId);
                    const orderNum = targetGroup ? targetGroup.sites.length : 0;
                    const placeholderName = site.name || site.title || new URL(site.url).hostname;
                    const initialSiteData = {
                      group_id: site.groupId,
                      name: placeholderName,
                      url: site.url,
                      order_num: orderNum,
                      is_public: 1,
                      icon: `https://www.faviconextractor.com/favicon/${new URL(site.url).hostname}`,
                      description: '',
                      notes: ''
                    };

                    const tempId = Date.now() * -1;
                    setGroups(prevGroups => prevGroups.map(group => {
                      if (group.id === site.groupId) {
                        return {
                          ...group,
                          sites: [...group.sites, { ...initialSiteData, id: tempId } as any]
                        };
                      }
                      return group;
                    }));
                    handleSuccess(`已开始添加 URL: ${site.url}`);

                    (async () => {
                      try {
                        const createdSite = await api.createSite(initialSiteData);
                        if (createdSite && createdSite.id) {
                          setGroups(prevGroups => prevGroups.map(group => {
                            if (group.id === site.groupId) {
                              return {
                                ...group,
                                sites: group.sites.map(s => s.id === tempId ? { ...s, id: createdSite.id } : s)
                              };
                            }
                            return group;
                          }));

                          const info = await api.fetchSiteInfo(site.url) as any;
                          if (info.success) {
                            const updatedFields = {
                              name: info.name || placeholderName,
                              description: info.description || '',
                              icon: info.icon || ''
                            };
                            await api.updateSite(createdSite.id, updatedFields);
                            setGroups(prevGroups => prevGroups.map(group => {
                              if (group.id === site.groupId) {
                                return {
                                  ...group,
                                  sites: group.sites.map(s => s.id === createdSite.id ? { ...s, ...updatedFields } : s)
                                };
                              }
                              return group;
                            }));
                          }
                        }
                      } catch (error) {
                        console.error('AI Chat bookmarking failed:', error);
                        handleError('后台数据同步失败');
                      }
                    })();
                    return true;
                  }}
                />
              </Suspense>
            )
          }

          {/* 搜索结果触发的分组编辑对话框 */}
          {
            groupToEdit && (
              <EditGroupDialog
                open={!!groupToEdit}
                group={groupToEdit}
                onClose={() => setGroupToEdit(null)}
                onSave={(updated) => {
                  handleGroupUpdate(updated);
                  setGroupToEdit(null);
                }}
                onDelete={(id) => {
                  handleGroupDelete(id);
                  setGroupToEdit(null);
                }}
              />
            )
          }

          {/* 清除所有数据确认对话框 */}
          <Dialog
            open={clearDataConfirmOpen}
            onClose={() => !loading && setClearDataConfirmOpen(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: { borderRadius: 3, p: 1 }
            }}
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main', fontWeight: 'bold' }}>
              <WarningIcon /> 危险操作确认
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                您确定要<strong>清除所有书签和分组</strong>吗？
              </Typography>
              <Typography variant="body2" color="text.secondary">
                此操作将彻底删除数据库中所有的个人书签数据，且<strong>不可撤销</strong>。清空后系统将为您保留一个默认的初始分组。
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setClearDataConfirmOpen(false)}
                disabled={loading}
              >
                取消
              </Button>
              <LoadingButton
                onClick={handleClearAllData}
                loading={loading}
                variant="contained"
                color="error"
                startIcon={<DeleteSweepIcon />}
              >
                确认清空
              </LoadingButton>
            </DialogActions>
          </Dialog>

          <SiteSettingsModal
            site={siteToSettings || { id: 0, name: '', url: '', group_id: 0, order_num: 0, is_public: 1, icon: '', description: '', notes: '' }}
            open={isSettingsOpen}
            onUpdate={(updated) => {
              handleSiteUpdate(updated);
              setIsSettingsOpen(false);
            }}
            onDelete={(id) => {
              handleSiteDelete(id);
              setIsSettingsOpen(false);
            }}
            onClose={() => setIsSettingsOpen(false)}
            groups={groups}
            iconApi={configs['site.iconApi']}
            api={api}
          />
        </>
      )}
    </ThemeProvider>
  );
}

export default App;
