# ProtectedRoute

## Purpose
Layout route that enforces authentication. Redirects to `/login` if user is not authenticated. Renders shared page chrome: AppBar at top + main content area with `<Outlet />`.

## File
- `ProtectedRoute.tsx`

## Behavior
- Checks `isAuthenticated` from `AuthContext`
- If not authenticated: `<Navigate to="/login">` with `state.from` for redirect-back after login
- If authenticated: renders AppBar + `<Outlet />` in a flex column layout

## Route
Root layout route at `/` — all protected pages are children.

## Dependencies
- `AuthContext` — `isAuthenticated`
- `AppBar` component

## Related
- [AppBar](../AppBar/AGENTS.md) — rendered inside this layout
- [EventLayout](../EventLayout/AGENTS.md) — nested layout for event pages
- [LoginPage](../../pages/LoginPage/AGENTS.md) — redirect target when not authenticated
