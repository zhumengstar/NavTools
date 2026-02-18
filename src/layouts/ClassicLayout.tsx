import React from 'react';
import {
    Box,
    Typography,
    Container,
    Fab,
    Theme,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { isSecureUrl } from '../utils/url';
import { useScrollTrigger, Zoom } from '@mui/material';

// ScrollTop Component (Moved here)
function ScrollTop(props: { children: React.ReactElement; window?: () => Window }) {
    const { children, window } = props;
    const trigger = useScrollTrigger({
        target: window ? window() : undefined,
        disableHysteresis: true,
        threshold: 100,
    });

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const anchor = (
            (event.target as HTMLDivElement).ownerDocument || document
        ).querySelector('#back-to-top-anchor');

        if (anchor) {
            anchor.scrollIntoView({
                block: 'center',
                behavior: 'smooth',
            });
        }
    };

    return (
        <Zoom in={trigger}>
            <Box
                onClick={handleClick}
                role="presentation"
                sx={{ position: 'fixed', bottom: 96, right: 16, zIndex: 100 }}
            >
                {children}
            </Box>
        </Zoom>
    );
}

interface Props {
    children: React.ReactNode;
    headerContent: React.ReactNode; // Buttons etc.
    title: string;
    configs: Record<string, string>;
    bookmarkCount?: number;
}

const ClassicLayout: React.FC<Props> = ({ children, headerContent, title, configs, bookmarkCount = 0 }) => {

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                color: 'text.primary',
                transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div id="back-to-top-anchor" />

            {/* Background Image Logic */}
            {configs['site.backgroundImage'] && isSecureUrl(configs['site.backgroundImage']) && (
                <>
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: `url(${configs['site.backgroundImage']})`,
                            backgroundSize: '100% auto',
                            backgroundPosition: 'top center',
                            backgroundRepeat: 'repeat-y',
                            zIndex: 0,
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: (theme: Theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(0, 0, 0, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')'
                                        : 'rgba(255, 255, 255, ' +
                                        (1 - Number(configs['site.backgroundOpacity'])) +
                                        ')',
                                zIndex: 1,
                            },
                        }}
                    />
                </>
            )}

            <Container
                maxWidth='lg'
                sx={{
                    py: { xs: 2, sm: 3, md: 4 },
                    px: { xs: 1.5, sm: 2, md: 3 },
                    position: 'relative',
                    zIndex: 2,
                    transition: 'padding 0.3s ease',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'center', sm: 'flex-start' },
                        mb: { xs: 4, sm: 5 },
                        gap: { xs: 2, sm: 0 },
                    }}
                >
                    <Typography
                        variant='h3'
                        component='h1'
                        fontWeight='bold'
                        color='text.primary'
                        sx={{
                            fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                            textAlign: { xs: 'center', sm: 'left' },
                            mb: { xs: 0, sm: 0 }
                        }}
                    >
                        {title}
                        {bookmarkCount > 0 && (
                            <Box component="span" sx={{
                                ml: 2,
                                display: 'inline-flex',
                                alignItems: 'center',
                                px: 1.5,
                                py: 0.5,
                                fontSize: '1rem',
                                borderRadius: '12px',
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                                border: '1px solid divider',
                                color: 'text.secondary',
                                verticalAlign: 'middle',
                                fontWeight: 'normal'
                            }}>
                                {bookmarkCount} 个书签
                            </Box>
                        )}
                    </Typography>

                    {/* Header Content (Buttons) */}
                    {headerContent}
                </Box>

                {children}

            </Container>
            <ScrollTop>
                <Fab size="large" aria-label="scroll back to top" color="primary">
                    <KeyboardArrowUpIcon fontSize="large" />
                </Fab>
            </ScrollTop>
        </Box>
    );
};

export default ClassicLayout;
