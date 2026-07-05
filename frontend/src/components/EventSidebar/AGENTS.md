# EventSidebar

## Purpose
In-event left-sidebar navigation, mirroring the iOS hub grouping. Replaces the old AppBar tabs + BottomNav for pages under `/events/:eventId`.

## File
- `EventSidebar.tsx`

## Props
- `mobileOpen: boolean` — controls the temporary drawer on `< 600px`.
- `onClose: () => void` — closes the mobile drawer; also called after every navigation/action.

## Exports
- `EventSidebar` — the component
- `DRAWER_WIDTH` — sidebar width in px (240)

## Layout
- **Desktop (`>= 600px`)**: `variant="permanent"` Drawer with `position: relative` paper, so it flows inside EventLayout's flex row (content sits beside it).
- **Mobile (`< 600px`)**: `variant="temporary"` overlay Drawer (`keepMounted`), opened by the hamburger in EventLayout's top bar.

## Contents (top → bottom)
- Header: OpenEventor logo (toggles PrivacyScreen), "← Events" back link, event name + date button → `settings`.
- Grouped nav (`List` + `ListSubheader`, active item via `ListItemButton selected`):
  - **Setup**: Checkpoints, Distances
  - **Participants**: Competitors, Groups, Teams
  - **Race day**: Monitor, Problems, Protocols
  - **Tools**: Export (action), Settings, Passings, Modules
- Footer: "Preferences" → DropDownMenu (theme setup + logout).

## Behavior
- Active route = last path segment of `useLocation().pathname`.
- **Export**: `GET /api/events/:eventId/export`, Blob → `<a download>`, parses `Content-Disposition` filename (fallback `event_<id>.db`) with `getStoredToken()`. Same pattern as `EventsListPage.handleDownload`.

## Dependencies
- `EventContext` — `useEvent()` (`eventId`, `displayName`, `date`)
- `AuthContext` — `logout()`
- `api/client` — `getStoredToken`
- `AppBar` — reuses `ThemeModeRadioGroup`, `HighContrastSwitch`, `CompactViewSwitch`
- `DropDownMenu`, `PrivacyScreen`

## Related
- [EventLayout](../EventLayout/AGENTS.md) — renders this and owns the mobile top bar
