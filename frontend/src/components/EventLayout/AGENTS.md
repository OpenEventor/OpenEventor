# EventLayout

## Purpose
Shell for event sub-pages. Wraps children in `EventProvider` and renders the persistent left [EventSidebar](../EventSidebar/AGENTS.md) beside the content `<Outlet />`. On narrow screens the sidebar becomes a temporary drawer and a slim top bar (hamburger + event name) opens it.

## File
- `EventLayout.tsx`

## Route
`/events/:eventId` — all event sub-pages are children of this layout.

## Structure
- Outer `Box` is `display: flex` (row): sidebar + content column, `height: 100vh`, `overflow: hidden`.
- Content column: optional mobile top bar (`< 600px`) + scrollable `<main>` (`p: 2`).
- `EventShell` reads `useEvent()` for the mobile top-bar title, so it lives inside `EventProvider`.

## Dependencies
- `EventSidebar` component (owns the Drawer, nav groups, export + preferences)
- `EventProvider` / `useEvent`
- MUI `useMediaQuery` for the mobile top bar

## Related
- [ProtectedRoute](../ProtectedRoute/AGENTS.md) — parent; renders the account-level AppBar (not on event pages)
- [EventSidebar](../EventSidebar/AGENTS.md) — the in-event navigation
