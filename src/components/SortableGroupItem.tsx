import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GroupWithSites } from '../types';
import { Paper, Typography, Box, IconButton, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';

interface SortableGroupItemProps {
  id: string;
  group: GroupWithSites;
  onDelete: (id: number) => void;
}

export default function SortableGroupItem({ id, group, onDelete }: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 9999 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        p: 2,
        borderRadius: 4,
        transition: isDragging ? 'none !important' : 'all 0.3s ease-in-out',
        border: '1px solid transparent',
        boxShadow: isDragging ? 8 : 2,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        '&:active': { cursor: 'grabbing' },
        '&:hover': {
          borderColor: 'divider',
          boxShadow: 6,
          '& .delete-btn': { opacity: 1 }
        },
        ...(isDragging && {
          outline: '2px solid',
          outlineColor: 'primary.main',
          transform: 'none',
          '& *': {
            transition: 'none !important',
          },
        }),
      }}
      {...attributes}
      {...listeners}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'inherit',
          flex: 1,
        }}
      >
        <DragIndicatorIcon
          sx={{
            mr: 2,
            color: 'primary.main',
            opacity: 0.7,
          }}
        />
        <Typography variant='h6' component='h2' fontWeight='600' color='text.primary'>
          {group.name}
        </Typography>
      </Box>

      {/* 删除按钮 */}
      <Tooltip title="删除分组 (移至回收站)">
        <IconButton
          className="delete-btn"
          size="small"
          color="error"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // 防止触发拖拽
            onDelete(group.id);
          }}
          sx={{
            opacity: 0,
            display: group.is_protected === 1 ? 'none' : 'inline-flex',
            transition: 'opacity 0.2s',
            // transform: 'scale(0.9)',
            // '&:hover': { transform: 'scale(1.1)' }
            // 移动端保持显示
            '@media (hover: none)': { opacity: group.is_protected === 1 ? 0 : 1 }
          }}
          onPointerDown={(e) => e.stopPropagation()} // 防止触发拖拽
          onMouseDown={(e) => e.stopPropagation()} // 额外防止鼠标按下触发拖拽
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
