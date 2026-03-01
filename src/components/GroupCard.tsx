import React, { useState, useEffect } from 'react';
import { Site, Group } from '../API/http';
import SiteCard from './SiteCard';
import { GroupWithSites } from '../types';
import EditGroupDialog from './EditGroupDialog';
import {
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
// 引入Material UI组件
import {
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChecklistIcon from '@mui/icons-material/Checklist';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import CloseIcon from '@mui/icons-material/Close';

// 可拖放的分组容器组件
function DroppableGroupContainer({
  children,
  groupId,
  isDraggingOver,
}: {
  children: React.ReactNode;
  groupId: number;
  isDraggingOver: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupId}`,
    data: {
      groupId,
    },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: isDraggingOver || isOver ? '3px dashed' : 'none',
          borderColor: 'primary.main',
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 1,
        },
        backgroundColor: isDraggingOver || isOver ? 'action.hover' : 'transparent',
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        p: isDraggingOver || isOver ? 1 : 0,
      }}
    >
      {children}
    </Box>
  );
}

// 更新组件属性接口
interface GroupCardProps {
  group: GroupWithSites;
  index?: number; // 用于Draggable的索引，仅在分组排序模式下需要
  sortMode: 'None' | 'GroupSort' | 'SiteSort' | 'CrossGroupDrag';
  currentSortingGroupId: number | null;
  viewMode?: 'readonly' | 'edit'; // 访问模式
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;

  onStartSiteSort: (groupId: number) => void;
  onAddSite?: (groupId: number) => void; // 新增添加卡片的可选回调函数
  onUpdateGroup?: (group: Group) => void; // 更新分组的回调函数
  onDeleteGroup?: (groupId: number) => void; // 删除分组的回调函数
  configs?: Record<string, string>; // 传入配置

  draggedSiteId?: string | null; // 当前拖拽的站点ID
  onBatchDelete?: (siteIds: number[]) => void; // 新增：批量删除回调
  onBatchFeaturedUpdate?: (siteIds: number[], isFeatured: number) => void; // 新增：批量更新精选状态回调
  onSiteClick?: (siteId: number) => void; // 新增：站点点击回调
  onSettingsOpen?: (siteId: number) => Promise<void> | void; // 新增：打开设置回调
  globalToggleVersion?: { type: 'expand' | 'collapse'; ts: number }; // 新增：全局切换指令
  isAdmin?: boolean; // 新增：明确的管理员标志
  currentUserId?: number; // 新增：当前登录用户ID
}

const GroupCard: React.FC<GroupCardProps> = React.memo(({
  group,
  sortMode,
  currentSortingGroupId,
  viewMode = 'edit', // 默认为编辑模式
  onUpdate,
  onDelete,
  onAddSite,
  onUpdateGroup,
  onDeleteGroup,
  onSiteClick,
  onSettingsOpen,
  configs,
  draggedSiteId,
  onBatchDelete,
  onBatchFeaturedUpdate,
  globalToggleVersion,
  index, // 解构 index
  isAdmin, // 解构 isAdmin
  currentUserId, // 解构 currentUserId
}) => {
  // 添加编辑弹窗的状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // 批量操作相关状态
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<number>>(new Set());

  // 切换选中状态
  const handleToggleSelection = (siteId: number) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const handleToggleSelectAll = () => {
    if (selectedSiteIds.size === group.sites.length) {
      setSelectedSiteIds(new Set());
    } else {
      setSelectedSiteIds(new Set(group.sites.map(s => s.id as number)));
    }
  };

  // 退出批量模式
  const handleExitBatchMode = () => {
    setIsBatchMode(false);
    setSelectedSiteIds(new Set());
  };

  // 执行批量删除
  const handleBatchDeleteClick = () => {
    if (selectedSiteIds.size === 0) return;
    if (onBatchDelete) {
      onBatchDelete(Array.from(selectedSiteIds));
      handleExitBatchMode();
    }
  };

  // 执行批量精选更新
  const handleBatchFeaturedClick = (isFeatured: number) => {
    if (selectedSiteIds.size === 0) return;
    if (onBatchFeaturedUpdate) {
      onBatchFeaturedUpdate(Array.from(selectedSiteIds), isFeatured);
      handleExitBatchMode();
    }
  };

  // 添加折叠状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // 使用新的 key 前缀以重置旧用户的展开/折叠状态
    const savedState = localStorage.getItem(`group-collapse-v2-${group.id}`);
    // 如果没有新版状态，默认为 true (合上)
    return savedState === null ? true : JSON.parse(savedState);
  });

  // 保存折叠状态到本地存储
  useEffect(() => {
    if (group.id) {
      localStorage.setItem(`group-collapse-v2-${group.id}`, JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, group.id]);

  // 响应全局切换指令
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (globalToggleVersion) {
      if (globalToggleVersion.type === 'expand') {
        const delay = (index || 0) * 30;
        timer = setTimeout(() => {
          setIsCollapsed(false);
        }, delay);
      } else {
        // 折叠时也使用延迟，避免卡顿
        const delay = (index || 0) * 30;
        timer = setTimeout(() => {
          setIsCollapsed(true);
        }, delay);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [globalToggleVersion, index]);

  // 处理折叠切换
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 编辑分组处理函数
  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  // 更新分组处理函数
  const handleUpdateGroup = (updatedGroup: Group) => {
    if (onUpdateGroup) {
      onUpdateGroup(updatedGroup);
      setEditDialogOpen(false);
    }
  };

  // 删除分组处理函数
  const handleDeleteGroup = (groupId: number) => {
    if (onDeleteGroup) {
      onDeleteGroup(groupId);
      setEditDialogOpen(false);
    }
  };

  // 判断是否为当前正在编辑的分组
  const isCurrentEditingGroup = sortMode === 'SiteSort' && currentSortingGroupId === group.id;

  // 判断是否有站点正在拖拽到此分组
  const isDraggingOverThisGroup: boolean =
    (sortMode === 'SiteSort' || sortMode === 'CrossGroupDrag') && !!draggedSiteId && currentSortingGroupId !== group.id;

  // 渲染站点卡片区域
  const renderSites = () => {
    // 使用来自父组件的 group.sites 数据
    const sitesToRender = group.sites;

    // 如果当前不是正在编辑的分组且处于站点排序模式，不显示站点
    if (!isCurrentEditingGroup && sortMode === 'SiteSort') {
      return null;
    }

    // 跨分组拖动模式 或 编辑模式
    // 编辑模式下不再需要嵌套 DndContext，因为 App.tsx 的顶层 DndContext 会处理
    if (isCurrentEditingGroup || sortMode === 'CrossGroupDrag') {
      return (
        <DroppableGroupContainer
          groupId={group.id}
          isDraggingOver={isDraggingOverThisGroup}
        >
          <SortableContext
            items={sitesToRender.map((site) => `site-${site.id}`)}
            strategy={rectSortingStrategy}
          >
            <Box sx={{ width: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  margin: -1,
                }}
              >
                {sitesToRender.map((site, idx) => (
                  <Box
                    key={site.id || idx}
                    sx={{
                      width: {
                        xs: '50%',
                        sm: '33.33%',
                        md: '25%',
                        lg: '20%',
                        xl: '16.666%',
                      },
                      padding: 1,
                      boxSizing: 'border-box',
                    }}
                  >
                    <SiteCard
                      site={site}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      onSiteClick={onSiteClick}
                      onSettingsOpen={onSettingsOpen}
                      isEditMode={true}
                      viewMode={viewMode}
                      iconApi={configs?.['site.iconApi']}
                      isBatchMode={isBatchMode}
                      isSelected={selectedSiteIds.has(site.id as number)}
                      onToggleSelection={handleToggleSelection}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </SortableContext>
        </DroppableGroupContainer>
      );
    }

    // 普通模式下的渲染
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          margin: -1, // 抵消内部padding，确保边缘对齐
        }}
      >
        {sitesToRender.map((site) => (
          <Box
            key={site.id}
            sx={{
              width: {
                xs: '50%',
                sm: '33.33%',
                md: '25%',
                lg: '20%',
                xl: '16.666%',
              },
              padding: 1, // 内部间距，更均匀的分布
              boxSizing: 'border-box', // 确保padding不影响宽度计算
            }}
          >
            <SiteCard
              site={site}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSiteClick={onSiteClick}
              onSettingsOpen={onSettingsOpen}
              isEditMode={true}
              viewMode={viewMode}
              iconApi={configs?.['site.iconApi']}
              isBatchMode={isBatchMode}
              isSelected={selectedSiteIds.has(site.id as number)}
              onToggleSelection={handleToggleSelection}
            />
          </Box>
        ))}
      </Box>
    );
  };







  // 修改分组标题区域的渲染
  return (
    <Paper
      elevation={sortMode === 'None' ? 2 : 3}
      sx={{
        borderRadius: 4,
        p: { xs: 2, sm: 3 },
        transition: 'all 0.3s ease-in-out',
        border: '1px solid transparent',
        '&:hover': {
          boxShadow: sortMode === 'None' ? 6 : 3,
          borderColor: 'divider',
          transform: sortMode === 'None' ? 'scale(1.01)' : 'none',
        },
        // Remove inline background/backdrop to use theme defaults
        background: 'rgba(255, 255, 255, 0.05)', // Extremely subtle layer
      }}
    >
      <Box
        display='flex'
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={2.5}
        gap={1}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          mx: { xs: -2, sm: -3 }, // 抵消父容器 padding
          mt: { xs: -2, sm: -3 }, // 抵消父容器 padding
          px: { xs: 2, sm: 3 },   // 补回 padding
          py: 2,
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderTopLeftRadius: 16, // 对应 borderRadius 4 (4 * 4px = 16px)
          borderTopRightRadius: 16,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            '&:hover': {
              '& .collapse-icon': {
                color: 'primary.main',
              },
            },
          }}
          onClick={handleToggleCollapse}
        >
          <IconButton
            size='small'
            className='collapse-icon'
            sx={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
          <Typography
            variant='h5'
            component='h2'
            fontWeight='600'
            color='text.primary'
            sx={{ mb: { xs: 1, sm: 0 } }}
          >
            {group.name}
            <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
              ({group.sites.length})
            </Typography>
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'row' },
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            flexWrap: 'wrap',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}
        >
          {isCurrentEditingGroup ? (
            <Typography
              variant='body2'
              color='primary'
              sx={{ alignSelf: 'center', fontWeight: 'bold' }}
            >
              正在排序... (已自动保存)
            </Typography>
          ) : (
            sortMode === 'None' &&
            viewMode === 'edit' && ( // 只在编辑模式显示按钮
              <>
                {/* 批量操作控制 */}
                {isBatchMode ? (
                  <>
                    <Button
                      variant='outlined'
                      color='primary'
                      size='small'
                      onClick={handleToggleSelectAll}
                      startIcon={selectedSiteIds.size === group.sites.length ? <DeselectIcon /> : <SelectAllIcon />}
                    >
                      {selectedSiteIds.size === group.sites.length ? '取消全选' : '全选'}
                    </Button>
                    <Button
                      variant='contained'
                      color='error'
                      size='small'
                      onClick={handleBatchDeleteClick}
                      disabled={selectedSiteIds.size === 0}
                      startIcon={<DeleteSweepIcon />}
                    >
                      删除选中 ({selectedSiteIds.size})
                    </Button>
                    {(isAdmin || configs?.isAdmin === 'true') && (
                      <>
                        <Button
                          variant='contained'
                          color='warning'
                          size='small'
                          onClick={() => handleBatchFeaturedClick(1)}
                          disabled={selectedSiteIds.size === 0}
                          sx={{ textTransform: 'none' }}
                        >
                          设为精选
                        </Button>
                        <Button
                          variant='outlined'
                          color='warning'
                          size='small'
                          onClick={() => handleBatchFeaturedClick(0)}
                          disabled={selectedSiteIds.size === 0}
                          sx={{ textTransform: 'none' }}
                        >
                          取消精选
                        </Button>
                      </>
                    )}
                    <Button
                      variant='outlined'
                      color='inherit'
                      size='small'
                      onClick={handleExitBatchMode}
                      startIcon={<CloseIcon />}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant='outlined'
                      color='primary'
                      size='small'
                      onClick={() => setIsBatchMode(true)}
                      startIcon={<ChecklistIcon />}
                      sx={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    >
                      批量操作
                    </Button>
                    {onAddSite && group.id && (
                      <Button
                        variant='contained'
                        color='primary'
                        size='small'
                        onClick={() => onAddSite(group.id)}
                        startIcon={<AddIcon />}
                        sx={{
                          minWidth: 'auto',
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        }}
                      >
                        添加卡片
                      </Button>
                    )}
                  </>
                )}
                {/* 移除排序按钮 */}
                {/* <Button ... 排序 /> */}

                {onUpdateGroup && onDeleteGroup && (
                  <Tooltip title='编辑分组'>
                    <IconButton
                      color='primary'
                      onClick={handleEditClick}
                      size='small'
                      sx={{ alignSelf: 'center' }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )
          )}
        </Box>
      </Box>

      {/* 使用 Collapse 组件包装站点卡片区域，并实现按需渲染 */}
      <Collapse in={!isCollapsed} timeout='auto' unmountOnExit>
        {!isCollapsed && renderSites()}
      </Collapse>

      {/* 编辑分组弹窗 */}
      {
        onUpdateGroup && onDeleteGroup && (
          <EditGroupDialog
            open={editDialogOpen}
            group={group}
            onClose={() => setEditDialogOpen(false)}
            onSave={handleUpdateGroup}
            onDelete={handleDeleteGroup}
            canDelete={isAdmin || group.user_id === currentUserId}
          />
        )
      }


    </Paper >
  );
});

export default GroupCard;
