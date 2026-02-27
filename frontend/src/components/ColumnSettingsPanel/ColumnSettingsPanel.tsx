import { useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Typography,
} from '@mui/material';
import { DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnDef, ColumnState } from '../../hooks/useColumnSettings.ts';

interface ColumnSettingsPanelProps {
  columnState: ColumnState[];
  definitions: ColumnDef[];
  onVisibleChange: (field: string, visible: boolean) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
}

function SortableRow({
  state,
  def,
  onToggle,
}: {
  state: ColumnState;
  def: ColumnDef;
  onToggle: (field: string, visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: state.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        py: 0.25,
        px: 0.5,
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          color: 'text.secondary',
          touchAction: 'none',
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      <Checkbox
        size="small"
        checked={state.visible}
        disabled={def.alwaysVisible}
        onChange={(_, checked) => onToggle(state.field, checked)}
        sx={{ p: 0.25 }}
      />
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.85rem',
          color: state.visible ? 'text.primary' : 'text.disabled',
        }}
      >
        {def.label}
      </Typography>
    </Box>
  );
}

export function ColumnSettingsPanel({
  columnState,
  definitions,
  onVisibleChange,
  onMove,
  onReset,
}: ColumnSettingsPanelProps) {
  const defMap = new Map(definitions.map((d) => [d.field, d]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = columnState.findIndex((s) => s.field === active.id);
      const toIndex = columnState.findIndex((s) => s.field === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        onMove(fromIndex, toIndex);
      }
    },
    [columnState, onMove],
  );

  return (
    <Box sx={{ minWidth: 200 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columnState.map((s) => s.field)}
          strategy={verticalListSortingStrategy}
        >
          {columnState.map((state) => {
            const def = defMap.get(state.field);
            if (!def) return null;
            return (
              <SortableRow
                key={state.field}
                state={state}
                def={def}
                onToggle={onVisibleChange}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      <Box sx={{ px: 0.5, py: 0.5, borderTop: 1, borderColor: 'divider', mt: 0.5 }}>
        <Button size="small" onClick={onReset} sx={{ fontSize: '0.8rem' }}>
          Reset to defaults
        </Button>
      </Box>
    </Box>
  );
}
