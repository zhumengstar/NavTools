import {
    Box,
    Paper,
    Skeleton,
    Fade,
} from '@mui/material';

/**
 * 站点卡片骨架屏
 */
const SiteCardSkeleton = () => (
    <Paper
        sx={{
            height: '100%',
            borderRadius: 3,
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.4)' : 'rgba(255, 255, 255, 0.4)',
        }}
    >
        <Box display='flex' alignItems='center' mb={1}>
            <Skeleton variant="rounded" width={32} height={32} sx={{ mr: 1.5, borderRadius: 1 }} />
            <Skeleton variant="text" width="60%" sx={{ fontSize: '1rem' }} />
        </Box>
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="40%" />
    </Paper>
);

/**
 * 分组卡片骨架屏
 */
const GroupCardSkeleton = () => (
    <Paper
        sx={{
            borderRadius: 4,
            p: { xs: 2, sm: 3 },
            mb: 5,
            backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(5px)',
            border: '1px solid',
            borderColor: 'divider',
        }}
    >
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
            <Skeleton variant="text" width="150px" sx={{ fontSize: '1.5rem' }} />
        </Box>

        <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            margin: -1
        }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <Box
                    key={i}
                    sx={{
                        width: {
                            xs: '50%',
                            sm: '33.33%',
                            md: '25%',
                            lg: '16.666%',
                            xl: '16.666%',
                        },
                        padding: 1,
                        boxSizing: 'border-box',
                    }}
                >
                    <SiteCardSkeleton />
                </Box>
            ))}
        </Box>
    </Paper>
);

/**
 * 完整的页面骨架屏
 */
export const PageSkeleton = () => (
    <Fade in timeout={500}>
        <Box>
            <GroupCardSkeleton />
            <GroupCardSkeleton />
        </Box>
    </Fade>
);

export default PageSkeleton;
