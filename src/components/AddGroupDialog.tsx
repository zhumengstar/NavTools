import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Switch,
    Typography,
    Box,
    IconButton,
    CircularProgress,
    Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Group } from '../API/http';

interface AddGroupDialogProps {
    open: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
    groups: Group[]; // 用于查重
    onSuccess: () => void; // 创建成功后的回调（刷新数据等）
}

const AddGroupDialog: React.FC<AddGroupDialogProps> = ({
    open,
    onClose,
    api,
    groups,
    onSuccess,
}) => {
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        if (loading) return;
        onClose();
        // 重置状态
        setTimeout(() => {
            setName('');
            setIsPublic(true);
            setError(null);
        }, 200);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('分组名称不能为空');
            return;
        }

        // 前端查重
        const trimmedName = name.trim().toLowerCase();
        const isDuplicate = groups.some(g => g.name.trim().toLowerCase() === trimmedName);
        if (isDuplicate) {
            setError('该分组名称已存在，请换一个名称');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const newGroup: Partial<Group> = {
                name: name.trim(),
                is_public: isPublic ? 1 : 0,
                order_num: groups.length + 100, // 默认放在最后
            };

            await api.createGroup(newGroup);

            // 成功
            onSuccess(); // 这里由父组件处理提示和刷新
            handleClose();
        } catch (err: any) {
            console.error('创建分组失败:', err);
            const errorMsg = err.message || '未知错误';
            if (errorMsg.includes('已存在')) {
                setError('分组名称已存在');
            } else {
                setError('创建分组失败: ' + errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth='md'
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
                新增分组
                <IconButton
                    aria-label='close'
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                    }}
                    disabled={loading}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>请输入新分组的信息</DialogContentText>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    autoFocus
                    margin='dense'
                    id='group-name'
                    label='分组名称'
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError(null);
                    }}
                    sx={{ mb: 2 }}
                    disabled={loading}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleCreate();
                        }
                    }}
                />

                {/* 公开/私密开关 */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            color='primary'
                            disabled={loading}
                        />
                    }
                    label={
                        <Box>
                            <Typography variant='body1'>
                                {isPublic ? '公开分组' : '私密分组'}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                                {isPublic
                                    ? '所有访客都可以看到此分组'
                                    : '只有管理员登录后才能看到此分组'}
                            </Typography>
                        </Box>
                    }
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={handleClose} variant='outlined' disabled={loading}>
                    取消
                </Button>
                <Button
                    onClick={handleCreate}
                    variant='contained'
                    color='primary'
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {loading ? '创建中...' : '创建'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddGroupDialog;
