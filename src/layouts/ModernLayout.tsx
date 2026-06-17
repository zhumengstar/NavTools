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

    const bookmarkCountBadgeSx = useMemo(() => ({
        ml: { xs: 1, md: 1.5 },
        px: { xs: 1.05, md: 1.25 },
        py: { xs: 0.3, md: 0.4 },
        minWidth: { xs: 34, md: 40 },
        justifyContent: 'center',
        fontFamily: '"Orbitron", "Inter", sans-serif',
        fontSize: { xs: '0.78rem', md: '0.9rem' },
        fontWeight: 900,
        letterSpacing: '.04em',
        borderRadius: '999px',
        background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.28)}, ${alpha(theme.palette.secondary.light, 0.22)})`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.secondary.main, 0.18)})`,
        color: theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.primary.dark,
        WebkitTextFillColor: theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.primary.dark,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.45 : 0.28)}`,
        verticalAlign: 'middle',
        boxShadow: theme.palette.mode === 'dark'
            ? `0 0 0 1px ${alpha(theme.palette.common.white, 0.08)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.26)}`
            : `0 4px 14px ${alpha(theme.palette.primary.main, 0.16)}`,
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        backdropFilter: 'blur(8px)',
        textShadow: theme.palette.mode === 'dark' ? `0 1px 8px ${alpha(theme.palette.common.black, 0.45)}` : 'none',
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
                                    <Box component="span" sx={bookmarkCountBadgeSx}>
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
                                    <Box component="span" sx={bookmarkCountBadgeSx}>
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
