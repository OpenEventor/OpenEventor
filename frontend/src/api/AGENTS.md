# API Client

## Purpose
Thin fetch wrapper for all HTTP communication with the backend. Handles JSON serialization, auth token injection, and error parsing.

## Files
- `client.ts` — API client with `get`, `post`, `put`, `del` methods + token management helpers

## API
```typescript
api.get<T>(path: string): Promise<T>
api.post<T>(path: string, body?: unknown): Promise<T>
api.put<T>(path: string, body?: unknown): Promise<T>
api.del<T>(path: string): Promise<T>

getStoredToken(): string | null
setStoredToken(token: string): void
clearStoredToken(): void
```

- All paths are relative (`/api/...`), proxied to backend by Vite in dev, served directly in production
- Token read from `localStorage` on every request (`openeventor_token` key)
- Throws `ApiError` (with `status` and `message`) on non-2xx responses

## Dependencies
- None (pure fetch)

## Used by
- `AuthContext` — for login/logout API calls and token storage
- All pages that fetch data from the backend
