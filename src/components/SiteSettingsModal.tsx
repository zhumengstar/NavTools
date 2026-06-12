// src/components/SiteSettingsModal.tsx
import { useState, useEffect, memo } from 'react';
import { Site, Group } from '../API/http';
import { extractDomain, isSecureUrl } from '../utils/url';
import { decryptCredential, encryptCredential } from '../utils/credentialsCrypto';
// Material UI 导入
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Avatar,
  useTheme,
  SelectChangeEvent,
  InputAdornment,
  Alert,
  FormControlLabel,
  Switch,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface SiteSettingsModalProps {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;
  onClose: () => void;
  open: boolean;
  groups?: Group[]; // 可选的分组列表
  iconApi?: string; // 图标API配置
  credentialSecret?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any;
}

const SiteSettingsModal = memo(function SiteSettingsModal({
  site,
  onUpdate,
  onDelete,
  onClose,
  open,
  groups = [],
  iconApi = 'https://www.faviconextractor.com/favicon/{domain}?larger=true',
  credentialSecret = null,
  api,
}: SiteSettingsModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 存储字符串形式的group_id，与Material-UI的Select兼容
  const [formData, setFormData] = useState({
    name: site.name,
    url: site.url,
    icon: site.icon || '',
    description: site.description || '',
    notes: site.notes || '',
    account_username: '',
    account_password: '',
    group_id: String(site.group_id),
    is_public: site.is_public ?? 1, // 默认为公开
    is_featured: site.is_featured ?? 0,
  });

  // 用于预览图标
  const [iconPreview, setIconPreview] = useState<string | null>(site.icon || null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [showAccountPassword, setShowAccountPassword] = useState(false);

  // 当外部 site 属性更新时（或者弹窗打开时），同步内部表单状态
  useEffect(() => {
    if (open) {
      setFormData({
        name: site.name,
        url: site.url,
        icon: site.icon || '',
        description: site.description || '',
        notes: site.notes || '',
        account_username: '',
        account_password: '',
        group_id: String(site.group_id),
        is_public: site.is_public ?? 1,
        is_featured: site.is_featured ?? 0,
      });
      setIconPreview(site.icon || null);
    }
  }, [site, open]);

  useEffect(() => {
    if (!open) return;

    const hasCredentials = Boolean(site.account_username_encrypted || site.account_password_encrypted);
    if (!hasCredentials) {
      setCredentialError(null);
      return;
    }

    if (!credentialSecret) {
      setCredentialError('需要使用当前账号密码登录后才能解密已保存的网站账号密码。');
      return;
    }

    let cancelled = false;
    setCredentialError(null);

    Promise.all([
      decryptCredential(site.account_username_encrypted || '', credentialSecret),
      decryptCredential(site.account_password_encrypted || '', credentialSecret),
    ])
      .then(([accountUsername, accountPassword]) => {
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          account_username: accountUsername,
          account_password: accountPassword,
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setCredentialError('网站账号密码解密失败，请确认是使用创建/保存该凭据时的账号密码登录。');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, site.account_username_encrypted, site.account_password_encrypted, credentialSecret]);

  // 验证错误
  const [validationError, setValidationError] = useState<string | null>(null);


  // 处理表单字段变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 处理下拉列表变化
  const handleSelectChange = (e: SelectChangeEvent) => {
    setFormData((prev) => ({
      ...prev,
      group_id: e.target.value,
    }));
  };

  // 处理图标上传或URL输入
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, icon: value }));

    // 检查URL是否是有效的图片URL
    const isValidImageUrl = (url: string): boolean => {
      // 检查URL格式
      try {
        new URL(url);
        // 检查是否是常见图片格式
        return (
          /\.(jpeg|jpg|gif|png|svg|webp|ico)(\?.*)?$/i.test(url) ||
          /^https?:\/\/.*\/favicon\.(ico|png)(\?.*)?$/i.test(url) ||
          /^data:image\//i.test(url)
        );
      } catch {
        return false;
      }
    };

    // 仅当输入看起来像有效的图片URL时才设置预览
    if (value && isValidImageUrl(value)) {
      setIconPreview(value);
    } else {
      setIconPreview(null);
    }
  };

  // 处理图标加载错误
  const handleIconError = () => {
    setIconPreview(null);
  };

  // 提交表单

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 验证 URL
    if (!formData.url) {
      setValidationError('网站地址不能为空');
      return;
    }

    setValidationError(null);

    // 如果名称为空，自动从 URL生成
    let finalName = formData.name;
    let finalDescription = formData.description;
    let finalIcon = formData.icon;

    if (!finalName || finalName.trim() === '') {
      const domain = extractDomain(formData.url);
      finalName = domain || 'New Site';
    }

    // 验证图标 URL（如果提供）
    if (finalIcon && !isSecureUrl(finalIcon) && !finalIcon.startsWith('/')) {
      setValidationError('图标 URL 不安全，只允许 HTTPS 协议和公网地址');
      return;
    }

    // 更新网站信息，将group_id转为数字
    let accountUsernameEncrypted = site.account_username_encrypted || '';
    let accountPasswordEncrypted = site.account_password_encrypted || '';
    const hasAccountCredentials = Boolean(formData.account_username || formData.account_password);

    if (hasAccountCredentials) {
      if (!credentialSecret) {
        setValidationError('请重新使用账号密码登录后再保存网站账号密码。');
        return;
      }

      try {
        accountUsernameEncrypted = await encryptCredential(formData.account_username || '', credentialSecret);
        accountPasswordEncrypted = await encryptCredential(formData.account_password || '', credentialSecret);
      } catch {
        setValidationError('网站账号密码加密失败，请稍后重试。');
        return;
      }
    } else {
      accountUsernameEncrypted = '';
      accountPasswordEncrypted = '';
    }

    const siteFormData = {
      name: formData.name,
      url: formData.url,
      icon: formData.icon,
      description: formData.description,
      notes: formData.notes,
      group_id: formData.group_id,
      is_public: formData.is_public,
      is_featured: formData.is_featured,
    };

    onUpdate({
      ...site,
      ...siteFormData,
      name: finalName,
      description: finalDescription,
      icon: finalIcon,
      account_username_encrypted: accountUsernameEncrypted,
      account_password_encrypted: accountPasswordEncrypted,
      group_id: Number(formData.group_id),
    });

    onClose();
  };

  // 自动获取站点信息
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const fetchSiteInfo = async (url: string) => {
    if (!url) return;

    // 只有当名称或描述为空时才自动填充
    if (formData.name && formData.description) return;

    try {
      setFetchingInfo(true);

      // 1. 自动获取图标 (保持现有逻辑)
      const domain = extractDomain(url);
      if (domain) {
        const actualIconApi = iconApi || 'https://www.faviconextractor.com/favicon/{domain}?larger=true';
        const iconUrl = actualIconApi.replace('{domain}', domain);
        if (!formData.icon) {
          setFormData(prev => ({ ...prev, icon: iconUrl }));
          setIconPreview(iconUrl);
        }
      }

      // 2. 自动获取标题和描述
      // @ts-ignore - api type is any for now or defined in prop
      if (api && typeof api.fetchSiteInfo === 'function') {
        const info = await api.fetchSiteInfo(url);
        if (info.success) {
          setFormData(prev => ({
            ...prev,
            name: prev.name || info.name || prev.name,
            description: prev.description || info.description || prev.description,
          }));
        }
      }
    } catch (err) {
      console.error('自动获取站点信息失败:', err);
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleUrlBlur = async () => {
    if (!formData.url) return;

    let url = formData.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
      setFormData(prev => ({ ...prev, url }));
    }

    try {
      new URL(url);
    } catch {
      return;
    }

    await fetchSiteInfo(url);
  };

  // 打开弹窗时，如果 URL 存在但信息不全，尝试自动获取
  useEffect(() => {
    if (open && formData.url && (!formData.name || !formData.description)) {
      // 延迟一点执行，避免和渲染冲突
      const timer = setTimeout(() => {
        handleUrlBlur();
      }, 500);
      return () => { clearTimeout(timer); };
    }
    return undefined;
  }, [open]);

  // 点击删除按钮 (直接执行删除，不再确认)
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (site.id) {
      onDelete(site.id);
      onClose();
    }
  };


  // 计算首字母图标
  const fallbackIcon = formData.name?.charAt(0).toUpperCase() || 'A';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      fullScreen={isMobile}
      sx={{ zIndex: 1400 }} // Ensure above import progress
      PaperProps={{
        sx: {
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 2,
          pb: 1.5,
        }}
      >
        <Typography variant='h6' component='div' fontWeight='600'>
          网站设置
        </Typography>
        <IconButton edge='end' color='inherit' onClick={onClose} aria-label='关闭' size='small'>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            {/* 验证错误提示 */}
            {validationError && (
              <Alert severity='error' onClose={() => setValidationError(null)}>
                {validationError}
              </Alert>
            )}

            {/* 网站名称 */}
            <TextField
              id='name'
              name='name'
              label='网站名称'
              // required
              fullWidth
              value={formData.name || ''}
              onChange={handleChange}
              placeholder='输入网站名称'
              variant='outlined'
              size='small'
            />

            {/* 网站链接 */}
            <TextField
              id='url'
              name='url'
              label='网站链接'
              required
              fullWidth
              value={formData.url || ''}
              onChange={handleChange}
              onBlur={handleUrlBlur}
              placeholder='https://example.com'
              variant='outlined'
              size='small'
              type='url'
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {fetchingInfo && <Typography variant="caption" color="text.secondary">获取信息中...</Typography>}
                  </InputAdornment>
                ),
              }}
            />

            {/* 网站图标 */}
            <Box>
              <Typography variant='body2' color='text.secondary' gutterBottom>
                图标 URL
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {iconPreview ? (
                  <Avatar
                    src={iconPreview}
                    alt={formData.name || 'Icon Preview'}
                    sx={{ width: 40, height: 40, borderRadius: 1.5 }}
                    imgProps={{
                      onError: handleIconError,
                      style: { objectFit: 'cover' },
                    }}
                    variant='rounded'
                  />
                ) : (
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: 'primary.light',
                      color: 'primary.main',
                      border: '1px solid',
                      borderColor: 'primary.main',
                    }}
                    variant='rounded'
                  >
                    {fallbackIcon}
                  </Avatar>
                )}

                <TextField
                  id='icon'
                  name='icon'
                  fullWidth
                  value={formData.icon || ''}
                  onChange={handleIconChange}
                  placeholder='https://example.com/icon.png'
                  variant='outlined'
                  size='small'
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => {
                            if (!formData.url) {
                              // handleError("请先输入站点URL");
                              return;
                            }
                            const domain = extractDomain(formData.url);
                            if (domain) {
                              const actualIconApi =
                                iconApi ||
                                'https://www.faviconextractor.com/favicon/{domain}?larger=true';
                              const iconUrl = actualIconApi.replace('{domain}', domain);
                              setFormData((prev) => ({
                                ...prev,
                                icon: iconUrl,
                              }));
                              setIconPreview(iconUrl);
                            } else {
                              // handleError("无法从URL中获取域名");
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
              </Box>
            </Box>

            {/* 分组选择 */}
            {groups.length > 0 && (
              <FormControl fullWidth size='small'>
                <InputLabel id='group-select-label'>所属分组</InputLabel>
                <Select
                  labelId='group-select-label'
                  id='group_id'
                  name='group_id'
                  value={formData.group_id}
                  label='所属分组'
                  onChange={handleSelectChange}
                  MenuProps={{
                    sx: { zIndex: 1500 }
                  }}
                >
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 网站描述 */}
            <TextField
              id='description'
              name='description'
              label='网站描述'
              multiline
              rows={2}
              fullWidth
              value={formData.description || ''}
              onChange={handleChange}
              placeholder='简短的网站描述'
              variant='outlined'
              size='small'
            />

            {/* 备注 */}
            <TextField
              id='notes'
              name='notes'
              label='备注'
              multiline
              rows={3}
              fullWidth
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder='可选的私人备注'
              variant='outlined'
              size='small'
            />

            <Divider />

            <Box>
              <Typography variant='subtitle2' fontWeight='600' gutterBottom>
                账号密码
              </Typography>
              <Stack spacing={1.5}>
                {credentialError && (
                  <Alert severity='warning'>
                    {credentialError}
                  </Alert>
                )}
                <TextField
                  id='account_username'
                  name='account_username'
                  label='登录账号'
                  fullWidth
                  value={formData.account_username || ''}
                  onChange={handleChange}
                  placeholder='可选，用于记录此网站的登录账号'
                  variant='outlined'
                  size='small'
                  autoComplete='off'
                  disabled={Boolean(credentialError && !credentialSecret)}
                />
                <TextField
                  id='account_password'
                  name='account_password'
                  label='登录密码'
                  fullWidth
                  value={formData.account_password || ''}
                  onChange={handleChange}
                  placeholder='保存时会先在本地加密'
                  variant='outlined'
                  size='small'
                  type={showAccountPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  disabled={Boolean(credentialError && !credentialSecret)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          edge='end'
                          size='small'
                          onClick={() => setShowAccountPassword((prev) => !prev)}
                          aria-label={showAccountPassword ? '隐藏密码' : '显示密码'}
                        >
                          {showAccountPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant='caption' color='text.secondary'>
                  服务器只保存密文，解密需要当前登录时输入的账号密码。
                </Typography>
              </Stack>
            </Box>

            {/* 公开/私密开关、精选开关与上次访问时间展示 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_public !== 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_public: e.target.checked ? 1 : 0,
                        }))
                      }
                      color='primary'
                    />
                  }
                  label={
                    <Box>
                      <Typography variant='body1'>
                        {formData.is_public !== 0 ? '公开站点' : '私密站点'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {formData.is_public !== 0
                          ? '所有访客都可以看到此站点'
                          : '只有管理员登录后才能看到此站点'}
                      </Typography>
                    </Box>
                  }
                />

                {/* 设为精选 (仅管理员可见) */}
                {api.isAdmin && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_featured === 1}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            is_featured: e.target.checked ? 1 : 0,
                          }))
                        }
                        color='secondary'
                      />
                    }
                    label={
                      <Box>
                        <Typography variant='body1'>
                          设为精选
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          推荐至“探索发现”页面中展示
                        </Typography>
                        {formData.is_featured === 1 && formData.is_public === 0 && (
                          <Typography variant='caption' color='error.main' sx={{ display: 'block', mt: 0.5 }}>
                            注意：私密站点在访客模式下仍不可见
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                )}
              </Box>

              {/* 上次访问时间展示 */}
              {site.last_clicked_at && (
                <Box sx={{ textAlign: 'right', alignSelf: 'flex-end' }}>
                  <Typography variant='caption' display='block' color='text.secondary'>
                    上次点击时间
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {site.last_clicked_at ? new Date(site.last_clicked_at.replace(' ', 'T')).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''}
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'space-between' }}>
          <Button
            type="button"
            onClick={handleDeleteClick}
            color='error'
            variant='contained'
            startIcon={<DeleteIcon />}
          >
            删除
          </Button>

          <Box>
            <Button
              onClick={onClose}
              color='inherit'
              variant='outlined'
              sx={{ mr: 1.5 }}
              startIcon={<CancelIcon />}
            >
              取消
            </Button>
            <Button
              type='submit'
              color='primary'
              variant='contained'
              startIcon={<SaveIcon />}
            >
              保存
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
});

export default SiteSettingsModal;
