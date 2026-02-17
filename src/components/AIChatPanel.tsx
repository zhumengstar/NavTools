import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Fab,
    Paper,
    Typography,
    TextField,
    IconButton,
    Avatar,
    Zoom,
    Slide,
    useTheme,
    CircularProgress,
    ClickAwayListener,
    MenuItem,
    Popover,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    SmartToy as SmartToyIcon,
    Close as CloseIcon,
    Send as SendIcon,
    Person as PersonIcon,
    DeleteOutline as DeleteIcon,
    KeyboardArrowUp as UpIcon,
    KeyboardArrowDown as DownIcon,
    BookmarkAdd as BookmarkAddIcon,
    AutoAwesome as ModelIcon,
    ExpandMore as ExpandIcon,
    Psychology as PsychologyIcon,
    Bolt as BoltIcon,
    Stars as StarsIcon,
    ManageSearch as ManageSearchIcon,
} from '@mui/icons-material';

const DEFAULT_MESSAGES: ChatMessage[] = [
    {
        role: 'assistant',
        content: '你好！我是 NavTools 智能助手 🤖\n我可以帮你搜索书签、推荐网站，或回答其他问题。',
    },
];

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface Model {
    id: string;
    capabilities?: {
        function_calling: boolean;
        vision: boolean;
    };
}

const ThinkingPanel: React.FC<{ content: string; isDark: boolean }> = ({ content, isDark }) => {
    return (
        <Accordion
            disableGutters
            elevation={0}
            defaultExpanded={true}
            sx={{
                bgcolor: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                borderRadius: '8px !important',
                mb: 2,
                mt: 1,
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', opacity: 0.7 }} />}
                sx={{
                    minHeight: 32,
                    height: 32,
                    flexDirection: 'row-reverse',
                    '& .MuiAccordionSummary-content': { ml: 1, my: 0 },
                    '& .MuiAccordionSummary-expandIconWrapper': { mr: 0 },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.7 }}>
                    <PsychologyIcon fontSize="small" color="secondary" sx={{ fontSize: '1rem' }} />
                    <Typography variant="caption" color="text.secondary">
                        思考过程
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{
                pt: 0,
                pb: 1.5,
                px: 2,
            }}>
                <Box sx={{
                    opacity: 0.85,
                    fontSize: '0.9em',
                    borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                    pl: 2,
                }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
};

interface AIChatPanelProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
    username: string;
    groups: any[];
    onAddSite: (site: any) => Promise<boolean>;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ api, username, groups, onAddSite }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    // Lazy initialization from localStorage
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem(`chat_history_${username}`);
            return saved ? JSON.parse(saved) : DEFAULT_MESSAGES;
        } catch (e) {
            console.error('Failed to load chat history:', e);
            return DEFAULT_MESSAGES;
        }
    });

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const isDark = theme.palette.mode === 'dark';
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedModel, setSelectedModel] = useState(() => {
        return localStorage.getItem(`chat_model_${username}`) || '@cf/zai-org/glm-4.7-flash';
    });
    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelMenuAnchor, setModelMenuAnchor] = useState<null | HTMLElement>(null);

    // Helper to sort models by provider
    const sortModels = (models: Model[]) => {
        const providerOrder = ['gpt', 'claude', 'gemini', 'deepseek', 'glm', 'llama', 'qwen'];
        return [...models].sort((a, b) => {
            const aTools = a.capabilities?.function_calling ? 1 : 0;
            const bTools = b.capabilities?.function_calling ? 1 : 0;
            if (aTools !== bTools) return bTools - aTools;

            const aLower = a.id.toLowerCase();
            const bLower = b.id.toLowerCase();

            const aIndex = providerOrder.findIndex(p => aLower.includes(p));
            const bIndex = providerOrder.findIndex(p => bLower.includes(p));

            if (aIndex !== -1 && bIndex !== -1) {
                if (aIndex !== bIndex) return aIndex - bIndex;
                return a.id.localeCompare(b.id);
            }

            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            return a.id.localeCompare(b.id);
        });
    };

    // Fetch available models on mount
    useEffect(() => {
        const fetchModels = async () => {
            setFetchingModels(true);
            try {
                const data = await api.getAIModels();
                if (data && data.data && Array.isArray(data.data)) {
                    const models: Model[] = data.data.map((m: any) => ({
                        id: m.id,
                        capabilities: m.capabilities
                    }));
                    const sortedModels = sortModels(models);
                    setAvailableModels(sortedModels);
                    // If current selected model is not in the list, and list is not empty, select first one
                    if (sortedModels.length > 0 && !sortedModels.some(m => m.id === selectedModel)) {
                        const firstModel = sortedModels[0];
                        if (firstModel) setSelectedModel(firstModel.id);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch AI models:', error);
                // Fallback to defaults if fetch fails
                setAvailableModels([
                    { id: '@cf/zai-org/glm-4.7-flash', capabilities: { function_calling: false, vision: false } }
                ]);
            } finally {
                setFetchingModels(false);
            }
        };
        fetchModels();
    }, [api, username]);

    // Bookmark adding state
    const [pendingSite, setPendingSite] = useState<{ name: string, url: string } | null>(null);
    const [anchorPosition, setAnchorPosition] = useState<{ top: number, left: number } | null>(null);

    const handleLinkAddClick = (event: React.MouseEvent<HTMLElement>, title: string, url: string) => {
        event.stopPropagation();
        event.preventDefault();
        setPendingSite({ name: title, url });
        setAnchorPosition({
            top: event.clientY,
            left: event.clientX,
        });
    };

    const handleGroupSelect = (groupId: number) => {
        if (pendingSite && onAddSite) {
            // 立即清理状态并关闭菜单，实现无感交互
            const siteToAdd = { ...pendingSite, groupId };
            setAnchorPosition(null);
            setPendingSite(null);

            // 在后台执行异步添加操作
            onAddSite(siteToAdd).then(success => {
                if (success) {
                    // 成功反馈已在 App.tsx 中通过 snackbar 处理
                }
            }).catch(error => {
                console.error('Background bookmark addition failed:', error);
            });
        } else {
            setAnchorPosition(null);
            setPendingSite(null);
        }
    };

    // Save to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`chat_history_${username}`, JSON.stringify(messages));
        }
    }, [messages, username]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        scrollRef.current?.scrollIntoView({ behavior });
    };

    const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
        topRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (open) {
            if (inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 300);
            }
            // Use 'auto' (instant) for initial open scroll
            scrollToBottom('auto');
        }
    }, [open]);

    const handleClearHistory = () => {
        setMessages(DEFAULT_MESSAGES);
        localStorage.removeItem(`chat_history_${username}`);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        // Save selected model
        localStorage.setItem(`chat_model_${username}`, selectedModel);

        try {
            const history = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            let fullReply = '';

            if (api.chatStream) {
                await api.chatStream(trimmed, history, (text: string) => {
                    fullReply += text;
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];

                        // Check if we already have an assistant placeholder
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = fullReply;
                            return newMessages;
                        } else {
                            // First chunk: add the assistant message
                            return [...prev, { role: 'assistant', content: fullReply }];
                        }
                    });
                }, selectedModel);
            } else {
                // 降级兼容
                const result = await api.chat(trimmed, history, selectedModel);
                if (result.success && result.reply) {
                    setMessages((prev) => [
                        ...prev,
                        { role: 'assistant', content: result.reply! },
                    ]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: 'assistant',
                            content: result.message || '抱歉，我暂时无法回答。',
                        },
                    ]);
                }
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: '网络错误，请检查连接后重试。',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 宽度调整逻辑
    const [chatWidth, setChatWidth] = useState(() => {
        const saved = localStorage.getItem(`chat_width_${username}`);
        return saved ? parseInt(saved) : 380;
    });
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(chatWidth);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = chatWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const delta = startXRef.current - e.clientX;
            const newWidth = Math.min(Math.max(300, startWidthRef.current + delta), 800);
            setChatWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem(`chat_width_${username}`, chatWidth.toString());
            }
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, chatWidth, username]);

    const renderMarkdown = (content: string, role: string) => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ node, children, ...props }) => (
                    <Box
                        component="span"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            verticalAlign: 'middle',
                            '&:hover .add-link-btn': {
                                opacity: 1,
                                visibility: 'visible',
                            },
                        }}
                    >
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                color: role === 'user' ? '#fff' : theme.palette.primary.main,
                                textDecoration: 'underline'
                            }}
                        >
                            {children}
                        </a>
                        <IconButton
                            className="add-link-btn"
                            size="small"
                            onClick={(e) => handleLinkAddClick(e, String(children), String(props.href || ''))}
                            title="添加到书签"
                            sx={{
                                width: 20,
                                height: 20,
                                p: 0,
                                opacity: 0,
                                visibility: 'hidden',
                                transition: 'all 0.2s ease',
                                color: role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                '&:hover': {
                                    color: role === 'user' ? '#fff' : 'primary.main',
                                    transform: 'scale(1.2)',
                                },
                            }}
                        >
                            <BookmarkAddIcon fontSize="inherit" />
                        </IconButton>
                    </Box>
                )
            }}
        >
            {content}
        </ReactMarkdown>
    );

    return (
        <ClickAwayListener onClickAway={() => open && setOpen(false)}>
            <Box>
                {/* 悬浮按钮 */}
                <Zoom in={!open}>
                    <Fab
                        color="primary"
                        size="large"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(true);
                        }}
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            zIndex: 1200,
                            width: { xs: 48, sm: 56 },
                            height: { xs: 48, sm: 56 },
                            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                            '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                                transform: 'scale(1.05)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <SmartToyIcon fontSize="large" />
                    </Fab>
                </Zoom>

                {/* 聊天面板 */}
                <Slide direction="up" in={open} mountOnEnter unmountOnExit>
                    <Paper
                        elevation={12}
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            width: { xs: 'calc(100vw - 32px)', sm: chatWidth },
                            height: { xs: 'calc(100vh - 100px)', sm: 520 },
                            zIndex: 1300,
                            borderRadius: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            transition: isResizing ? 'none' : 'width 0.2s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* 调整宽度手柄 (左侧) */}
                        <Box
                            onMouseDown={handleMouseDown}
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: 'ew-resize',
                                zIndex: 10,
                                '&:hover': {
                                    bgcolor: 'rgba(25, 118, 210, 0.1)',
                                },
                            }}
                        />
                        {/* 头部 */}
                        <Box
                            sx={{
                                px: 2,
                                py: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                color: '#fff',
                                flexShrink: 0,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SmartToyIcon sx={{ fontSize: 22 }} />
                                <Typography variant="subtitle1" fontWeight="bold">
                                    智能助手
                                </Typography>
                            </Box>
                            <Box>
                                <IconButton
                                    size="small"
                                    onClick={handleClearHistory}
                                    title="清空记录"
                                    sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' }, mr: 0.5 }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => setOpen(false)}
                                    sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* 消息列表 */}
                        <Box
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                px: 2,
                                py: 1.5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.5,
                                bgcolor: isDark ? '#1a1a2e' : '#f8f9fc',
                                '&::-webkit-scrollbar': { width: 5 },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    borderRadius: 3,
                                },
                            }}
                        >
                            <div ref={topRef} />
                            {messages.map((msg, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <Avatar
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            bgcolor:
                                                msg.role === 'user'
                                                    ? theme.palette.primary.main
                                                    : theme.palette.secondary.main,
                                            fontSize: 16,
                                            flexShrink: 0,
                                            mt: 0.5,
                                        }}
                                    >
                                        {msg.role === 'user' ? (
                                            <PersonIcon sx={{ fontSize: 18 }} />
                                        ) : (
                                            <SmartToyIcon sx={{ fontSize: 18 }} />
                                        )}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            maxWidth: '80%',
                                            px: 1.5,
                                            py: 1,
                                            borderRadius: 2,
                                            bgcolor:
                                                msg.role === 'user'
                                                    ? theme.palette.primary.main
                                                    : isDark
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : '#fff',
                                            color:
                                                msg.role === 'user'
                                                    ? '#fff'
                                                    : theme.palette.text.primary,
                                            boxShadow: msg.role === 'user'
                                                ? 'none'
                                                : `0 1px 3px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                                            overflowWrap: 'break-word',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                '& p': { m: 0, lineHeight: 1.6, fontSize: '0.85rem', overflowWrap: 'break-word', wordBreak: 'break-word' },
                                                '& p + p': { mt: 1 },
                                                '& ul, & ol': { m: 0, pl: 2.5, mt: 0.5 },
                                                '& li': { mb: 0.5 },
                                                '& code': {
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                                    px: 0.6,
                                                    py: 0.2,
                                                    borderRadius: 1,
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.8em',
                                                },
                                                '& strong': {
                                                    fontWeight: 700,
                                                    color: isDark ? '#fff' : '#000',
                                                },
                                                '& em': {
                                                    fontStyle: 'italic',
                                                },
                                                '& pre': {
                                                    bgcolor: isDark ? 'rgba(0,0,0,0.3)' : '#f5f5f5',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    overflowX: 'auto',
                                                    my: 1,
                                                    '& code': {
                                                        bgcolor: 'transparent',
                                                        p: 0,
                                                        color: isDark ? '#e0e0e0' : '#333',
                                                    },
                                                },
                                                '& a': {
                                                    color: msg.role === 'user'
                                                        ? '#fff'
                                                        : theme.palette.primary.main,
                                                    textDecoration: 'underline',
                                                },
                                                '& table': {
                                                    borderCollapse: 'collapse',
                                                    width: '100%',
                                                    my: 1,
                                                },
                                                '& th, & td': {
                                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                                                    px: 1,
                                                    py: 0.5,
                                                    fontSize: '0.85rem',
                                                },
                                                '& th': {
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                                    fontWeight: 600,
                                                },
                                            }}
                                        >
                                            {(() => {
                                                if (msg.role === 'assistant') {
                                                    const thinkMatch = msg.content.match(/<think>([\s\S]*?)<\/think>/);
                                                    if (thinkMatch) {
                                                        const thought = thinkMatch[1] || '';
                                                        const rest = msg.content.replace(/<think>([\s\S]*?)<\/think>/, '').trim();
                                                        return (
                                                            <>
                                                                <ThinkingPanel content={thought} isDark={isDark} />
                                                                {renderMarkdown(rest, msg.role)}
                                                            </>
                                                        );
                                                    }
                                                }
                                                return renderMarkdown(msg.content, msg.role);
                                            })()}
                                        </Box>
                                    </Box>
                                </Box>
                            ))}
                            {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <Avatar
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            bgcolor: theme.palette.secondary.main,
                                            fontSize: 16,
                                            flexShrink: 0,
                                            mt: 0.5,
                                        }}
                                    >
                                        <SmartToyIcon sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Box
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            borderRadius: 2,
                                            bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                                            boxShadow: `0 1px 3px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <CircularProgress size={16} />
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                            思考中...
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            <div ref={scrollRef} />

                            {/* 滚动控制按钮 */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 80,
                                    right: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    zIndex: 10,
                                }}
                            >
                                <IconButton
                                    onClick={() => scrollToTop()}
                                    title="回到顶部"
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        backdropFilter: 'blur(8px)',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,1)' },
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    }}
                                >
                                    <UpIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton
                                    onClick={() => scrollToBottom()}
                                    title="回到底部"
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        backdropFilter: 'blur(8px)',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,1)' },
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    }}
                                >
                                    <DownIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* 输入区域 */}
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.5,
                                display: 'flex',
                                gap: 1,
                                alignItems: 'flex-end',
                                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                bgcolor: isDark ? '#16213e' : '#fff',
                                flexShrink: 0,
                            }}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => setModelMenuAnchor(e.currentTarget)}
                                    sx={{
                                        alignSelf: 'stretch',
                                        mb: 0.5,
                                        mr: 1,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                        borderRadius: 1.5,
                                        color: theme.palette.primary.main,
                                        px: 1,
                                        py: 0.5,
                                        width: 'auto',
                                        height: 'auto',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }
                                    }}
                                >
                                    {(() => {
                                        const lower = selectedModel.toLowerCase();
                                        let SelectedIcon = ModelIcon;
                                        if (lower.includes('gpt')) SelectedIcon = PsychologyIcon;
                                        else if (lower.includes('claude')) SelectedIcon = BoltIcon;
                                        else if (lower.includes('gemini')) SelectedIcon = StarsIcon;
                                        else if (lower.includes('deepseek')) SelectedIcon = ManageSearchIcon;
                                        else if (lower.includes('llama')) SelectedIcon = SmartToyIcon;
                                        return <SelectedIcon sx={{ fontSize: 16, mr: 0.5 }} />;
                                    })()}
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                        {selectedModel.split('/').pop()}
                                    </Typography>
                                    <ExpandIcon sx={{ fontSize: 14, ml: 0.2, flexShrink: 0 }} />
                                </IconButton>
                            </Box>
                            <Popover
                                open={Boolean(modelMenuAnchor)}
                                anchorEl={modelMenuAnchor}
                                onClose={() => setModelMenuAnchor(null)}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left',
                                }}
                                transformOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'left',
                                }}
                                disableScrollLock
                                slotProps={{
                                    paper: {
                                        sx: {
                                            borderRadius: 2,
                                            mt: -1,
                                            maxHeight: 300,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            width: 250 // Increased width for CF model names
                                        }
                                    }
                                }}
                            >
                                <Box sx={{ py: 0.5 }}>
                                    {availableModels.length > 0 ? (
                                        availableModels.map((model) => {
                                            // 简单的上下文长度估算
                                            let contextInfo = '';
                                            const lower = model.id.toLowerCase();
                                            if (lower.includes('gemini-1.5')) contextInfo = '1M+ Context';
                                            else if (lower.includes('claude-3')) contextInfo = '200k Context';
                                            else if (lower.includes('gpt-4') || lower.includes('gpt-4o')) contextInfo = '128k Context';
                                            else if (lower.includes('gpt-3.5')) contextInfo = '16k Context';
                                            else if (lower.includes('deepseek')) contextInfo = '32k Context';
                                            else if (lower.includes('14b')) contextInfo = '14B Params';
                                            else if (lower.includes('8b')) contextInfo = '8B Params';
                                            else if (lower.includes('7b')) contextInfo = '7B Params';

                                            // 获取模型图标
                                            let ModelIconComponent = ModelIcon;
                                            if (lower.includes('gpt')) ModelIconComponent = PsychologyIcon;
                                            else if (lower.includes('claude')) ModelIconComponent = BoltIcon;
                                            else if (lower.includes('gemini')) ModelIconComponent = StarsIcon;
                                            else if (lower.includes('deepseek')) ModelIconComponent = ManageSearchIcon;
                                            else if (lower.includes('llama')) ModelIconComponent = SmartToyIcon;

                                            return (
                                                <MenuItem
                                                    key={model.id}
                                                    onClick={() => { setSelectedModel(model.id); setModelMenuAnchor(null); }}
                                                    selected={selectedModel === model.id}
                                                    sx={{ fontSize: '0.85rem' }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                        <ModelIconComponent sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                                                        <Box sx={{ overflow: 'hidden', flex: 1 }}>
                                                            <Typography variant="body2" fontWeight="bold" noWrap sx={{ display: 'block' }}>{model.id.split('/').pop()}</Typography>
                                                            {contextInfo && (
                                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                    {contextInfo}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                        {model.capabilities?.function_calling && (
                                                            <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }} title="支持工具调用">
                                                                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'success.main', border: '1px solid', borderColor: 'success.main', borderRadius: 1, px: 0.5 }}>
                                                                    Tools
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </MenuItem>
                                            );
                                        })
                                    ) : (
                                        <MenuItem disabled sx={{ fontSize: '0.85rem' }}>
                                            {fetchingModels ? '正在获取模型...' : '暂无可用模型'}
                                        </MenuItem>
                                    )}
                                    <Box sx={{
                                        position: 'sticky',
                                        bottom: 0,
                                        bgcolor: 'background.paper',
                                        zIndex: 2,
                                        borderTop: `1px solid ${theme.palette.divider}`,
                                        mt: 0.5,
                                        pt: 0.5
                                    }}>
                                        <MenuItem
                                            onClick={async () => {
                                                setFetchingModels(true);
                                                try {
                                                    const data = await api.getAIModels();
                                                    if (data && data.data && Array.isArray(data.data)) {
                                                        const models: Model[] = data.data.map((m: any) => ({
                                                            id: m.id,
                                                            capabilities: m.capabilities
                                                        }));
                                                        setAvailableModels(sortModels(models));
                                                    }
                                                } catch (e) { console.error(e); }
                                                finally { setFetchingModels(false); }
                                            }}
                                            sx={{ fontSize: '0.75rem', color: 'primary.main', justifyContent: 'center' }}
                                        >
                                            刷新模型列表
                                        </MenuItem>
                                    </Box>
                                </Box>
                            </Popover>
                            <TextField
                                inputRef={inputRef}
                                fullWidth
                                size="small"
                                multiline
                                maxRows={3}
                                placeholder="输入你的问题..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        fontSize: '0.875rem',
                                    },
                                }}
                            />
                            <IconButton
                                color="primary"
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                sx={{
                                    bgcolor: theme.palette.primary.main,
                                    color: '#fff',
                                    width: 36,
                                    height: 36,
                                    '&:hover': {
                                        bgcolor: theme.palette.primary.dark,
                                    },
                                    '&.Mui-disabled': {
                                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                        color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                    },
                                }}
                            >
                                <SendIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Box>

                        {/* 分组选择菜单 */}
                        <Popover
                            open={Boolean(anchorPosition)}
                            anchorReference="anchorPosition"
                            anchorPosition={anchorPosition || undefined}
                            onClose={() => {
                                setAnchorPosition(null);
                            }}
                            disableScrollLock
                            slotProps={{
                                paper: {
                                    sx: {
                                        maxHeight: 300,
                                        width: '20ch',
                                        borderRadius: 2,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                        bgcolor: theme.palette.background.paper,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    },
                                }
                            }}
                        >
                            <Box
                                sx={{
                                    p: 0,
                                    position: 'sticky',
                                    top: 0,
                                    bgcolor: theme.palette.background.paper,
                                    zIndex: 1,
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.2 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                        选择存入分组
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ py: 0.5, overflowY: 'auto' }}>
                                {groups.map((group) => (
                                    <MenuItem
                                        key={group.id}
                                        onClick={() => handleGroupSelect(group.id)}
                                        sx={{
                                            fontSize: '0.85rem',
                                            py: 1,
                                            px: 2,
                                        }}
                                    >
                                        {group.name}
                                    </MenuItem>
                                ))}
                            </Box>
                        </Popover>
                    </Paper>
                </Slide>
            </Box>
        </ClickAwayListener>
    );
};

export default AIChatPanel;
