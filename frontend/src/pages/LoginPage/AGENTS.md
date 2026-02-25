# LoginPage

## Purpose
Authentication page. Centered MUI Card with login/password form. Redirects to `/events` (or previous page) after successful login.

## File
- `LoginPage.tsx`

## Route
`/login` — public (no auth required)

## Behavior
- If already authenticated, redirects to `/events`
- Login form: username + password TextFields, "Sign In" button
- Calls `AuthContext.login()` on submit
- Shows `Alert` on error
- Loading state disables button during API call
- On success, navigates to `location.state.from` or `/events`

## Dependencies
- `AuthContext` — `isAuthenticated`, `login()`
- `react-router-dom` — `useNavigate`, `useLocation`, `Navigate`
