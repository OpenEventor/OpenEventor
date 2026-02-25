# EventLayout

## Purpose
Layout wrapper for event sub-pages. Renders `<Outlet />` for child routes and BottomNav on mobile. Adds bottom padding on mobile to prevent content overlap with fixed BottomNav.

## File
- `EventLayout.tsx`

## Route
`/events/:eventId` — all event sub-pages are children of this layout.

## Dependencies
- `BottomNav` component
- MUI `useMediaQuery` for responsive behavior

## Related
- [ProtectedRoute](../ProtectedRoute/AGENTS.md) — parent layout (renders AppBar)
- [BottomNav](../BottomNav/AGENTS.md) — rendered here on mobile
