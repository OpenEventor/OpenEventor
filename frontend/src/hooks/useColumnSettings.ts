import { useState, useMemo, useCallback } from 'react';
import type { GridColDef } from '@mui/x-data-grid';

export interface ColumnDef {
  field: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
}

export interface ColumnState {
  field: string;
  visible: boolean;
  order: number;
}

function storageKey(key: string): string {
  return `openeventor_cols_${key}`;
}

function loadState(key: string): ColumnState[] | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as ColumnState[];
  } catch {
    return null;
  }
}

function saveState(key: string, state: ColumnState[]): void {
  localStorage.setItem(storageKey(key), JSON.stringify(state));
}

function buildInitialState(definitions: ColumnDef[]): ColumnState[] {
  return definitions.map((def, index) => ({
    field: def.field,
    visible: def.defaultVisible !== false,
    order: index,
  }));
}

function mergeWithStored(definitions: ColumnDef[], stored: ColumnState[]): ColumnState[] {
  const storedMap = new Map(stored.map((s) => [s.field, s]));
  const maxOrder = stored.reduce((max, s) => Math.max(max, s.order), -1);

  const merged: ColumnState[] = [];
  let nextOrder = maxOrder + 1;

  for (const def of definitions) {
    const existing = storedMap.get(def.field);
    if (existing) {
      merged.push(existing);
    } else {
      merged.push({
        field: def.field,
        visible: def.defaultVisible !== false,
        order: nextOrder++,
      });
    }
  }

  return merged;
}

export function useColumnSettings(
  key: string,
  definitions: ColumnDef[],
  allColumns: GridColDef[],
) {
  const [columnState, setColumnState] = useState<ColumnState[]>(() => {
    const stored = loadState(key);
    if (stored) {
      return mergeWithStored(definitions, stored);
    }
    return buildInitialState(definitions);
  });

  const defMap = useMemo(
    () => new Map(definitions.map((d) => [d.field, d])),
    [definitions],
  );

  const visibleColumns = useMemo(() => {
    const sorted = [...columnState].sort((a, b) => a.order - b.order);
    const colMap = new Map(allColumns.map((c) => [c.field, c]));

    return sorted
      .filter((s) => s.visible)
      .map((s) => colMap.get(s.field))
      .filter((c): c is GridColDef => c !== undefined);
  }, [columnState, allColumns]);

  const sortedState = useMemo(
    () => [...columnState].sort((a, b) => a.order - b.order),
    [columnState],
  );

  const setColumnVisible = useCallback(
    (field: string, visible: boolean) => {
      const def = defMap.get(field);
      if (def?.alwaysVisible) return;

      setColumnState((prev) => {
        const next = prev.map((s) => (s.field === field ? { ...s, visible } : s));
        saveState(key, next);
        return next;
      });
    },
    [key, defMap],
  );

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      setColumnState((prev) => {
        const sorted = [...prev].sort((a, b) => a.order - b.order);
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(toIndex, 0, moved);
        const next = sorted.map((s, i) => ({ ...s, order: i }));
        saveState(key, next);
        return next;
      });
    },
    [key],
  );

  const resetToDefaults = useCallback(() => {
    const initial = buildInitialState(definitions);
    localStorage.removeItem(storageKey(key));
    setColumnState(initial);
  }, [key, definitions]);

  return {
    visibleColumns,
    columnState: sortedState,
    definitions,
    setColumnVisible,
    moveColumn,
    resetToDefaults,
  };
}
