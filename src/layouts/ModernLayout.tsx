import React from 'react';
import {
    Box,
    AppBar,
    Toolbar,
    Typography,
    Container,
    useScrollTrigger,
    Slide,


    alpha,
    useTheme,
} from '@mui/material';

import { useMemo } from 'react';

interface Props {
    children: React.ReactNode;
    headerContent?: React.ReactNode; // Content for the right side of the header (search, theme toggle, avatar)
    sidebarContent?: React.ReactNode;
    title?: string;
    bookmarkCount?: number;
}

function HideOnScroll(props: { children: React.ReactElement }) {
    const { children } = props;
    const trigger = useScrollTrigger();

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}

const ModernLayout: React.FC<Props> = ({ children, headerContent, title = "NavTools", bookmarkCount = 0 }) => {
    const theme = useTheme();

    const glassStyle = useMemo(() => ({
        background: alpha(theme.palette.background.paper, 0.6),
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: `0 4px 30px ${alpha(theme.palette.common.black, 0.05)}`,
    }), [theme]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <HideOnScroll>
                <AppBar
                    position="sticky"
                    color="transparent"
                    elevation={0}
                    sx={glassStyle}
                >
                    <Container maxWidth="xl">
                        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 80 } }}>
                            {/* Logo / Title */}
                            <Typography
                                variant="h5"
                                noWrap
                                component="div"
                                sx={{
                                    mr: 2,
                                    display: { xs: 'none', md: 'flex' },
                                    fontFamily: '"Orbitron", "Inter", sans-serif', // 更现代的字体
                                    fontWeight: 900,
                                    letterSpacing: '.15rem',
                                    textDecoration: 'none',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, #a78bfa 0%, #34d399 100%)' // 深色模式：紫罗兰到薄荷绿
                                        : 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)', // 浅色模式：靛蓝到粉色
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    filter: theme.palette.mode === 'dark' ? 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.3))' : 'none',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        filter: theme.palette.mode === 'dark' ? 'drop-shadow(0 0 12px rgba(167, 139, 250, 0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                                        transform: 'scale(1.02)',
                                    }
                                }}
                            >
                                {title}
                                {bookmarkCount !== undefined && bookmarkCount > 0 && (
                                    <Box component="span" sx={{
                                        ml: 1.5,
                                        px: 1,
                                        py: 0.2,
                                        fontSize: '0.75rem',
                                        borderRadius: '10px',
                                        background: alpha(theme.palette.primary.main, 0.15),
                                        color: theme.palette.mode === 'dark' ? '#a78bfa' : theme.palette.primary.main,
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                        verticalAlign: 'middle',
                                        letterSpacing: 0,
                                        fontFamily: theme.typography.fontFamily,
                                        fontWeight: 600
                                    }}>
                                        {bookmarkCount}
                                    </Box>
                                )}
                            </Typography>



                            {/* Mobile Title */}
                            <Typography
                                variant="h5"
                                noWrap
                                component="div"
                                sx={{
                                    mr: 2,
                                    display: { xs: 'flex', md: 'none' },
                                    flexGrow: 1,
                                    fontFamily: '"Orbitron", "Inter", sans-serif',
                                    fontWeight: 900,
                                    letterSpacing: '.1rem',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, #a78bfa 0%, #34d399 100%)'
                                        : 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    textDecoration: 'none',
                                }}
                            >
                                {title}
                                {bookmarkCount !== undefined && bookmarkCount > 0 && (
                                    <Box component="span" sx={{
                                        ml: 1,
                                        px: 0.8,
                                        py: 0.1,
                                        fontSize: '0.7rem',
                                        borderRadius: '8px',
                                        background: alpha(theme.palette.primary.main, 0.1),
                                        color: theme.palette.primary.main,
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                        letterSpacing: 0,
                                        fontFamily: theme.typography.fontFamily,
                                        fontWeight: 500
                                    }}>
                                        {bookmarkCount}
                                    </Box>
                                )}
                            </Typography>

                            {/* Right Side Content (Search, Avatar, ThemeToggle) */}
                            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                                {headerContent}
                            </Box>
                        </Toolbar>
                    </Container>
                </AppBar>
            </HideOnScroll>

            {/* Main Content */}
            <Container
                component="main"
                maxWidth="xl"
                sx={{
                    flexGrow: 1,
                    py: 4,
                    mt: 2,
                    position: 'relative',
                    zIndex: 1
                }}
            >
                {children}
            </Container>

            {/* Footer (Simplified) */}
            <Box
                component="footer"
                sx={{
                    py: 3,
                    px: 2,
                    mt: 'auto',
                    ...glassStyle,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderBottom: 'none',
                }}
            >
                <Container maxWidth="sm">
                    <Typography variant="body2" color="text.secondary" align="center">
                        {'© '}
                        {new Date().getFullYear()}
                        {' '}
                        {title}
                        {'. All rights reserved.'}
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
};

export default ModernLayout;
