# Contexts

## AuthContext

### Purpose
Manages authentication state: token, user info, login/logout actions. Provides `useAuth()` hook.

### File
- `AuthContext.tsx`

### API
```typescript
useAuth(): {
  token: string | null;
  user: { id: string; login: string; name: string } | null;
  isAuthenticated: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}
```

- Token persisted in `localStorage` (`openeventor_token`)
- `login()` calls `POST /api/auth/login`, stores token
- `logout()` clears token, fire-and-forget server call
- `isAuthenticated` = `token !== null`

### Used by
- `ProtectedRoute` — checks `isAuthenticated`
- `LoginPage` — calls `login()`
- `AppBar` — calls `logout()`, reads `user`

---

## ThemeContext

### Purpose
Manages theme mode (light/dark/system). Wraps MUI `ThemeProvider` with custom theme (primary: `#DC3300`).

### File
- `ThemeContext.tsx`

### API
```typescript
useThemeMode(): {
  mode: 'light' | 'dark' | 'system';
  setMode(mode: 'light' | 'dark' | 'system'): void;
}
```

- Persisted in `localStorage` (`openeventor_theme`)
- Default: `system` (follows `prefers-color-scheme`)
- Provides MUI `ThemeProvider` + `CssBaseline` internally

### Used by
- `AppBar` — settings menu theme switcher
