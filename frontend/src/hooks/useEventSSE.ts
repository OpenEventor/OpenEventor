import { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../api/client';

export type SSEStatus = 'connecting' | 'online' | 'offline';

interface SSEMessage {
  event: string;
  data: unknown;
}

interface UseEventSSEOptions {
  eventId: string;
  onMessage: (msg: SSEMessage) => void;
  enabled?: boolean;
}

/** Server sends heartbeat every 5s; if nothing arrives in 10s, connection is dead. */
const HEARTBEAT_TIMEOUT_MS = 10_000;

/**
 * Hook that maintains an SSE connection to the event stream.
 * Auth is passed via ?jwt= query param since EventSource doesn't support headers.
 * Auto-reconnects with exponential backoff on disconnect.
 * Uses heartbeat timeout to detect dead connections (server pings every 15s).
 */
export function useEventSSE({ eventId, onMessage, enabled = true }: UseEventSSEOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [status, setStatus] = useState<SSEStatus>('connecting');
  const reconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !eventId) {
      setStatus('offline');
      return;
    }

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let heartbeatTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 1000;
    let disposed = false;

    function resetHeartbeat() {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = setTimeout(() => {
        // No data (including heartbeat pings) for 30s — connection is dead.
        handleDisconnect();
      }, HEARTBEAT_TIMEOUT_MS);
    }

    function scheduleRetry() {
      if (!disposed) {
        retryTimeout = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }

    function handleDisconnect() {
      clearTimeout(heartbeatTimeout);
      es?.close();
      es = null;
      setStatus('offline');
      scheduleRetry();
    }

    function connect() {
      if (disposed) return;

      setStatus('connecting');
      const token = getStoredToken();
      if (!token) {
        setStatus('offline');
        return;
      }

      const url = `/api/events/${eventId}/stream?jwt=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.onopen = () => {
        retryDelay = 1000;
        setStatus('online');
        resetHeartbeat();
      };

      // Listen for named events: "passing", "competitor".
      for (const eventType of ['passing', 'competitor']) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          resetHeartbeat();
          try {
            const data = JSON.parse(e.data) as unknown;
            onMessageRef.current({ event: eventType, data });
          } catch {
            // Ignore malformed JSON.
          }
        });
      }

      es.onerror = () => {
        handleDisconnect();
      };
    }

    reconnectRef.current = () => {
      clearTimeout(retryTimeout);
      clearTimeout(heartbeatTimeout);
      es?.close();
      es = null;
      retryDelay = 1000;
      connect();
    };

    connect();

    return () => {
      disposed = true;
      reconnectRef.current = null;
      clearTimeout(retryTimeout);
      clearTimeout(heartbeatTimeout);
      es?.close();
    };
  }, [eventId, enabled]);

  const reconnect = useCallback(() => {
    reconnectRef.current?.();
  }, []);

  return { status, reconnect };
}
