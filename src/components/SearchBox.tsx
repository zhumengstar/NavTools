/**
 * 搜索框组件
 * 支持站内搜索和站外搜索引擎跳转
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paper,
  InputBase,
  IconButton,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  Tooltip,
  Avatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  useMediaQuery,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  TravelExplore as GlobalIcon,
  HomeWork as LocalIcon,
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import SearchResultPanel from './SearchResultPanel';
import { searchInternal, type SearchResultItem } from '../utils/search';
import {
  SEARCH_ENGINES,
  getDefaultSearchEngine,
  getSearchEngineByKey,
  buildSearchUrl,
  isUrl,
  normalizeUrl,
  type SearchEngine,
} from '../config/searchEngines';
import type { Group, Site } from '../API/http';

interface SearchBoxProps {
  groups: Group[];
  sites: Site[];
  onInternalResultClick?: (result?: SearchResultItem) => void;
  onDelete?: (id: number) => void;
  onEditGroup?: (id: number) => void;
  onMoveSite?: (siteId: number) => void;
  onQueryChange?: (query: string) => void;
  showDropdown?: boolean;
}

type SearchMode = 'internal' | 'external';

const SearchBox: React.FC<SearchBoxProps> = ({
  groups,
  sites,
  onInternalResultClick,
  onDelete,
  onEditGroup,
  onMoveSite,
  onQueryChange,
  showDropdown = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');

  // 同步 query 状态给父组件
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  const [mode, setMode] = useState<SearchMode>('internal');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<SearchEngine>(getDefaultSearchEngine());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevQueryRef = useRef(query); // 记录上次搜索的查询内容

  // 使用 Ref 保存最新的数据，防止 handleInternalSearch 因为数据变动而重新生成
  const groupsRef = useRef(groups);
  const sitesRef = useRef(sites);

  useEffect(() => {
    groupsRef.current = groups;
    sitesRef.current = sites;
  }, [groups, sites]);

  // 处理站内搜索
  const handleInternalSearch = useCallback(
    (searchQuery: string) => {
      // 总是从 ref 中读取最新的数据进行计算
      const currentGroups = groupsRef.current;
      const currentSites = sitesRef.current;

      if (!searchQuery.trim()) {
        const allResults = searchInternal('', currentGroups, currentSites);
        setResults(allResults.slice(0, 50));
        setShowResults(true);
        return;
      }

      const searchResults = searchInternal(searchQuery, currentGroups, currentSites);
      setResults(searchResults);
      setShowResults(true);
    },
    [] // 彻底稳定，不依赖任何外部变量
  );

  // 处理输入变化（带防抖）
  useEffect(() => {
    if (mode === 'internal') {
      // 只有当查询内容真正变化时才重新触发“自动”搜索
      // 这可以防止因为全局 sites/groups 更新导致的其他副作用
      if (query !== prevQueryRef.current) {
        prevQueryRef.current = query;
        const timer = setTimeout(() => {
          handleInternalSearch(query);
        }, 300); // 300ms 防抖
        return () => clearTimeout(timer);
      }
    } else {
      setShowResults(false);
    }
    return undefined;
  }, [query, mode, handleInternalSearch]);

  // 处理站外搜索
  const handleExternalSearch = () => {
    if (!query.trim()) return;

    let url: string;

    // 如果输入看起来像 URL，直接打开
    if (isUrl(query)) {
      url = normalizeUrl(query);
    } else {
      // 否则使用选中的搜索引擎
      url = buildSearchUrl(selectedEngine, query);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
    setShowResults(false);
  };

  // 处理按下回车键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (mode === 'internal') {
        // 站内搜索：如果有结果，选择第一个，或者触发全局过滤
        if (results.length > 0 && results[0] && query.trim()) {
          // 这里我们通知父组件：搜索已完成，请展示结果
          onInternalResultClick?.(); // 不带参数调用，表示“展示当前过滤出的结果”
          setShowResults(false);
        } else if (!query.trim()) {
          // 清空搜索
          onInternalResultClick?.();
          setShowResults(false);
        }
      } else {
        // 站外搜索：执行搜索
        handleExternalSearch();
      }
    } else if (e.key === 'Escape') {
      // ESC 键关闭搜索结果
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  // 处理搜索模式切换
  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: SearchMode | null) => {
    if (newMode !== null) {
      setMode(newMode);
      setQuery('');
      setResults([]);
      setShowResults(false);
      // Defer focus to allow UI update to happen first, reducing perceived lag
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // 处理结果点击
  const handleResultClick = (result: SearchResultItem) => {
    setShowResults(false);
    setQuery('');

    if (result.type === 'site' && result.url) {
      // 打开站点 URL
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }

    // 调用外部回调（如需要滚动到该元素等）
    onInternalResultClick?.(result);
  };

  // 处理删除（乐观更新搜索列表）
  const handleLocalDelete = (id: number) => {
    // 立即从本地搜索结果列表中移除，实现无感删除
    setResults(prev => prev.filter(item => item.id !== id));

    // 调用父组件的删除逻辑处理真正的数据删除
    // 注意：这里不需要再触发重搜索，因为界面已经通过乐观更新处理好了
    onDelete?.(id);
  };

  // 处理清空输入
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  // 处理搜索引擎选择菜单
  const handleEngineMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleEngineMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEngineSelect = (engine: SearchEngine) => {
    setSelectedEngine(engine);
    handleEngineMenuClose();
    // 保存到 localStorage
    localStorage.setItem('selectedSearchEngine', engine.key);
  };

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 从 localStorage 恢复上次选择的搜索引擎
  useEffect(() => {
    const savedEngineKey = localStorage.getItem('selectedSearchEngine');
    if (savedEngineKey) {
      const engine = getSearchEngineByKey(savedEngineKey);
      if (engine) {
        setSelectedEngine(engine);
      }
    }
  }, []);

  // 全局快捷键支持 (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K (Windows/Linux) 或 Cmd+K (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 处理输入框聚焦
  const handleInputFocus = useCallback(() => {
    if (mode === 'internal') {
      if (!query.trim()) {
        // 空查询时显示所有站点（限制前 50 个以防卡顿）
        handleInternalSearch('');
      } else if (!showResults) {
        // 非空时，如果面板未打开，重新触发搜索
        handleInternalSearch(query);
      }
    }
  }, [mode, query, showResults, handleInternalSearch]);

  return (
    <Box ref={searchBoxRef} sx={{ position: 'relative', width: '100%', maxWidth: 800, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1
        }}
      >
        {/* 搜索模式切换 - 移到外侧 */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size='small'
          fullWidth={isMobile}
          sx={{
            flexShrink: 0,
            height: 48,
            '& .MuiToggleButton-root': {
              flex: { xs: 1, sm: 'initial' },
              px: 2,
              border: '1px solid',
              borderColor: 'divider',
            }
          }}
        >
          <ToggleButton value='internal' aria-label='站内搜索'>
            <Tooltip title='站内搜索'>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocalIcon fontSize='small' />
                <Typography variant='caption' sx={{ display: { xs: 'block', sm: 'none' } }}>站内</Typography>
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value='external' aria-label='站外搜索'>
            <Tooltip title='站外搜索'>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GlobalIcon fontSize='small' />
                <Typography variant='caption' sx={{ display: { xs: 'block', sm: 'none' } }}>站外</Typography>
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: '2px 4px',
            height: 48,
            borderRadius: 3,
            transition: 'all 0.3s',
            flex: 1,
            '&:focus-within': {
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
        >
          {/* 搜索引擎选择器（仅站外模式） */}
          {mode === 'external' && (
            <>
              <Tooltip title={`当前: ${selectedEngine.name}`}>
                <IconButton size='small' onClick={handleEngineMenuOpen} sx={{ p: 0.5, ml: 0.5 }}>
                  {selectedEngine.icon ? (
                    <Avatar
                      src={selectedEngine.icon}
                      sx={{ width: 24, height: 24 }}
                      alt={selectedEngine.name}
                    />
                  ) : (
                    <SearchIcon fontSize='small' />
                  )}
                  <ExpandMoreIcon fontSize='small' />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleEngineMenuClose}>
                {SEARCH_ENGINES.map((engine) => (
                  <MenuItem
                    key={engine.key}
                    onClick={() => handleEngineSelect(engine)}
                    selected={engine.key === selectedEngine.key}
                  >
                    <ListItemIcon>
                      {engine.icon ? (
                        <Avatar
                          src={engine.icon}
                          sx={{ width: 24, height: 24 }}
                          alt={engine.name}
                        />
                      ) : (
                        <SearchIcon fontSize='small' />
                      )}
                    </ListItemIcon>
                    <ListItemText>{engine.name}</ListItemText>
                    {engine.key === selectedEngine.key && (
                      <CheckIcon fontSize='small' color='primary' />
                    )}
                  </MenuItem>
                ))}
              </Menu>
              <Divider orientation='vertical' flexItem sx={{ mx: 1 }} />
            </>
          )}

          {/* 搜索输入框 */}
          <InputBase
            ref={inputRef}
            placeholder={
              mode === 'internal'
                ? '搜索站点、分组...'
                : `使用 ${selectedEngine.name} 搜索或输入网址...`
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onClick={handleInputFocus}
            sx={{ ml: 1, flex: 1 }}
            inputProps={{ 'aria-label': '搜索' }}
            autoComplete='off'
          />

          {/* 模式标签 */}
          {query && (
            <Chip
              label={mode === 'internal' ? '站内' : '站外'}
              size='small'
              color={mode === 'internal' ? 'secondary' : 'primary'}
              sx={{ mr: 1 }}
            />
          )}

          {/* 清空按钮 */}
          {query && (
            <IconButton size='small' onClick={handleClear} sx={{ mr: 0.5 }}>
              <CloseIcon fontSize='small' />
            </IconButton>
          )}

          {/* 搜索按钮 */}
          <IconButton
            size='small'
            onClick={mode === 'external' ? handleExternalSearch : undefined}
            disabled={!query.trim()}
            sx={{ mr: 0.5 }}
          >
            <SearchIcon />
          </IconButton>
        </Paper>
      </Box>

      {/* 站内搜索结果面板 */}
      {mode === 'internal' && showDropdown && (
        <SearchResultPanel
          results={results}
          query={query}
          onResultClick={handleResultClick}
          onDelete={handleLocalDelete}
          onEditGroup={onEditGroup}
          onMoveSite={onMoveSite}
          open={showResults}
        />
      )}
    </Box>
  );
};

// Use React.memo with a custom comparison function to ignore unstable callbacks if safe,
// or just standard memo to prevent parent re-renders when props match.
// Since groups/sites can be large, we'll verify if they changed.
export default React.memo(SearchBox);
