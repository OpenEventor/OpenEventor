import { useState, type MouseEvent } from 'react';
import { useTheme } from '@mui/material';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Passing } from '../../api/types';
import { api } from '../../api/client';
import DropDownMenu from '../DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../DropDownMenu/types';
import BasePassingBlock, { luminance } from './PassingBlock';

export interface InteractivePassingBlockProps {
  passing: Passing;
  delta: number | null;
  eventId: string;
  /** Override background color (e.g. for highlight animation in Monitor). */
  bgcolor?: string;
  /** Called when user picks an action from the context menu or double-clicks. */
  onMenuAction?: (action: 'edit' | 'add-before' | 'add-after') => void;
  /** Called after enable/disable toggle API call completes. */
  onAfterToggle?: () => void;
  /** Called when context menu opens. */
  onContextMenuOpen?: () => void;
  /** Called when context menu closes. */
  onContextMenuClose?: () => void;
}

export default function InteractivePassingBlock({
  passing,
  delta,
  eventId,
  bgcolor,
  onMenuAction,
  onAfterToggle,
  onContextMenuOpen,
  onContextMenuClose,
}: InteractivePassingBlockProps) {
  const theme = useTheme();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const enabled = passing.enabled === 1;

  const toggleEnabled = () => {
    handleMenuClose();
    if (!eventId) return;
    api.put(`/api/events/${eventId}/passings/${passing.id}`, {
      card: passing.card,
      checkpoint: passing.checkpoint,
      timestamp: passing.timestamp,
      enabled: enabled ? 0 : 1,
      source: passing.source,
      sortOrder: passing.sortOrder,
    }).then(() => onAfterToggle?.());
  };

  const normalBg = enabled
    ? theme.palette.primary.main
    : (theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]);

  const hoverBrightness = luminance(bgcolor ?? normalBg) > 0.5 ? 0.8 : 1.2;

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenuOpen?.();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const handleMenuClose = () => {
    setMenuPos(null);
    onContextMenuClose?.();
  };

  const fireAction = (action: 'edit' | 'add-before' | 'add-after') => {
    handleMenuClose();
    onMenuAction?.(action);
  };

  const menu: DropDownMenuConfig = {
    title: passing.checkpoint,
    items: [
      { icon: <ViewDayIcon fontSize="small" color="primary" />, text: 'Edit passing', action: () => fireAction('edit') },
      enabled
        ? { icon: <DisabledByDefaultIcon fontSize="small" color="error" />, text: 'Disable', action: toggleEnabled }
        : { icon: <CheckCircleIcon fontSize="small" color="success" />, text: 'Enable', action: toggleEnabled },
    ],
  };

  return (
    <>
      <BasePassingBlock
        passing={passing}
        delta={delta}
        bgcolor={bgcolor}
        onDoubleClick={() => onMenuAction?.('edit')}
        onContextMenu={handleContextMenu}
        sx={menuPos ? { filter: `brightness(${hoverBrightness})` } : undefined}
      />

      <DropDownMenu
        open={menuPos !== null}
        onClose={handleMenuClose}
        menu={menu}
        anchorPosition={menuPos ?? undefined}
        width={180}
      />
    </>
  );
}
