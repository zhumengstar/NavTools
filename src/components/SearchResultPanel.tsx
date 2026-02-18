/**
 * 搜索结果面板组件
 * 显示站内搜索结果的下拉面板
 */

import React from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Box,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { SearchResultItem } from '../utils/search';

interface SearchResultPanelProps {
  results: SearchResultItem[];
  query: string;
  onResultClick: (result: SearchResultItem) => void;
  onDelete?: (id: number) => void;
  onEditGroup?: (id: number) => void;
  onMoveSite?: (siteId: number) => void;
  open: boolean;
}

const SearchResultPanel: React.FC<SearchResultPanelProps> = ({
  results,
  query,
  onResultClick,
  onDelete,
  onEditGroup,
  onMoveSite,
  open,
}) => {
  const showPanel = open && !!query && results.length > 0;

  // 高亮匹配文本
  const highlightText = (text: string, query: string) => {
    if (!text || !query) return text;

    // 转义正则特殊字符
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Box
              key={i}
              component='span'
              sx={{
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                padding: '0 2px',
                borderRadius: '2px',
                display: 'inline-block',
                lineHeight: 1,
              }}
            >
              {part}
            </Box>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <>
      {showPanel && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            maxHeight: '400px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            zIndex: 1300,
            borderRadius: 2,
          }}
        >
          <List sx={{ py: 0 }}>
            {results.map((result, index) => (
              <React.Fragment key={`${result.type}-${result.id}`}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton onClick={() => {
                    if (result.type === 'group' && onEditGroup) {
                      onEditGroup(result.id);
                    } else {
                      onResultClick(result);
                    }
                  }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        width: '100%',
                        py: 0.5,
                      }}
                    >
                      {/* 图标 */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32, // 改为 32x32 与 SiteCard 保持一致性
                          height: 32,
                          borderRadius: 1,
                          bgcolor: result.type === 'site' ? 'primary.light' : 'secondary.light',
                          color: result.type === 'site' ? 'primary.main' : 'secondary.main',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {result.type === 'site' ? (
                          result.icon ? (
                            <Box
                              component="img"
                              src={result.icon}
                              alt={result.name}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e: any) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement.innerHTML = `<span>${result.name.charAt(0).toUpperCase()}</span>`;
                              }}
                            />
                          ) : (
                            <Typography variant="body2" fontWeight="bold">
                              {result.name.charAt(0).toUpperCase()}
                            </Typography>
                          )
                        ) : (
                          <FolderIcon fontSize="small" />
                        )}
                      </Box>

                      {/* 内容 */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant='body1'
                                sx={{
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {highlightText(result.name, query)}
                              </Typography>
                              <Chip
                                label={result.type === 'site' ? '站点' : '分组'}
                                size='small'
                                color={result.type === 'site' ? 'primary' : 'secondary'}
                                sx={{ height: 20 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              {result.type === 'site' && result.groupName && (
                                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography
                                    variant='caption'
                                    sx={{ color: 'text.secondary' }}
                                  >
                                    分组:
                                  </Typography>
                                  <Typography
                                    variant='caption'
                                    sx={{
                                      color: 'text.secondary',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        color: 'primary.main',
                                        textDecoration: 'underline',
                                      },
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (onMoveSite) {
                                        onMoveSite(result.id);
                                      }
                                    }}
                                  >
                                    {result.groupName}
                                  </Typography>
                                </Box>
                              )}
                              {result.url && (
                                <Typography
                                  variant='caption'
                                  sx={{
                                    color: 'text.secondary',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {highlightText(result.url, query)}
                                </Typography>
                              )}
                              {result.description && (
                                <Typography
                                  variant='caption'
                                  sx={{
                                    color: 'text.secondary',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {highlightText(result.description, query)}
                                </Typography>
                              )}
                              {result.notes && (
                                <Typography
                                  variant='caption'
                                  sx={{
                                    color: 'text.secondary',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  备注: {highlightText(result.notes, query)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </Box>

                      {/* 删除按钮 */}
                      {result.type === 'site' && (
                        <Box sx={{ ml: 1 }}>
                          <Tooltip title={onDelete ? '删除书签' : '请先登录以管理书签'}>
                            <span>
                              <IconButton
                                size='small'
                                disabled={!onDelete}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDelete) {
                                    onDelete(result.id);
                                  }
                                }}
                                sx={{
                                  color: 'text.disabled',
                                  '&:hover': {
                                    color: onDelete ? 'error.main' : 'text.disabled',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>

          {/* 结果统计 */}
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'action.hover',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant='caption' color='text.secondary'>
              找到 {results.length} 个结果
            </Typography>
          </Box>
        </Paper>
      )}

    </>
  );
};

export default SearchResultPanel;
