// src/components/SiteCard.tsx
import { useState, memo, useEffect, useRef } from 'react';
import { Site } from '../API/http';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// 引入Material UI组件
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  IconButton,
  Box,
  Tooltip,
  Checkbox,
  Skeleton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import RecommendIcon from '@mui/icons-material/Recommend';

interface SiteCardProps {
  site: Site;
  onUpdate?: (updatedSite: Site) => void;
  onDelete?: (siteId: number) => void;
  onSiteClick?: (siteId: number) => void; // 新增：点击回调
  isEditMode?: boolean;
  viewMode?: 'readonly' | 'edit'; // 访问模式
  iconApi?: string; // 添加iconApi属性
  isBatchMode?: boolean; // 新增：是否处于批量模式
  isSelected?: boolean; // 新增：是否被选中
  onToggleSelection?: (id: number) => void; // 新增：切换选中回调
  onSettingsOpen?: (siteId: number) => Promise<void> | void; // 新增：打开设置时的回调
}

// 使用memo包装组件以减少不必要的重渲染
const SiteCard = memo(function SiteCard({
  site,
  onUpdate,
  // onDelete,
  onSiteClick,
  isEditMode = false,
  viewMode = 'edit', // 默认为编辑模式
  // iconApi,
  isBatchMode = false,
  isSelected = false,
  onToggleSelection,
  onSettingsOpen,
}: SiteCardProps) {
  const [iconError, setIconError] = useState(!site.icon);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  // 使用 IntersectionObserver 实现图标懒加载
  useEffect(() => {
    const element = iconRef.current;
    if (!element || !site.icon) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // 一旦进入视图就停止观察
          }
        });
      },
      {
        rootMargin: '100px', // 提前 100px 开始加载
        threshold: 0,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [site.icon]);

  // 当 site.icon 真正改变时，重置错误状态和加载状态
  useEffect(() => {
    setIconError(!site.icon);
    setImageLoaded(false);
    setIsInView(false);
  }, [site.icon]);

  // 使用dnd-kit的useSortable hook - 仅在编辑模式下启用拖拽
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `site-${site.id}`, // 使用稳定的 id
    disabled: !isEditMode || isBatchMode, // 非编辑模式或批量模式下禁用拖拽
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : transition, // 拖动时禁用 transition 以提高响应速度
    zIndex: isDragging ? 9999 : 'auto',
    opacity: isDragging ? 0.5 : 1, // 降低原位透明度
    position: 'relative' as const,
    willChange: isEditMode ? 'transform' : 'auto', // 编辑模式下开启硬件加速提示
  };

  // 如果没有图标，使用首字母作为图标
  const fallbackIcon = site.name.charAt(0).toUpperCase();

  // 处理设置按钮点击
  const handleSettingsClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止卡片点击事件
    e.preventDefault(); // 防止默认行为
    if (onSettingsOpen && site.id) {
      onSettingsOpen(site.id);
    }
  };


  // 处理卡片点击
  const handleCardClick = () => {
    if (isBatchMode && site.id && onToggleSelection) {
      onToggleSelection(site.id);
      return;
    }
    // 编辑模式和非编辑模式下都可以点击跳转
    if (site.url) {
      // 记录点击行为，不阻塞跳转
      if (site.id && onSiteClick) {
        onSiteClick(site.id);
      }
      // 确保 URL 有 http:// 或 https:// 前缀
      let url = site.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // 处理图标加载错误
  const handleIconError = () => {
    setIconError(true);
  };

  // 处理图片加载完成
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // 卡片内容
  const cardContent = (
    <Box
      sx={{
        height: '100%',
        position: 'relative',
        transition: 'transform 0.3s ease-in-out',
        ...(!isEditMode && {
          '&:hover': {
            transform: 'translateY(-4px)',
          },
        }),
      }}
    >
      <Card
        className="site-card"
        sx={{
          width: '100%', // 确保水平长度一致
          height: '100%',
          minHeight: { xs: 100, sm: 110 }, // 设置固定的最小高度
          position: 'relative', // 确保绝对定位子元素参考此处
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: isDragging ? 8 : 2,
          '&:hover': {
            boxShadow: 5,
            '& .site-settings-btn': {
              display: 'flex',
            },
          },
          overflow: 'hidden',
          // backgroundColor & backdropFilter handled by MuiCard theme override
          background: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(20, 28, 46, 0.5)'
            : 'rgba(255, 255, 255, 0.1)', // Slight tint for card body
        }}
      >
        {isEditMode ? (
          <CardActionArea
            onClick={handleCardClick}
            sx={{
              height: '100%',
              p: { xs: 1.5, sm: 2 },
              pt: { xs: 2.5, sm: 3 }, // 为复选框留出顶部空间
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              position: 'relative',
            }}
          >
            {/* 批量操作复选框 - 编辑模式 */}
            {isBatchMode && (
              <Checkbox
                checked={isSelected}
                size="small"
                color="primary"
                onChange={() => onToggleSelection?.(site.id as number)}
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 10,
                  p: 0.5,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                  borderRadius: '3px',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
                  },
                }}
              />
            )}
            <Box position='absolute' top={8} right={8} display='flex' gap={1} zIndex={10}>
              <IconButton
                size='small'
                className="site-settings-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSettingsOpen && site.id) {
                    onSettingsOpen(site.id);
                  }
                }}
                sx={{
                  display: 'none',
                  p: 0.5,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <SettingsIcon fontSize='small' />
              </IconButton>
            </Box>
            {/* 图标和名称 */}
            <Box display='flex' alignItems='center' mb={1}>
              {!iconError && site.icon ? (
                <Box ref={iconRef} sx={{ position: 'relative', mr: 1.5, width: 32, height: 32, flexShrink: 0, display: 'flex' }}>
                  {isInView ? (
                    <Box
                      component='img'
                      src={site.icon}
                      alt={site.name}
                      loading="lazy"
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        objectFit: 'cover',
                        // 在编辑模式下不显示骨架屏和淡入效果，以保持拖拽时的图标稳定
                        opacity: imageLoaded ? 1 : (isEditMode ? 1 : 0),
                      }}
                      onError={handleIconError}
                      onLoad={handleImageLoad}
                    />
                  ) : (
                    <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: 1 }} />
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 1.5,
                    borderRadius: 1,
                    bgcolor: 'primary.light',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 1,
                    borderColor: 'primary.main',
                    opacity: 0.8,
                    flexShrink: 0,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  {fallbackIcon}
                </Box>
              )}
              <Tooltip
                title={site.name}
                arrow
                placement="top"
                enterDelay={500}
                leaveDelay={100}
                disableInteractive
                disableHoverListener={site.name.length < 20}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '3.2em', minWidth: 0 }}>
                  <Typography
                    variant='subtitle2'
                    fontWeight='medium'
                    noWrap
                    sx={{
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      transition: 'all 0.2s ease-in-out',
                      cursor: 'default',
                      lineHeight: 1.2,
                      '&:hover': {
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        fontWeight: 'bold',
                        color: 'primary.main',
                      }
                    }}
                  >
                    {site.name}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    noWrap
                    sx={{
                      fontSize: '0.7rem',
                      opacity: 0.7,
                      lineHeight: 1.2,
                      mt: 0.2
                    }}
                  >
                    {site.url?.replace(/^https?:\/\//i, '')}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>

            {/* 描述 */}
            <Tooltip
              title={site.description && site.description !== site.name ? site.description : ""}
              arrow
              placement="top"
              enterDelay={500}
              leaveDelay={100}
              disableInteractive
              disableHoverListener={!site.description || site.description === site.name}
            >
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flexGrow: 1,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  minHeight: { xs: '2.4em', sm: '3em' }, // 确保描述区域即使为空也占用空间
                }}
              >
                {site.description || '暂无描述'}
              </Typography>
            </Tooltip>
          </CardActionArea>
        ) : (
          <>
            <Box sx={{ height: '100%', position: 'relative' }}>
              {/* 批量操作复选框 */}
              {isBatchMode && (
                <Checkbox
                  checked={isSelected}
                  size="small"
                  color="primary"
                  onChange={() => onToggleSelection?.(site.id as number)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 10,
                    p: 0.5,
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                    borderRadius: '3px',
                    '&:hover': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
                    },
                  }}
                />
              )}
              <CardActionArea onClick={handleCardClick} sx={{ height: '100%' }}>
                <CardContent
                  sx={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: { xs: 1.5, sm: 2 },
                    pt: { xs: 2.5, sm: 3 }, // 为复选框留出顶部空间
                    '&:last-child': { pb: { xs: 1.5, sm: 2 } },
                  }}
                >

                {/* 图标和名称 */}
                <Box display='flex' alignItems='center' mb={1}>
                  {!iconError && site.icon ? (
                    <Box ref={iconRef} sx={{ position: 'relative', mr: 1.5, width: 32, height: 32, flexShrink: 0, display: 'flex' }}>
                      {isInView ? (
                        <Box
                          component='img'
                          src={site.icon}
                          alt={site.name}
                          loading="lazy"
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            objectFit: 'cover',
                            opacity: imageLoaded ? 1 : 0.5, // 初始加载时显示一半透明度而非完全隐藏或占位
                          }}
                          onError={handleIconError}
                          onLoad={handleImageLoad}
                        />
                      ) : (
                        <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: 1 }} />
                      )}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        mr: 1.5,
                        borderRadius: 1,
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 1,
                        borderColor: 'primary.main',
                        opacity: 0.8,
                        flexShrink: 0,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {fallbackIcon}
                    </Box>
                  )}
                  <Tooltip
                    title={site.name}
                    arrow
                    placement="top"
                    enterDelay={500}
                    leaveDelay={100}
                    disableInteractive
                    disableHoverListener={site.name.length < 20}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '3.2em', minWidth: 0 }}>
                      <Typography
                        variant='subtitle2'
                        fontWeight='medium'
                        noWrap
                        sx={{
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          transition: 'all 0.2s ease-in-out',
                          lineHeight: 1.2,
                          '&:hover': {
                            fontSize: { xs: '0.875rem', sm: '1rem' },
                            fontWeight: 'bold',
                            color: 'primary.main',
                          }
                        }}
                      >
                        {site.name}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        noWrap
                        sx={{
                          fontSize: '0.7rem',
                          opacity: 0.7,
                          lineHeight: 1.2,
                          mt: 0.2
                        }}
                      >
                        {site.url?.replace(/^https?:\/\//i, '')}
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>

                {/* 描述 */}
                <Tooltip
                  title={site.description && site.description !== site.name ? site.description : ""}
                  arrow
                  placement="top"
                  enterDelay={500}
                  leaveDelay={100}
                  disableInteractive
                  disableHoverListener={!site.description || site.description === site.name}
                >
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flexGrow: 1,
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      minHeight: { xs: '2.4em', sm: '3em' }, // 确保描述区域即使为空也占用空间
                    }}
                  >
                    {site.description || '暂无描述'}
                  </Typography>
                </Tooltip>
              </CardContent>
            </CardActionArea>
            </Box>

            {/* 设置按钮 - 只在编辑模式显示 (移出 CardActionArea 以修复 DOM 嵌套错误) */}
            {viewMode === 'edit' && (
              <IconButton
                size='small'
                className="site-settings-btn"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1, // 确保在 CardActionArea 之上
                  display: 'none',
                  bgcolor: 'action.hover',
                  transition: 'all 0.2s ease-in-out',
                  p: { xs: 1, sm: 0.5 },
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                }}
                onClick={handleSettingsClick}
                aria-label='网站设置'
              >
                <SettingsIcon fontSize='small' />
              </IconButton>
            )}
          </>
        )}

        {/* 精选标识 - 右下角 */}
        {site.is_featured === 1 && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdate && site.id) {
                onUpdate({ ...site, is_featured: 0 });
              }
            }}
            sx={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              zIndex: 2,
              color: 'warning.main', // 使用警告色(橙色)作为精选标识
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
              opacity: 0.9,
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'scale(1.2)',
              },
            }}
          >
            <RecommendIcon fontSize="small" />
          </Box>
        )}
      </Card>
    </Box >
  );

  // 编辑模式下：卡片可点击跳转，同时有拖拽手柄用于排序
  if (isEditMode) {
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <Box 
          sx={{ 
            position: 'relative', 
            height: '100%',
            '&:hover .drag-handle': {
              opacity: 1,
              visibility: 'visible',
            },
          }}
        >
          {/* 拖拽手柄 - 只有按住这里才能拖拽，默认隐藏，悬停显示 */}
          <Box
            {...listeners}
            className="drag-handle"
            sx={{
              position: 'absolute',
              top: 8,
              left: isBatchMode ? 44 : 12, // 批量模式时避开复选框
              zIndex: 25,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              borderRadius: '6px',
              opacity: 0,
              visibility: 'hidden',
              transition: 'all 0.2s ease',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark' 
                  ? '0 2px 8px rgba(0,0,0,0.4)' 
                  : '0 2px 8px rgba(0,0,0,0.1)',
              border: (theme) =>
                `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
                transform: 'scale(1.1)',
              },
              '&:active': {
                cursor: 'grabbing',
                transform: 'scale(0.95)',
              },
            }}
            title="按住拖拽排序"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
              <circle cx="4" cy="4" r="1.5" />
              <circle cx="4" cy="8" r="1.5" />
              <circle cx="4" cy="12" r="1.5" />
              <circle cx="12" cy="4" r="1.5" />
              <circle cx="12" cy="8" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
            </svg>
          </Box>
          {/* 卡片内容 */}
          {cardContent}
        </Box>
      </div>
    );
  }

  // 非编辑模式下：直接返回可点击的卡片
  return (
    <Box onClick={handleCardClick} sx={{ cursor: 'pointer', height: '100%' }}>
      {cardContent}
    </Box>
  );
});

export default SiteCard;
