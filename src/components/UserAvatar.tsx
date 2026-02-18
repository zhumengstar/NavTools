import React, { useState, Suspense } from 'react';
import {
    Avatar,
    Box,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    List,
    ListItem,
    Chip,
    TextField,
    Alert,
    CircularProgress,
    useMediaQuery,
    useTheme,
    Switch,
    FormControlLabel,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EmailIcon from '@mui/icons-material/Email';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SortIcon from '@mui/icons-material/Sort';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SettingsIcon from '@mui/icons-material/Settings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
const RecycleBin = React.lazy(() => import('./RecycleBin'));
import { Site, Group } from '../API/http';

interface UserAvatarProps {
    username: string;
    avatarUrl?: string | null;
    onAvatarUpdate?: (url: string | null) => void;
    onLogout: () => void;
    onChangePassword?: (oldPassword: string, newPassword: string) => Promise<boolean>;
    onRestore: (item: Site | Site[] | Group | Group[]) => void;
    onStartGroupSort: () => void;
    onStartCrossGroupDrag: () => void;
    onOpenConfig: () => void;
    onExportData: () => void;
    onOpenImport: () => void;
    onOpenAddGroup: () => void;
    configs: Record<string, string>;
    onUpdateConfigs: (newConfigs: Record<string, string>) => Promise<void>;
    onResetData: () => void;
    isAdmin?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
    username,
    onLogout,
    onChangePassword,
    onRestore,
    onStartGroupSort,
    onStartCrossGroupDrag,
    onOpenConfig,
    onExportData,
    onOpenImport,
    onOpenAddGroup,
    configs,
    onUpdateConfigs,
    onResetData,
    isAdmin,
    api,
    avatarUrl: propAvatarUrl,
    onAvatarUpdate
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const [infoOpen, setInfoOpen] = useState(false);
    const [changePwdOpen, setChangePwdOpen] = useState(false);
    const [recycleBinOpen, setRecycleBinOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePwdLoading, setChangePwdLoading] = useState(false);
    const [changePwdError, setChangePwdError] = useState<string | null>(null);
    const [changePwdSuccess, setChangePwdSuccess] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [infoLoading, setInfoLoading] = useState(false);

    // 优先从缓存读取头像
    const getCachedAvatar = () => {
        try {
            const cached = localStorage.getItem('nav_profile_cache');
            if (cached) {
                const data = JSON.parse(cached);
                // 简单的过期检查 (虽然主要依赖 App.tsx 的 checkAuthStatus，这里作为 fallback)
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    return data.avatar_url;
                }
            }
        } catch (e) {
            console.error('Failed to read profile cache', e);
        }
        return null;
    };

    const [avatarUrl, setLocalAvatarUrl] = useState<string | null>(propAvatarUrl || getCachedAvatar() || null);

    // 同步外部属性到内部状态，如果外部有更新则覆盖
    React.useEffect(() => {
        if (propAvatarUrl !== undefined) {
            setLocalAvatarUrl(propAvatarUrl);
        }
    }, [propAvatarUrl]);

    // 组件挂载时，后台静默刷新头像并更新缓存
    React.useEffect(() => {
        const refreshProfile = async () => {
            if (!api.getUserProfile) return;
            try {
                const profile = await api.getUserProfile();
                if (profile && profile.avatar_url) {
                    // 如果头像有变化，更新状态和缓存
                    if (profile.avatar_url !== avatarUrl) {
                        setLocalAvatarUrl(profile.avatar_url);
                        onAvatarUpdate?.(profile.avatar_url);
                    }
                    // 更新缓存（即使 URL 没变也要更新时间戳等）
                    const cacheData = {
                        username: profile.username,
                        avatar_url: profile.avatar_url,
                        isAdmin: profile.role === 'admin' || profile.role === 'root', // 假设 role 字段存在
                        timestamp: Date.now()
                    };
                    localStorage.setItem('nav_profile_cache', JSON.stringify(cacheData));
                }
            } catch (error) {
                console.error("Silent profile refresh failed:", error);
            }
        };

        // 延迟一点执行，避免阻塞主线程渲染
        const timer = setTimeout(refreshProfile, 1000);
        return () => clearTimeout(timer);
    }, [api, onAvatarUpdate]); // 依赖项尽量少，避免频繁触发
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [editEmail, setEditEmail] = useState('');
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [editAvatar, setEditAvatar] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);

    const menuOpen = Boolean(anchorEl);

    const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleInfoOpen = async () => {
        handleMenuClose();
        setInfoOpen(true);
        setInfoLoading(true);
        try {
            const profile = await api.getUserProfile?.();
            if (profile) {
                if (profile.email) setUserEmail(profile.email);
                if (profile.avatar_url) {
                    setLocalAvatarUrl(profile.avatar_url);
                    onAvatarUpdate?.(profile.avatar_url);

                    // 更新缓存
                    const cacheData = {
                        username: profile.username,
                        avatar_url: profile.avatar_url,
                        isAdmin: profile.role === 'admin',
                        timestamp: Date.now()
                    };
                    localStorage.setItem('nav_profile_cache', JSON.stringify(cacheData));
                }
            }
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        } finally {
            setInfoLoading(false);
        }
    };

    const handleInfoClose = () => {
        setInfoOpen(false);
        setIsEditingEmail(false);
    };

    const handleUpdateEmail = async () => {
        if (!editEmail.trim()) {
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
            alert('请输入有效的邮箱地址');
            return;
        }

        setUpdateLoading(true);
        try {
            const result = await api.updateUserProfile({ email: editEmail.trim() });
            if (result.success) {
                setUserEmail(editEmail.trim());
                setIsEditingEmail(false);
            } else {
                alert(result.message || '更新邮箱失败');
            }
        } catch (error) {
            console.error('Failed to update email:', error);
            alert('更新邮箱失败');
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleUpdateAvatar = async (url?: string) => {
        const targetUrl = url !== undefined ? url : editAvatar.trim();
        console.log('[UserAvatar] Updating avatar to:', targetUrl);
        setUpdateLoading(true);
        try {
            const result = await api.updateUserProfile({ avatar_url: targetUrl });
            console.log('[UserAvatar] Update result:', result);
            if (result.success) {
                setLocalAvatarUrl(targetUrl);
                onAvatarUpdate?.(targetUrl);
                setIsEditingAvatar(false);
            } else {
                alert(result.message || '更新头像失败');
            }
        } catch (error) {
            console.error('Failed to update avatar:', error);
            alert('更新头像失败');
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) { // 1MB limit
            alert('图片大小不能超过 1MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            if (base64) {
                await handleUpdateAvatar(base64);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleChangePwdOpen = () => {
        handleMenuClose();
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePwdError(null);
        setChangePwdSuccess(null);
        setChangePwdOpen(true);
    };

    const handleChangePwdClose = () => {
        setChangePwdOpen(false);
    };

    const handleChangePwdSubmit = async () => {
        setChangePwdError(null);
        setChangePwdSuccess(null);

        if (!oldPassword) {
            setChangePwdError('请输入当前密码');
            return;
        }
        if (!newPassword) {
            setChangePwdError('请输入新密码');
            return;
        }
        if (newPassword.length < 6) {
            setChangePwdError('新密码长度至少为6个字符');
            return;
        }
        if (newPassword !== confirmPassword) {
            setChangePwdError('两次输入的新密码不一致');
            return;
        }

        if (onChangePassword) {
            setChangePwdLoading(true);
            try {
                const success = await onChangePassword(oldPassword, newPassword);
                if (success) {
                    setChangePwdSuccess('密码修改成功');
                    setTimeout(() => handleChangePwdClose(), 1500);
                } else {
                    setChangePwdError('密码修改失败，请检查当前密码是否正确');
                }
            } catch {
                setChangePwdError('密码修改失败');
            } finally {
                setChangePwdLoading(false);
            }
        }
    };

    const handleRecycleBinOpen = () => {
        handleMenuClose();
        setRecycleBinOpen(true);
    };

    const handleRecycleBinClose = () => {
        setRecycleBinOpen(false);
    };

    const handleRestoreItem = (item: Site | Site[] | Group | Group[]) => {
        if (onRestore) {
            onRestore(item);
        }
    };

    const handleLogoutClick = () => {
        handleMenuClose();
        onLogout();
    };


    // 基于用户名生成稳定的颜色 (Memoized)
    const avatarColor = React.useMemo(() => {
        const colors = [
            '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
            '#f57c00', '#0097a7', '#5d4037', '#455a64',
            '#e91e63', '#00838f', '#6a1b9a', '#ef6c00',
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }, [username]);

    // 获取用户名首字母 (Memoized)
    const avatarLetter = React.useMemo(() => {
        if (!username) return '?';
        return username.charAt(0).toUpperCase();
    }, [username]);

    const menuItemSx = { py: 1, minHeight: 40 };

    return (
        <>
            <IconButton
                onClick={handleAvatarClick}
                size='small'
                aria-controls={menuOpen ? 'user-menu' : undefined}
                aria-haspopup='true'
                aria-expanded={menuOpen ? 'true' : undefined}
                sx={{ ml: 1 }} // 移除 p:0 增加点击区域，添加 ml:1 保持间距
            >
                <Avatar
                    src={avatarUrl || undefined}
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: avatarUrl ? 'transparent' : avatarColor,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        '&:hover': {
                            boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)',
                        },
                    }}
                >
                    {!avatarUrl && avatarLetter}
                </Avatar>
            </IconButton>

            {/* 用户下拉菜单 */}
            <Menu
                id='user-menu'
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                // 改回左对齐，使其向右展开。
                // 这样看起来就在头像的“右侧”（起始点在左，向右对齐）
                // 同时也避免与左侧标题重叠，并利用右侧空间（如果是居中或者有余地）
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1.5, // 稍微增加间距
                            minWidth: 200, // 稍微加宽
                            borderRadius: 2,
                            boxShadow: theme.palette.mode === 'dark'
                                ? '0 4px 20px rgba(0,0,0,0.4)'
                                : '0 4px 20px rgba(0,0,0,0.1)',
                        },
                    },
                }}
            >
                {/* 用户名展示区域 */}
                <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                        src={avatarUrl || undefined}
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: avatarUrl ? 'transparent' : avatarColor,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                        }}
                    >
                        {!avatarUrl && avatarLetter}
                    </Avatar>
                    <Box>
                        <Typography variant='subtitle2' fontWeight='bold' noWrap sx={{ maxWidth: 140 }}>
                            {username}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                            已登录
                        </Typography>
                    </Box>
                </Box>
                <Divider />
                <MenuItem onClick={handleInfoOpen} sx={menuItemSx}>
                    <ListItemIcon>
                        <InfoOutlinedIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>账号信息</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleRecycleBinOpen} sx={menuItemSx}>
                    <ListItemIcon>
                        <DeleteSweepIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>书签回收站</ListItemText>
                </MenuItem>
                {onChangePassword && (
                    <MenuItem onClick={handleChangePwdOpen} sx={menuItemSx}>
                        <ListItemIcon>
                            <LockResetIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>修改密码</ListItemText>
                    </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onOpenAddGroup(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <CreateNewFolderIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>新增分组</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onStartGroupSort(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <SortIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>分组排序</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onStartCrossGroupDrag(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <SwapHorizIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>书签拖动</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onOpenConfig(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <SettingsIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>网站设置</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onExportData(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <FileDownloadIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>导出数据</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onOpenImport(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <FileUploadIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>导入数据</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onResetData(); }} sx={{ color: 'error.main', ...menuItemSx }}>
                    <ListItemIcon sx={{ color: 'error.main' }}>
                        <DeleteSweepIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>重置所有数据</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogoutClick} sx={{ color: 'error.main', ...menuItemSx }}>
                    <ListItemIcon sx={{ color: 'error.main' }}>
                        <LogoutIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>退出登录</ListItemText>
                </MenuItem>
            </Menu>

            {/* 账号信息对话框 - 延迟加载 */}
            {infoOpen && (
                <Dialog
                    open={infoOpen}
                    onClose={handleInfoClose}
                    maxWidth='xs'
                    fullWidth
                    fullScreen={isMobile}
                    sx={{ zIndex: 1400 }} // Ensure above import progress
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountCircleIcon color='primary' />
                        账号信息
                    </DialogTitle>
                    <DialogContent>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 2,
                                mb: 2,
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={avatarUrl || undefined}
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: avatarUrl ? 'transparent' : avatarColor,
                                        fontSize: '2rem',
                                        fontWeight: 'bold',
                                        mb: 1.5,
                                        flexShrink: 0,
                                        border: '2px solid',
                                        borderColor: 'divider'
                                    }}
                                >
                                    {infoLoading ? <CircularProgress size={40} /> : (!avatarUrl && avatarLetter)}
                                </Avatar>
                                <input
                                    accept="image/*"
                                    id="avatar-upload-input"
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />
                                <label htmlFor="avatar-upload-input">
                                    <IconButton
                                        component="span"
                                        size="small"
                                        sx={{
                                            position: 'absolute',
                                            bottom: 12,
                                            right: -8,
                                            bgcolor: 'background.paper',
                                            boxShadow: 2,
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                    >
                                        <PhotoCameraIcon fontSize="small" />
                                    </IconButton>
                                </label>
                            </Box>
                            <Typography variant='h6' fontWeight='bold'>
                                {username}
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <List dense disablePadding>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <PersonIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='用户名'
                                    secondary={username}
                                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                    secondaryTypographyProps={{ variant: 'body1' }}
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <AccountCircleIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                {isEditingAvatar ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editAvatar}
                                            onChange={(e) => setEditAvatar(e.target.value)}
                                            placeholder="图片 URL (例如: https://...)"
                                            disabled={updateLoading}
                                            autoFocus
                                        />
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => handleUpdateAvatar()}
                                            disabled={updateLoading || !editAvatar.trim() || editAvatar === avatarUrl}
                                        >
                                            保存
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => setIsEditingAvatar(false)}
                                            disabled={updateLoading}
                                        >
                                            取消
                                        </Button>
                                    </Box>
                                ) : (
                                    <>
                                        <ListItemText
                                            primary='头像地址'
                                            secondary={avatarUrl ? (avatarUrl.startsWith('data:image/') ? '[本地上传图片]' : avatarUrl) : '未设置'}
                                            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                            secondaryTypographyProps={{ variant: 'body1', noWrap: true, sx: { maxWidth: 200 } }}
                                        />
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setEditAvatar(avatarUrl && !avatarUrl.startsWith('data:image/') ? avatarUrl : '');
                                                setIsEditingAvatar(true);
                                            }}
                                        >
                                            修改
                                        </Button>
                                    </>
                                )}
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <EmailIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                {isEditingEmail ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                            placeholder="example@domain.com"
                                            disabled={updateLoading}
                                            autoFocus
                                        />
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={handleUpdateEmail}
                                            disabled={updateLoading || !editEmail.trim() || editEmail === userEmail}
                                        >
                                            保存
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => setIsEditingEmail(false)}
                                            disabled={updateLoading}
                                        >
                                            取消
                                        </Button>
                                    </Box>
                                ) : (
                                    <>
                                        <ListItemText
                                            primary='电子邮箱'
                                            secondary={userEmail || '未设置'}
                                            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                            secondaryTypographyProps={{ variant: 'body1' }}
                                        />
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setEditEmail(userEmail);
                                                setIsEditingEmail(true);
                                            }}
                                        >
                                            修改
                                        </Button>
                                    </>
                                )}
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <InfoOutlinedIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='账号状态'
                                    secondary={isAdmin ? '管理员' : '普通用户'}
                                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                />
                                <Chip label='已登录' color='success' size='small' variant='outlined' />
                            </ListItem>
                            <Divider sx={{ my: 1 }} />
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <DeleteSweepIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={configs['site.autoCleanDeadLinks'] === 'true'}
                                            onChange={(e) => {
                                                onUpdateConfigs({
                                                    ...configs,
                                                    'site.autoCleanDeadLinks': e.target.checked ? 'true' : 'false'
                                                });
                                            }}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body2">自动清理死链</Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                检测到网页无法访问时自动移动到回收站
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ ml: 0, width: '100%' }}
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <AutoFixHighIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={configs['site.autoCompleteInfo'] === 'true'}
                                            onChange={(e) => {
                                                onUpdateConfigs({
                                                    ...configs,
                                                    'site.autoCompleteInfo': e.target.checked ? 'true' : 'false'
                                                });
                                            }}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body2">后台补全网站信息</Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                自动获取并更新缺失标题、描述或图标的网站
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ ml: 0, width: '100%' }}
                                />
                            </ListItem>
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleInfoClose}>关闭</Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* 修改密码对话框 - 延迟加载 */}
            {changePwdOpen && (
                <Dialog
                    open={changePwdOpen}
                    onClose={handleChangePwdClose}
                    maxWidth='xs'
                    fullWidth
                    fullScreen={isMobile}
                    sx={{ zIndex: 1400 }} // Ensure above import progress
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LockResetIcon color='primary' />
                        修改密码
                    </DialogTitle>
                    <DialogContent>
                        {changePwdError && (
                            <Alert severity='error' sx={{ mb: 2, mt: 1 }}>
                                {changePwdError}
                            </Alert>
                        )}
                        {changePwdSuccess && (
                            <Alert severity='success' sx={{ mb: 2, mt: 1 }}>
                                {changePwdSuccess}
                            </Alert>
                        )}
                        <TextField
                            margin='dense'
                            label='当前密码'
                            type='password'
                            fullWidth
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            disabled={changePwdLoading}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            margin='dense'
                            label='新密码'
                            type='password'
                            fullWidth
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={changePwdLoading}
                            helperText='至少6个字符'
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            margin='dense'
                            label='确认新密码'
                            type='password'
                            fullWidth
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={changePwdLoading}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleChangePwdClose} disabled={changePwdLoading}>
                            取消
                        </Button>
                        <Button
                            onClick={handleChangePwdSubmit}
                            variant='contained'
                            disabled={changePwdLoading}
                        >
                            {changePwdLoading ? <CircularProgress size={20} /> : '确认修改'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* 回收站 - 延迟加载 */}
            {recycleBinOpen && (
                <Suspense fallback={null}>
                    <RecycleBin
                        open={recycleBinOpen}
                        onClose={handleRecycleBinClose}
                        onRestore={handleRestoreItem}
                        api={api}
                    />
                </Suspense>
            )}
        </>
    );
};

export default React.memo(UserAvatar);
