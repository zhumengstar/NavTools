import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Avatar,
    Chip,
    CircularProgress,
    Alert,
} from '@mui/material';
import { UserListItem } from '../API/http';
import { NavigationClient, MockNavigationClient } from '../API/client';

interface UserManagementProps {
    api: NavigationClient | MockNavigationClient;
}

const UserManagement: React.FC<UserManagementProps> = ({ api }) => {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const data = await api.getAdminUsers();
                if (Array.isArray(data)) {
                    setUsers(data);
                    setError(null);
                } else {
                    setError('API 返回的数据格式不正确');
                }
            } catch (err) {
                console.error('Fetch users error:', err);
                setError(err instanceof Error ? err.message : '获取用户列表失败 (请检查网络或权限)');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [api]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                注册用户列表 ({users.length})
            </Typography>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {users.length > 0 && users.every(u => u.group_count === 0 && u.site_count === 0) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontStyle: 'italic' }}>
                    * 调试提示：统计数据全为 0。如果这不符合预期，请告知管理员检查数据库关联。
                    {(users as any).debug && ` (Debug: ${JSON.stringify((users as any).debug)})`}
                </Typography>
            )}

            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table sx={{ minWidth: 650 }} aria-label="user list table">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell>用户</TableCell>
                            <TableCell>ID</TableCell>
                            <TableCell>角色</TableCell>
                            <TableCell>统计</TableCell>
                            <TableCell>注册时间</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow
                                key={user.id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <TableCell component="th" scope="row">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Avatar
                                            src={user.avatar_url || ''}
                                            alt={user.username}
                                            sx={{ width: 40, height: 40 }}
                                        >
                                            {user.username.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                {user.username}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {user.email || '未绑定邮箱'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip label={user.id} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.role === 'admin' ? '管理员' : '普通用户'}
                                        size="small"
                                        color={user.role === 'admin' ? 'primary' : 'default'}
                                        variant={user.role === 'admin' ? 'filled' : 'outlined'}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Box>
                                        <Typography variant="body2">
                                            分组: <b>{user.group_count}</b>
                                        </Typography>
                                        <Typography variant="body2">
                                            书签: <b>{user.site_count}</b>
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                    {new Date(user.created_at).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    暂无注册用户
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default UserManagement;
