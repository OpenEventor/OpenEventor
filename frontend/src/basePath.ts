// Runtime base path for reverse-proxy subpath deployments (e.g. served under
// /oe/ behind nginx). The server injects it into index.html from the
// X-Forwarded-Prefix header or the BASE_PATH env var; empty = served at root
// (the default for a directly-run binary). One build works for any mount point.
export const BASE_PATH: string =
  (window as unknown as { __BASE_PATH__?: string }).__BASE_PATH__ ?? '';

/** Prefix an absolute app path ("/api/…") with the runtime base path. */
export function apiUrl(path: string): string {
  return BASE_PATH + path;
}
