import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  FormControlLabel,
  Checkbox,
  Link,
  IconButton,
  InputAdornment,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

type FormMode = 'login' | 'register' | 'resetPassword';

interface LoginFormProps {
  onLogin: (username: string, password: string, rememberMe: boolean) => void;
  onRegister: (username: string, password: string, email: string) => void;
  onResetPassword: (username: string, newPassword: string, code: string) => void;
  onSendCode: (username: string, email: string) => Promise<{ success: boolean; message?: string; code?: string }>;
  onGetEmail?: (username: string) => Promise<string | null>; // 新增：获取邮箱回调
  loading?: boolean;
  error?: string | null;
  registerLoading?: boolean;
  registerError?: string | null;
  registerSuccess?: string | null;
  resetPasswordLoading?: boolean;
  resetPasswordError?: string | null;
  resetPasswordSuccess?: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  onRegister,
  onResetPassword,
  onSendCode,
  onGetEmail, // 新增
  loading = false,
  error = null,
  registerLoading = false,
  registerError = null,
  registerSuccess = null,
  resetPasswordLoading = false,
  resetPasswordError = null,
  resetPasswordSuccess = null,
}) => {
  const [mode, setMode] = useState<FormMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState(''); // 新增验证码状态

  // 自动填充上次登录的账号密码
  React.useEffect(() => {
    try {
      const savedCredentials = localStorage.getItem('saved_credentials');
      if (savedCredentials && mode === 'login') {
        const decoded = atob(savedCredentials);
        const [savedUser, savedPass] = decoded.split(':');
        if (savedUser && savedPass) {
          setUsername(savedUser);
          setPassword(savedPass);
        }
      }
    } catch (e) {
      console.error('读取保存的凭据失败:', e);
      localStorage.removeItem('saved_credentials');
    }
  }, [mode]);

  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false); // 发送状态
  const [emailFetching, setEmailFetching] = useState(false); // 邮箱获取状态
  const [countdown, setCountdown] = useState(0); // 倒计时

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRememberMe(true);
    setLocalError(null);
    setEmailFetching(false);
  };

  const switchMode = (newMode: FormMode) => {
    resetForm();
    setMode(newMode);
  };

  // 提取获取邮箱的逻辑
  const fetchEmail = async (user: string) => {
    if (!user || !onGetEmail) return;

    setEmailFetching(true);
    setLocalError(null);
    try {
      const fetchedEmail = await onGetEmail(user);
      if (fetchedEmail) {
        setEmail(fetchedEmail);
        setLocalError(null);
      } else {
        setLocalError('未找到该用户绑定的邮箱');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEmailFetching(false);
    }
  };

  // 监听模式切换，如果在重置密码模式且已有用户名，自动获取邮箱
  React.useEffect(() => {
    if (mode === 'resetPassword' && username.trim()) {
      fetchEmail(username.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 用户名失去焦点时，尝试获取邮箱
  const handleUsernameBlur = async () => {
    if (mode === 'login' || !username.trim() || !onGetEmail) return;

    // 仅在重置密码模式下（或注册模式如果需要检查是否存在）自动获取
    if (mode === 'resetPassword') {
      fetchEmail(username.trim());
    }
  };

  // 通用校验：用户名
  const validateUsername = (): string | null => {
    if (!username.trim()) return '用户名不能为空';
    if (username.trim().length < 2) return '用户名长度至少为2个字符';
    if (username.trim().length > 32) return '用户名长度不能超过32个字符';
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username.trim())) {
      return '用户名只能包含字母、数字、下划线和中文';
    }
    return null;
  };

  // 通用校验：邮箱
  const validateEmail = (): string | null => {
    if (!email.trim()) return '邮箱不能为空';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return '请输入有效的邮箱地址';
    }
    return null;
  };

  // 通用校验：密码
  const validatePassword = (): string | null => {
    if (!password) return '密码不能为空';
    if (password.length < 6) return '密码长度至少为6个字符';
    if (password.length > 64) return '密码长度不能超过64个字符';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // 所有模式：校验用户名
    const usernameErr = validateUsername();
    if (usernameErr) { setLocalError(usernameErr); return; }

    // 所有模式：校验密码
    const passwordErr = validatePassword();
    if (passwordErr) { setLocalError(passwordErr); return; }

    if (mode === 'login') {
      onLogin(username.trim(), password, rememberMe);
    } else if (mode === 'register') {
      // 校验邮箱
      const emailErr = validateEmail();
      if (emailErr) { setLocalError(emailErr); return; }

      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致');
        return;
      }
      onRegister(username.trim(), password, email.trim());
    } else if (mode === 'resetPassword') {
      if (!code.trim()) {
        setLocalError('请输入验证码');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('两次输入的新密码不一致');
        return;
      }
      onResetPassword(username.trim(), password, code.trim());
    }
  };

  // 处理发送验证码
  const handleSendCode = async () => {
    const userErr = validateUsername();
    if (userErr) { setLocalError(userErr); return; }
    const emailErr = validateEmail();
    if (emailErr) { setLocalError(emailErr); return; }

    setCodeSending(true);
    setLocalError(null);
    try {
      const result = await onSendCode(username.trim(), email.trim());
      if (result.success) {
        // 如果有返回验证码 (开发模式)，自动填充
        if (result.code) {
          setCode(result.code);
        }

        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setLocalError(result.message || '发送验证码失败');
      }
    } catch (err) {
      setLocalError('网络错误，请稍后再试');
    } finally {
      setCodeSending(false);
    }
  };

  const isLoading = mode === 'login' ? loading : mode === 'register' ? registerLoading : resetPasswordLoading;
  const currentError = localError || (mode === 'login' ? error : mode === 'register' ? registerError : resetPasswordError);
  const currentSuccess = mode === 'register' ? registerSuccess : mode === 'resetPassword' ? resetPasswordSuccess : null;

  const getTitle = () => {
    switch (mode) {
      case 'login': return '导航站登录';
      case 'register': return '注册账号';
      case 'resetPassword': return '重置密码';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'login': return <LockOutlinedIcon fontSize='large' />;
      case 'register': return <PersonAddOutlinedIcon fontSize='large' />;
      case 'resetPassword': return <LockResetOutlinedIcon fontSize='large' />;
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return '登录';
      case 'register': return '注册';
      case 'resetPassword': return '重置密码';
    }
  };

  const isSubmitDisabled = () => {
    if (isLoading) return true;
    if (!username || !password) return true;
    if ((mode === 'register' || mode === 'resetPassword') && !confirmPassword) return true;
    return false;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        p: { xs: 2, sm: 4 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2.5, sm: 4 },
          borderRadius: { xs: 0, sm: 2 },
          width: '100%',
          maxWidth: { xs: '100%', sm: 400 },
          minHeight: { xs: '100vh', sm: 'auto' },
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.3)'
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box
            sx={{
              mb: 2,
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'primary.main',
              color: 'white',
            }}
          >
            {getIcon()}
          </Box>
          <Typography component='h1' variant='h5' fontWeight='bold' textAlign='center'>
            {getTitle()}
          </Typography>
        </Box>

        {currentError && (
          <Alert severity='error' sx={{ mb: 2 }}>
            {currentError}
          </Alert>
        )}

        {currentSuccess && (
          <Alert severity='success' sx={{ mb: 2 }}>
            {currentSuccess}
          </Alert>
        )}

        <Box component='form' onSubmit={handleSubmit}>
          <TextField
            margin='normal'
            required
            fullWidth
            id='username'
            label='用户名'
            name='username'
            autoComplete='username'
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (localError) setLocalError(null);
            }}
            onBlur={handleUsernameBlur}
            disabled={isLoading}
            sx={{ mb: 2 }}
          />
          {(mode === 'register' || mode === 'resetPassword') && (
            <TextField
              margin='normal'
              required
              fullWidth
              id='email'
              label='邮箱地址'
              name='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || emailFetching}
              placeholder="example@domain.com"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: emailFetching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
              }}
            />
          )}

          {mode === 'resetPassword' && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                required
                fullWidth
                id='code'
                label='验证码'
                name='code'
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
              />
              <Button
                variant='outlined'
                onClick={handleSendCode}
                disabled={codeSending || countdown > 0 || isLoading}
                sx={{ minWidth: 110, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </Box>
          )}
          <TextField
            margin='normal'
            required
            fullWidth
            name='password'
            label={mode === 'resetPassword' ? '新密码' : '密码'}
            type={showPassword ? 'text' : 'password'}
            id='password'
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* 注册和密码重置模式：确认密码 */}
          {(mode === 'register' || mode === 'resetPassword') && (
            <TextField
              margin='normal'
              required
              fullWidth
              name='confirmPassword'
              label={mode === 'resetPassword' ? '确认新密码' : '确认密码'}
              type={showPassword ? 'text' : 'password'}
              id='confirmPassword'
              autoComplete='new-password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* 登录模式：记住我 */}
          {mode === 'login' && (
            <FormControlLabel
              control={
                <Checkbox
                  value='remember'
                  color='primary'
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label='记住我（一个月内免登录）'
              sx={{ mb: 2 }}
            />
          )}

          <Button
            type='submit'
            fullWidth
            variant='contained'
            color='primary'
            disabled={isSubmitDisabled()}
            size='large'
            sx={{
              py: 1.5,
              mt: 1,
              mb: 2,
              borderRadius: 2,
            }}
          >
            {isLoading ? <CircularProgress size={24} color='inherit' /> : getButtonText()}
          </Button>

          {/* 底部链接 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {mode === 'login' && (
              <>
                <Link
                  component='button'
                  type='button'
                  variant='body2'
                  onClick={() => switchMode('register')}
                  sx={{ cursor: 'pointer' }}
                >
                  没有账号？注册一个
                </Link>
                <Link
                  component='button'
                  type='button'
                  variant='body2'
                  onClick={() => switchMode('resetPassword')}
                  sx={{ cursor: 'pointer' }}
                >
                  忘记密码？
                </Link>
              </>
            )}
            {mode === 'register' && (
              <Link
                component='button'
                type='button'
                variant='body2'
                onClick={() => switchMode('login')}
                sx={{ cursor: 'pointer' }}
              >
                已有账号？返回登录
              </Link>
            )}
            {mode === 'resetPassword' && (
              <Link
                component='button'
                type='button'
                variant='body2'
                onClick={() => switchMode('login')}
                sx={{ cursor: 'pointer' }}
              >
                返回登录
              </Link>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginForm;
