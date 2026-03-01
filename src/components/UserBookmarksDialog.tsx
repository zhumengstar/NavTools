import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    Card,
    CardContent,
    Chip,
    Switch,
    FormControlLabel,
    IconButton,
    Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NavigationClient, MockNavigationClient } from '../API/client';
import { Group } from '../API/http';
import SiteCard from './SiteCard';
import EditGroupDialog from './EditGroupDialog';

interface UserBookmarksDialogProps {
    open: boolean;
    onClose: () => void;
    userId: number | null;
    username: string;
    api: NavigationClient | MockNavigationClient;
}

const UserBookmarksDialog: React.FC<UserBookmarksDialogProps> = ({ open, onClose, userId, username, api }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groups, setGroups] = useState<any[]>([]);
    const [visibleSiteCounts, setVisibleSiteCounts] = useState<Record<number, number>>({});
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (open && userId) {
            const fetchUserBookmarks = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const data = await api.getGroupsWithSites(userId, { includeDeleted });
                    console.log('[UserBookmarksDialog] Fetched data for userId:', userId, 'includeDeleted:', includeDeleted, 'data:', data);
                    if (data && data.length > 0) {
                        console.log('[UserBookmarksDialog] Sample group user_ids:', data.map(g => ({ id: g.id, user_id: g.user_id, name: g.name, siteCount: g.sites?.length })));
                    }
                    setGroups(data || []);
                    // 重置可见站点计数，因为数据可能已改变
                    setVisibleSiteCounts({});
                } catch (err) {
                    console.error('Fetch user bookmarks error:', err);
                    setError(err instanceof Error ? err.message : '获取用户书签失败');
                } finally {
                    setLoading(false);
                }
            };

            fetchUserBookmarks();
        }
    }, [open, userId, api, includeDeleted]);

    const handleClose = () => {
        setGroups([]);
        setError(null);
        onClose();
    };

    const handleShowMore = (groupId: number) => {
        setVisibleSiteCounts(prev => ({
            ...prev,
            [groupId]: (prev[groupId] || 40) + 40, // 初始显示40个，每次增加40个
        }));
    };

    const handleEditClick = (group: Group) => {
        setEditingGroup(group);
        setEditDialogOpen(true);
    };

    const handleUpdateGroup = async (updatedGroup: Group) => {
        try {
            const result = await api.updateGroup(updatedGroup.id as number, updatedGroup);
            if (result) {
                setGroups(prev => prev.map(g => g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g));
            }
            setEditDialogOpen(false);
            setEditingGroup(null);
        } catch (err) {
            console.error('Update group error:', err);
        }
    };

    const handleDeleteGroup = async (groupId: number) => {
        try {
            const success = await api.deleteGroup(groupId);
            if (success) {
                setGroups(prev => prev.filter(g => g.id !== groupId));
            }
            setEditDialogOpen(false);
            setEditingGroup(null);
        } catch (err) {
            console.error('Delete group error:', err);
        }
    };

    const toggleGroupCollapse = (groupId: number) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            sx={{ 
                '& .MuiDialog-paper': { 
                    minHeight: '60vh',
                    maxHeight: '80vh',
                    zIndex: 100000
                }
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {username} 的书签
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    用户ID: {userId}
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={includeDeleted}
                            onChange={(e) => setIncludeDeleted(e.target.checked)}
                            size="small"
                            color="primary"
                        />
                    }
                    label="显示已删除的书签"
                    sx={{ mt: 1 }}
                />
            </DialogTitle>
            
            <DialogContent sx={{ px: 2, py: 1 }}>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!loading && !error && groups.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            该用户暂无书签
                        </Typography>
                    </Box>
                )}

                {!loading && !error && groups.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {groups.map((group) => (
                            <Card key={group.id} variant="outlined">
                                <CardContent sx={{ pb: 1 }}>
                                    {/* 分组标题栏 - 点击可折叠/展开 */}
                                    <Box 
                                        sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1, 
                                            mb: collapsedGroups[group.id] ? 0 : 2,
                                            cursor: 'pointer',
                                            py: 0.5,
                                            px: 1,
                                            mx: -1,
                                            borderRadius: 1,
                                            '&:hover': {
                                                backgroundColor: 'action.hover'
                                            }
                                        }}
                                        onClick={() => toggleGroupCollapse(group.id)}
                                    >
                                        <ExpandMoreIcon 
                                            sx={{ 
                                                transform: collapsedGroups[group.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s'
                                            }}
                                        />
                                        <Typography 
                                            variant="h6" 
                                            sx={{ 
                                                fontWeight: 'bold', 
                                                flexGrow: 1,
                                                opacity: group.is_deleted ? 0.7 : 1,
                                                textDecoration: group.is_deleted ? 'line-through' : 'none'
                                            }}
                                        >
                                            {group.name}
                                        </Typography>
                                        {group.is_deleted && (
                                            <Chip 
                                                label="已删除"
                                                size="small"
                                                color="error"
                                                variant="outlined"
                                                sx={{ flexShrink: 0 }}
                                            />
                                        )}
                                        <Chip 
                                            label={`${group.sites?.length || 0} 个书签`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ flexShrink: 0 }}
                                        />
                                        <Tooltip title="编辑分组">
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditClick(group);
                                                }}
                                                sx={{ ml: 1, flexShrink: 0 }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    
                                    {/* 分组内容 - 可折叠 */}
                                    {!collapsedGroups[group.id] && (() => {
                                        const visibleCount = visibleSiteCounts[group.id] || 40;
                                        const sitesToShow = group.sites?.slice(0, visibleCount) || [];
                                        const totalSites = group.sites?.length || 0;
                                        const hasMore = totalSites > visibleCount;
                                        return (
                                            <>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2 }}>
                                                    {sitesToShow.map((site: any) => (
                                                        <Box 
                                                            key={site.id}
                                                            sx={{
                                                                position: 'relative',
                                                                opacity: site.is_deleted ? 0.7 : 1,
                                                                minWidth: 0, // 确保文字省略正常工作
                                                                '&::before': site.is_deleted ? {
                                                                    content: '"已删除"',
                                                                    position: 'absolute',
                                                                    top: 8,
                                                                    right: 8,
                                                                    backgroundColor: 'error.main',
                                                                    color: 'white',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 'bold',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 1,
                                                                    zIndex: 1,
                                                                } : {}
                                                            }}
                                                        >
                                                            <SiteCard
                                                                site={site}
                                                                onSettingsOpen={() => {}}
                                                                viewMode='readonly'
                                                            />
                                                        </Box>
                                                    ))}
                                                </Box>
                                                {hasMore && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                                        <Button 
                                                            variant="outlined" 
                                                            size="small"
                                                            onClick={() => handleShowMore(group.id)}
                                                        >
                                                            显示更多 ({totalSites - visibleCount} 个)
                                                        </Button>
                                                    </Box>
                                                )}
                                            </>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} variant="contained">
                    关闭
                </Button>
            </DialogActions>

            {editingGroup && (
                <EditGroupDialog
                    open={editDialogOpen}
                    group={editingGroup}
                    onClose={() => {
                        setEditDialogOpen(false);
                        setEditingGroup(null);
                    }}
                    onSave={handleUpdateGroup}
                    onDelete={handleDeleteGroup}
                />
            )}
        </Dialog>
    );
};

export default UserBookmarksDialog;
