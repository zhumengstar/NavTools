import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Typography,
    Box,
    CircularProgress
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { Group } from '../API/http';
import { NavigationClient } from '../API/client';
import { MockNavigationClient } from '../API/mock';

interface GroupSelectorDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (groupId: number) => void;
    api: NavigationClient | MockNavigationClient;
    title?: string;
}

const GroupSelectorDialog: React.FC<GroupSelectorDialogProps> = ({
    open,
    onClose,
    onConfirm,
    api,
    title = "选择目标分组"
}) => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

    useEffect(() => {
        if (open) {
            fetchGroups();
            setSelectedGroupId(null);
        }
    }, [open]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            // Get active groups
            const fetchedGroups = await api.getGroups();
            setGroups(fetchedGroups);
        } catch (error) {
            console.error("Failed to fetch groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedGroupId !== null) {
            onConfirm(selectedGroupId);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers sx={{ height: '400px', display: 'flex', flexDirection: 'column', p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <CircularProgress />
                    </Box>
                ) : groups.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <Typography color="text.secondary">没有可用的分组</Typography>
                    </Box>
                ) : (
                    <List sx={{ pt: 0, overflowY: 'auto' }}>
                        {groups.map((group) => (
                            <ListItemButton
                                key={group.id}
                                selected={selectedGroupId === group.id}
                                onClick={() => setSelectedGroupId(group.id || 0)}
                            >
                                <ListItemIcon>
                                    <FolderIcon color={selectedGroupId === group.id ? "primary" : "action"} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={group.name}
                                    secondary={`排序: ${group.order_num}`}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={selectedGroupId === null}
                >
                    确定
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default GroupSelectorDialog;
