# AppBar

## Purpose
Main navigation bar with two layout modes (compact/normal) controlled by theme context, and optional search.

## File
- `AppBar.tsx`

## Props
- `withSearch?: boolean` — default `false`. Shows search TextField left of settings gear (desktop only).

## Layout Modes (from ThemeContext `compactView`)
- **compact** (`compactView: true`): Single row (60px). Icon-only tabs, active tab highlighted with background.
- **normal** (`compactView: false`): Two rows (60px + 48px). Second row has tabs with icon + text. Active tab underlined with 2px orange line.

## Exports
- `AppBar` — the component
- `EVENT_TABS` — array of `{ path, label, icon }` for reuse in BottomNav

## Behavior
- Tab icons: Competitors (PeopleIcon), Splits (LeaderboardIcon), Groups (GroupWorkIcon), Teams (Diversity3Icon), More (MoreHorizIcon, placeholder)
- **compact**: Active tab = `bgcolor: action.selected`
- **normal**: Active tab = `borderBottom: 2px solid primary.main` (orange), no background
- Settings gear dropdown (DropDownMenu):
  - "Event settings" link (when inside event)
  - "Setup theme" → nested submenu titled "Choose a color mode":
    - Light / Dark / Auto radio options
    - High contrast switch (changes dividers to pure black/white)
    - Compact view switch (toggles AppBar layout mode)
  - Logout
- On mobile (`< 600px`): tabs hidden in both modes (moved to BottomNav), search hidden

## Dependencies
- `AuthContext` — `logout()`
- `ThemeContext` — `mode`, `setMode`, `highContrast`, `setHighContrast`, `compactView`, `setCompactView`
- `react-router-dom` — `useParams`, `useNavigate`, `useLocation`

## Related
- [BottomNav](../BottomNav/AGENTS.md) — mobile version of tab navigation
- [ProtectedRoute](../ProtectedRoute/AGENTS.md) — renders AppBar
