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

## Scope
Account-level header only (rendered by `ProtectedRoute` on non-event pages, e.g. the events list). In-event navigation now lives in the left [EventSidebar](../EventSidebar/AGENTS.md); the tab/`EVENT_TABS` code paths here only render when an `eventId` param is present, which no longer happens for this instance.

## Exports
- `AppBar` — the component
- `EVENT_TABS`, `MORE_TABS` — tab descriptor arrays (legacy in-event nav)
- `ThemeModeRadioGroup`, `HighContrastSwitch`, `CompactViewSwitch` — theme-control widgets reused by EventSidebar's Preferences menu

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
- On mobile (`< 600px`): search hidden

## Dependencies
- `AuthContext` — `logout()`
- `ThemeContext` — `mode`, `setMode`, `highContrast`, `setHighContrast`, `compactView`, `setCompactView`
- `react-router-dom` — `useParams`, `useNavigate`, `useLocation`

## Related
- [EventSidebar](../EventSidebar/AGENTS.md) — in-event left-sidebar navigation (replaces the old top tabs + BottomNav)
- [ProtectedRoute](../ProtectedRoute/AGENTS.md) — renders AppBar
