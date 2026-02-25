# BottomNav

## Purpose
Mobile-only bottom navigation bar for event sub-pages. Fixed at screen bottom. Shows same tabs as AppBar desktop icons.

## File
- `BottomNav.tsx`

## Behavior
- Uses MUI `BottomNavigation` + `BottomNavigationAction`
- Shows: Competitors, Splits, Groups, Teams, More
- Active tab determined from URL path
- Navigates to `/events/:eventId/<tab>` on tap
- Only rendered inside `EventLayout` when viewport < 600px

## Dependencies
- `EVENT_TABS` from `AppBar` component
- `react-router-dom` — `useParams`, `useNavigate`, `useLocation`

## Related
- [AppBar](../AppBar/AGENTS.md) — desktop version of tab navigation
- [EventLayout](../EventLayout/AGENTS.md) — conditionally renders BottomNav
