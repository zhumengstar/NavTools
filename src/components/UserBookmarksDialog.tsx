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
} from '@mui/material';
import { NavigationClient, MockNavigationClient } from '../API/client';
import SiteCard from './SiteCard';

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

    useEffect(() => {
        if (open && userId) {
            const fetchUserBookmarks = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const data = await api.getGroupsWithSites(userId);
                    setGroups(data || []);
                } catch (err) {
                    console.error('Fetch user bookmarks error:', err);
                    setError(err instanceof Error ? err.message : '获取用户书签失败');
                } finally {
                    setLoading(false);
                }
            };

            fetchUserBookmarks();
        }
    }, [open, userId, api]);

    const handleClose = () => {
        setGroups([]);
        setError(null);
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { 
                    minHeight: '60vh',
                    maxHeight: '80vh'
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
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                                            {group.name}
                                        </Typography>
                                        <Chip 
                                            label={`${group.sites?.length || 0} 个书签`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                    
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
                                        {group.sites?.map((site: any) => (
                                            <SiteCard
                                                key={site.id}
                                                site={site}
                                                onSettingsOpen={() => {}}
                                                viewMode='readonly'
                                            />
                                        ))}
                                    </Box>
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
        </Dialog>
    );
};

export default UserBookmarksDialog;
