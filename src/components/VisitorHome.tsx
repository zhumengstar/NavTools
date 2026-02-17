
import React, { useEffect, useState, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardActionArea,
    CardContent,
    Avatar,
    Chip,
    Button,
    CircularProgress,
    useTheme,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Language as LanguageIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import { Site, Group } from '../API/http';
import SearchBox from './SearchBox';
import { SearchResultItem } from '../utils/search';

interface VisitorHomeProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
    onLoginClick: () => void;
}

interface RandomSite {
    site: Site;
    groupName: string;
    ownerName: string;
}

const VisitorHome: React.FC<VisitorHomeProps> = ({ api, onLoginClick }) => {
    const theme = useTheme();
    const [sites, setSites] = useState<RandomSite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // 搜索相关状态
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredSites, setFilteredSites] = useState<RandomSite[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 获取随机站点
    const fetchRandomSites = async (isInitial: boolean) => {
        try {
            if (isInitial) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError(null);
            const data = await api.getRandomSites(24);
            setSites(data);
            setFilteredSites(data);
            setIsSearching(false);
            setSearchQuery('');
        } catch (err) {
            console.error('获取推荐内容失败:', err);
            setError('获取推荐内容失败，请稍后重试');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRandomSites(true);
    }, [api]);

    // 转换站点数据为 SearchBox 所需的格式
    const searchContext = useMemo(() => {
        const uniqueGroups = Array.from(new Set(sites.map(s => s.groupName))).map((name, index) => ({
            id: -(index + 1), // 临时 ID
            name: name,
            order_num: index,
            user_id: 0,
            is_public: 1,
            created_at: '',
            updated_at: ''
        })) as Group[];

        const searchSites = sites.map(s => ({
            ...s.site,
            group_id: uniqueGroups.find(g => g.name === s.groupName)?.id || 0
        })) as Site[];

        return { groups: uniqueGroups, sites: searchSites };
    }, [sites]);

    // 实时搜索逻辑
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSites(sites);
            setIsSearching(false);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = sites.filter(item =>
            item.site.name.toLowerCase().includes(query) ||
            item.site.url.toLowerCase().includes(query) ||
            (item.site.description && item.site.description.toLowerCase().includes(query)) ||
            item.groupName.toLowerCase().includes(query)
        );
        setFilteredSites(filtered);
        setIsSearching(true);
    }, [searchQuery, sites]);

    // 处理搜索结果点击逻辑
    const handleSearchResult = (result?: SearchResultItem) => {
        if (!result) return;

        // 如果点击了面板结果（虽然目前已禁用下拉面板，但保留逻辑以防万一）
        if (result.type === 'site') {
            const site = sites.find(s => s.site.id === result.id);
            if (site) {
                setFilteredSites([site]);
                setIsSearching(true);
            }
        } else if (result.type === 'group') {
            const groupSites = sites.filter(s => s.groupName === result.name);
            setFilteredSites(groupSites);
            setIsSearching(true);
        }
    };

    // 获取网站图标 URL
    const getIconUrl = (icon: string) => {
        if (!icon) return '';
        if (icon.startsWith('http')) return icon;
        return `/${icon}`;
    };

    const displaySites = isSearching ? filteredSites : sites;

    return (
        <Container maxWidth="lg" sx={{ py: 4, minHeight: '80vh' }}>
            {/* 头部欢迎区域 */}
            <Box sx={{ textAlign: 'center', mb: 6 }}>
                <Typography
                    variant="h3"
                    component="h1"
                    fontWeight="bold"
                    gutterBottom
                    sx={{
                        background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    探索发现
                </Typography>

                <Box sx={{ mb: 4, mt: 2 }}>
                    <SearchBox
                        groups={searchContext.groups}
                        sites={searchContext.sites}
                        onInternalResultClick={handleSearchResult}
                        onQueryChange={setSearchQuery}
                        showDropdown={false}
                    />
                </Box>

                <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
                    {isSearching ? `搜索结果 (${filteredSites.length})` : '正在浏览由管理员精心为您挑选的社区精选书签，开启网络探索之旅'}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={onLoginClick}
                        sx={{ borderRadius: 2 }}
                    >
                        立即登录 / 注册
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchRandomSites(false)}
                        disabled={refreshing}
                        sx={{ borderRadius: 2 }}
                    >
                        换一批
                    </Button>
                    {isSearching && (
                        <Button
                            variant="text"
                            size="large"
                            onClick={() => {
                                setIsSearching(false);
                                setFilteredSites(sites);
                            }}
                            sx={{ borderRadius: 2 }}
                        >
                            清除搜索
                        </Button>
                    )}
                </Box>
            </Box>

            {/* 内容区域 */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography color="error">{error}</Typography>
                    <Button onClick={() => fetchRandomSites(true)} sx={{ mt: 2 }}>重试</Button>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5, opacity: refreshing ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    {displaySites.length === 0 ? (
                        <Box sx={{ width: '100%', textAlign: 'center', py: 8 }}>
                            <Typography color="text.secondary">未找到相关书签</Typography>
                        </Box>
                    ) : (
                        displaySites.map((item, index) => (
                            <Box
                                key={`${item.site.id}-${index}`}
                                sx={{
                                    width: { xs: '100%', sm: '50%', md: '33.33%', lg: '25%' },
                                    px: 1.5,
                                    mb: 3,
                                    opacity: 0,
                                    animation: `fadeIn 0.3s ease-out forwards ${index * 0.05}s`,
                                    '@keyframes fadeIn': {
                                        from: { opacity: 0, transform: 'translateY(20px)' },
                                        to: { opacity: 1, transform: 'translateY(0)' },
                                    },
                                }}
                            >
                                <Card
                                    elevation={2}
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderRadius: 2,
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: theme.shadows[8],
                                        },
                                    }}
                                >
                                    <CardActionArea
                                        href={item.site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                                    >
                                        <CardContent sx={{ width: '100%', p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                {item.site.icon ? (
                                                    <Avatar
                                                        src={getIconUrl(item.site.icon)}
                                                        alt={item.site.name}
                                                        variant="rounded"
                                                        sx={{ width: 40, height: 40, mr: 1.5, flexShrink: 0 }}
                                                        imgProps={{ style: { objectFit: 'cover' } }}
                                                    />
                                                ) : (
                                                    <Avatar
                                                        variant="rounded"
                                                        sx={{ width: 40, height: 40, mr: 1.5, bgcolor: 'primary.light', flexShrink: 0 }}
                                                    >
                                                        <LanguageIcon />
                                                    </Avatar>
                                                )}
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                                        {item.site.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                                        {new URL(item.site.url).hostname}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    mb: 2,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    height: 40,
                                                }}
                                            >
                                                {item.site.description || '暂无描述'}
                                            </Typography>

                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                                                <Chip
                                                    label={item.groupName}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.7rem' }}
                                                />
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <PersonIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.5 }} />
                                                    <Typography variant="caption" color="text.disabled">
                                                        {item.ownerName}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Box>
                        ))
                    )}
                </Box>
            )}
        </Container>
    );
};

export default VisitorHome;
