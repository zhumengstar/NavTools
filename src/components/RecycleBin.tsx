import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Tooltip,
    Checkbox,
    ListItemIcon,
    ListItemButton,
    InputAdornment,
    TextField,
    Tabs,
    Tab,
    Avatar
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Site, Group } from '../API/http';
import { NavigationClient } from '../API/client';
import { MockNavigationClient } from '../API/mock';
import GroupSelectorDialog from './GroupSelectorDialog';

interface RecycleBinProps {
    open: boolean;
    onClose: () => void;
    onRestore: (item: Site | Site[] | Group | Group[]) => void;
    api: NavigationClient | MockNavigationClient;
}

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <Box component="span" key={i} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '2px', px: '2px' }}>
                        {part}
                    </Box>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

// 获取高清图标URL的辅助函数
const getHighDefIcon = (iconUrl: string | null | undefined) => {
    if (!iconUrl) return undefined;
    // 如果是默认的 faviconextractor API，确保请求的是较高清版本
    if (iconUrl.includes('faviconextractor.com')) {
        if (!iconUrl.includes('larger=true')) {
            const separator = iconUrl.includes('?') ? '&' : '?';
            return `${iconUrl}${separator}larger=true`;
        }
    }
    return iconUrl;
};

const RecycleBin: React.FC<RecycleBinProps> = ({ open, onClose, onRestore, api }) => {
    // Original State
    const [tabValue, setTabValue] = useState(0);
    const [deletedSites, setDeletedSites] = useState<Site[]>([]);
    const [deletedGroups, setDeletedGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | 'batch' | null>(null);
    const [selectedSiteIds, setSelectedSiteIds] = useState<Set<number>>(new Set());
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Detail View State
    const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
    const [viewingGroupSites, setViewingGroupSites] = useState<Site[]>([]);

    // Group Selector State
    const [groupSelectorOpen, setGroupSelectorOpen] = useState(false);
    const [siteToRestore, setSiteToRestore] = useState<Site | null>(null);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [sites, groups] = await Promise.all([
                api.getTrashSites(),
                api.getTrashGroups()
            ]);
            setDeletedSites(sites);
            setDeletedGroups(groups);
        } catch (error) {
            console.error("Failed to fetch trash items:", error);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        if (open) {
            fetchData();
            setSelectedSiteIds(new Set());
            setSelectedGroupIds(new Set());
            setSearchQuery('');
            setTabValue(0);
            setViewingGroup(null);
        }
    }, [open, fetchData]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setSearchQuery('');
    };

    // Filter Logic
    const filteredSites = deletedSites.filter(site =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = deletedGroups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Selection Logic
    const selectedIds = tabValue === 0 ? selectedSiteIds : selectedGroupIds;
    const setSelectedIds = tabValue === 0 ? setSelectedSiteIds : setSelectedGroupIds;
    const currentFilteredItems = tabValue === 0 ? filteredSites : filteredGroups;

    const handleToggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        const currentFilteredIds = currentFilteredItems.map(item => item.id as number);
        const allFilteredSelected = currentFilteredIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (allFilteredSelected) {
            currentFilteredIds.forEach(id => newSelected.delete(id));
        } else {
            currentFilteredIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    // New Handlers
    const handleViewGroup = async (group: Group) => {
        setLoading(true);
        try {
            const sites = await api.getSites(group.id);
            setViewingGroup(group);
            setViewingGroupSites(sites);
        } catch (error) {
            console.error("Failed to fetch group sites:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToGroups = () => {
        setViewingGroup(null);
        setViewingGroupSites([]);
    };

    const handleRestoreSiteFromGroup = (site: Site) => {
        setSiteToRestore(site);
        setGroupSelectorOpen(true);
    };

    const handleConfirmRestoreToGroup = async (targetGroupId: number) => {
        if (!siteToRestore || !siteToRestore.id) return;

        setActionLoading(siteToRestore.id);
        try {
            // Check if site is currently in trash or just needs group update
            const isInTrash = deletedSites.some(s => s.id === siteToRestore.id);

            let restoredSite: Site | null = null;
            if (isInTrash) {
                // If it's in trash, we need to restore it AND move it
                // We'll update the group_id first so it restores to the right place
                await api.updateSite(siteToRestore.id, { group_id: targetGroupId });
                restoredSite = await api.restoreSite(siteToRestore.id);
            } else {
                // If it's NOT in trash (e.g. from viewing a deleted group), just move it
                restoredSite = await api.updateSite(siteToRestore.id, { group_id: targetGroupId });
            }

            if (restoredSite) {
                if (isInTrash) {
                    setDeletedSites(prev => prev.filter(s => s.id !== siteToRestore.id));
                } else {
                    setViewingGroupSites(prev => prev.filter(s => s.id !== siteToRestore.id));
                    // Update local site count of the viewed deleted group
                    setDeletedGroups(prev => prev.map(g => {
                        if (g.id === viewingGroup?.id) {
                            return { ...g, site_count: (g.site_count || 0) - 1 };
                        }
                        return g;
                    }));
                }
                onRestore(restoredSite);
            }
        } catch (error) {
            console.error("Failed to restore site to new group:", error);
        } finally {
            setActionLoading(null);
            setSiteToRestore(null);
            setGroupSelectorOpen(false);
        }
    };

    // Original Handlers
    const handleRestoreSite = async (site: Site) => {
        if (!site.id) return;
        setActionLoading(site.id);
        try {
            // Check if the target group exists and is not deleted
            const activeGroups = await api.getGroups();
            const groupExists = activeGroups.some(g => g.id === site.group_id);

            if (!groupExists) {
                // If group doesn't exist, prompt for new group
                setSiteToRestore(site);
                setGroupSelectorOpen(true);
                return;
            }

            const restoredSite = await api.restoreSite(site.id);
            if (restoredSite) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
                setSelectedSiteIds(prev => {
                    const next = new Set(prev);
                    next.delete(site.id as number);
                    return next;
                });
                onRestore(restoredSite);
            }
        } catch (error) {
            console.error("Failed to restore site:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRestoreGroup = async (group: Group) => {
        if (!group.id) return;
        setActionLoading(group.id);
        try {
            const restoredGroup = await api.restoreGroup(group.id);
            if (restoredGroup) {
                setDeletedGroups(prev => prev.filter(g => g.id !== group.id));
                setSelectedGroupIds(prev => {
                    const next = new Set(prev);
                    next.delete(group.id as number);
                    return next;
                });
                onRestore(restoredGroup);
            }
        } catch (error) {
            console.error("Failed to restore group:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleBatchRestore = async () => {
        if (selectedIds.size === 0) return;
        setActionLoading('batch');
        const ids = Array.from(selectedIds);

        try {
            if (tabValue === 0) {
                const success = await api.restoreSites(ids);
                if (success) {
                    const restoredSites = deletedSites.filter(s => selectedIds.has(s.id as number));
                    setDeletedSites(prev => prev.filter(s => !selectedIds.has(s.id as number)));
                    setSelectedSiteIds(new Set());
                    onRestore(restoredSites);
                }
            } else {
                const restoredGroups: Group[] = [];
                for (const id of ids) {
                    const restored = await api.restoreGroup(id);
                    if (restored) restoredGroups.push(restored);
                }
                setDeletedGroups(prev => prev.filter(g => !selectedIds.has(g.id as number)));
                setSelectedGroupIds(new Set());
                onRestore(restoredGroups);
            }
        } catch (error) {
            console.error("Failed to batch restore:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteSitePermanently = async (site: Site) => {
        if (!site.id) return;
        setActionLoading(site.id);
        try {
            const success = await api.deleteSitePermanently(site.id);
            if (success) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
                setSelectedSiteIds(prev => {
                    const next = new Set(prev);
                    next.delete(site.id as number);
                    return next;
                });
            }
        } catch (error) {
            console.error("Failed to delete site permanently:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteGroupPermanently = async (group: Group) => {
        if (!group.id) return;
        setActionLoading(group.id);
        try {
            const success = await api.deleteGroupPermanently(group.id);
            if (success) {
                setDeletedGroups(prev => prev.filter(g => g.id !== group.id));
                setSelectedGroupIds(prev => {
                    const next = new Set(prev);
                    next.delete(group.id as number);
                    return next;
                });
            }
        } catch (error) {
            console.error("Failed to delete group permanently:", error);
        } finally {
            setActionLoading(null);
        }
    }

    const handleBatchDeletePermanently = async () => {
        if (selectedIds.size === 0) return;
        setActionLoading('batch');
        const ids = Array.from(selectedIds);

        try {
            if (tabValue === 0) {
                const success = await api.deleteSitesPermanently(ids);
                if (success) {
                    setDeletedSites(prev => prev.filter(s => !selectedIds.has(s.id as number)));
                    setSelectedSiteIds(new Set());
                }
            } else {
                for (const id of ids) {
                    await api.deleteGroupPermanently(id);
                }
                setDeletedGroups(prev => prev.filter(g => !selectedIds.has(g.id as number)));
                setSelectedGroupIds(new Set());
            }
        } catch (error) {
            console.error("Failed to batch delete permanently:", error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            {viewingGroup ? (
                // Group Detail View
                <>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton onClick={handleBackToGroups} size="small">
                            <ArrowBackIcon />
                        </IconButton>
                        <FolderIcon color="action" sx={{ mr: 1 }} />
                        {viewingGroup.name}
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            (包含 {viewingGroupSites.length} 个书签)
                        </Typography>
                    </DialogTitle>
                    <DialogContent dividers sx={{ p: 0 }}>
                        <List sx={{ pt: 0 }}>
                            {viewingGroupSites.map(site => (
                                <ListItem
                                    key={site.id}
                                    divider
                                    secondaryAction={
                                        <Tooltip title="恢复并移动到...">
                                            <IconButton
                                                edge="end"
                                                color="primary"
                                                onClick={() => handleRestoreSiteFromGroup(site)}
                                                disabled={actionLoading === site.id}
                                            >
                                                <RestoreFromTrashIcon />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    <ListItemIcon sx={{ minWidth: 48 }}>
                                        <Avatar
                                            src={getHighDefIcon(site.icon)}
                                            variant="rounded"
                                            sx={{ width: 40, height: 40, borderRadius: 1.5 }}
                                        >
                                            {site.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={site.name}
                                        secondary={site.url}
                                        primaryTypographyProps={{ noWrap: true }}
                                        secondaryTypographyProps={{ noWrap: true }}
                                    />
                                </ListItem>
                            ))}
                            {viewingGroupSites.length === 0 && (
                                <Box sx={{ py: 4, textAlign: 'center' }}>
                                    <Typography color="text.secondary">此分组为空</Typography>
                                </Box>
                            )}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleBackToGroups}>返回</Button>
                    </DialogActions>
                </>
            ) : (
                // Main Recycle Bin View
                <>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            回收站
                            {selectedIds.size > 0 && (
                                <Typography variant="body1" color="primary" sx={{ ml: 2, fontWeight: 'bold' }}>
                                    已选中 {selectedIds.size} 项
                                </Typography>
                            )}
                        </Box>
                        {currentFilteredItems.length > 0 && !loading && (
                            <Button
                                size="small"
                                startIcon={
                                    currentFilteredItems.every(s => selectedIds.has(s.id as number))
                                        ? <DeselectIcon />
                                        : <SelectAllIcon />
                                }
                                onClick={handleSelectAll}
                            >
                                {currentFilteredItems.every(s => selectedIds.has(s.id as number))
                                    ? '取消全选'
                                    : '全选'}
                            </Button>
                        )}
                    </DialogTitle>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                        <Tabs value={tabValue} onChange={handleTabChange}>
                            <Tab label={`书签 (${deletedSites.length})`} />
                            <Tab label={`分组 (${deletedGroups.length})`} />
                        </Tabs>
                    </Box>
                    <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="搜索已删除的书签名称或链接..."
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon color="action" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchQuery && (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setSearchQuery('')}>
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Box>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                                <CircularProgress />
                            </Box>
                        ) : (tabValue === 0 && deletedSites.length === 0) || (tabValue === 1 && deletedGroups.length === 0) ? (
                            <Box sx={{ py: 8, textAlign: 'center' }}>
                                <Typography variant="h6" color="text.secondary">
                                    回收站是空的
                                </Typography>
                            </Box>
                        ) : currentFilteredItems.length === 0 ? (
                            <Box sx={{ py: 8, textAlign: 'center' }}>
                                <Typography variant="h6" color="text.secondary">
                                    未找到匹配项
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ pt: 0, overflowY: 'auto', flex: 1 }}>
                                {tabValue === 0 ? (
                                    // Sites List
                                    (currentFilteredItems as Site[]).map((site) => (
                                        <ListItem
                                            key={site.id}
                                            divider
                                            disablePadding
                                            sx={{
                                                transition: 'background-color 0.2s',
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                            secondaryAction={
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Tooltip title="恢复">
                                                        <IconButton
                                                            edge="end"
                                                            aria-label="restore"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRestoreSite(site);
                                                            }}
                                                            disabled={actionLoading !== null}
                                                            color="primary"
                                                            size="medium"
                                                        >
                                                            <RestoreFromTrashIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="彻底删除">
                                                        <IconButton
                                                            edge="end"
                                                            aria-label="delete"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteSitePermanently(site);
                                                            }}
                                                            disabled={actionLoading !== null}
                                                            color="error"
                                                            size="medium"
                                                        >
                                                            <DeleteForeverIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            }
                                        >
                                            <ListItemButton
                                                onClick={() => handleToggleSelect(site.id as number)}
                                                sx={{ py: 1.5 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 48 }}>
                                                    <Checkbox
                                                        edge="start"
                                                        checked={selectedIds.has(site.id as number)}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleSelect(site.id as number);
                                                        }}
                                                        size="medium"
                                                    />
                                                </ListItemIcon>
                                                <ListItemIcon sx={{ minWidth: 56 }}>
                                                    <Avatar
                                                        src={getHighDefIcon(site.icon)}
                                                        variant="rounded"
                                                        sx={{ width: 40, height: 40, borderRadius: 1.5 }}
                                                    >
                                                        {site.name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Tooltip
                                                            title={`点击访问: ${site.name}`}
                                                            placement="top-start"
                                                            enterDelay={500}
                                                            slotProps={{
                                                                tooltip: {
                                                                    sx: {
                                                                        fontSize: '1rem',
                                                                        maxWidth: 'none',
                                                                        whiteSpace: 'nowrap',
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <Box
                                                                component="span"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(site.url, '_blank');
                                                                }}
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                                                }}
                                                            >
                                                                <HighlightText text={site.name} highlight={searchQuery} />
                                                            </Box>
                                                        </Tooltip>
                                                    }
                                                    secondary={
                                                        <Tooltip
                                                            title={`点击访问: ${site.url}`}
                                                            placement="top-start"
                                                            enterDelay={500}
                                                            slotProps={{
                                                                tooltip: {
                                                                    sx: {
                                                                        fontSize: '1rem',
                                                                        maxWidth: 'none',
                                                                        whiteSpace: 'nowrap',
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <Box
                                                                component="span"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(site.url, '_blank');
                                                                }}
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.85rem',
                                                                    display: 'inline-block',
                                                                    maxWidth: '100%',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                                                }}
                                                            >
                                                                <HighlightText text={site.url} highlight={searchQuery} />
                                                            </Box>
                                                        </Tooltip>
                                                    }
                                                    primaryTypographyProps={{
                                                        noWrap: true,
                                                        sx: {
                                                            fontSize: '1.1rem',
                                                            fontWeight: selectedIds.has(site.id as number) ? 700 : 500,
                                                            color: 'text.primary'
                                                        }
                                                    }}
                                                    secondaryTypographyProps={{
                                                        noWrap: true,
                                                        sx: {
                                                            fontSize: '0.95rem',
                                                            mt: 0.5
                                                        }
                                                    }}
                                                    sx={{ mr: 10 }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    ))
                                ) : (
                                    // Groups List
                                    (currentFilteredItems as Group[]).map((group) => (
                                        <ListItem
                                            key={group.id}
                                            divider
                                            disablePadding
                                            sx={{
                                                transition: 'background-color 0.2s',
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                            secondaryAction={
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Tooltip title="恢复">
                                                        <IconButton
                                                            edge="end"
                                                            aria-label="restore"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRestoreGroup(group);
                                                            }}
                                                            disabled={actionLoading !== null}
                                                            color="primary"
                                                            size="medium"
                                                        >
                                                            <RestoreFromTrashIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="彻底删除">
                                                        <IconButton
                                                            edge="end"
                                                            aria-label="delete"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteGroupPermanently(group);
                                                            }}
                                                            disabled={actionLoading !== null}
                                                            color="error"
                                                            size="medium"
                                                        >
                                                            <DeleteForeverIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            }
                                        >
                                            <ListItemButton
                                                onClick={() => handleViewGroup(group)}
                                                sx={{ py: 1.5 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 48 }}>
                                                    <Checkbox
                                                        edge="start"
                                                        checked={selectedIds.has(group.id as number)}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleSelect(group.id as number);
                                                        }}
                                                        size="medium"
                                                    />
                                                </ListItemIcon>
                                                <ListItemIcon>
                                                    <FolderIcon color="action" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                fontWeight: 'bold',
                                                                display: 'flex', alignItems: 'center'
                                                            }}
                                                        >
                                                            <HighlightText text={group.name} highlight={searchQuery} />
                                                            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                                                (包含 {group.site_count || 0} 个书签)
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary="点击查看详情"
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    ))
                                )}
                            </List>
                        )}
                    </DialogContent>

                    {selectedIds.size > 0 && (
                        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="body2" color="text.secondary">
                                已选择 {selectedIds.size} 项
                            </Typography>
                            <Box>
                                <Button
                                    onClick={handleBatchDeletePermanently}
                                    color="error"
                                    sx={{ mr: 1 }}
                                    disabled={actionLoading !== null}
                                >
                                    批量删除
                                </Button>
                                <Button
                                    onClick={handleBatchRestore}
                                    variant="contained"
                                    disabled={actionLoading !== null}
                                >
                                    批量恢复
                                </Button>
                            </Box>
                        </DialogActions>
                    )}

                    <DialogActions>
                        <Button onClick={onClose}>关闭</Button>
                    </DialogActions>
                </>
            )}

            <GroupSelectorDialog
                open={groupSelectorOpen}
                onClose={() => setGroupSelectorOpen(false)}
                onConfirm={handleConfirmRestoreToGroup}
                api={api}
                title="选择恢复到的分组"
            />
        </Dialog>
    );
};

export default RecycleBin;
