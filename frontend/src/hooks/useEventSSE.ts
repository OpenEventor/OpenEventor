import { useEffect, useRef } from 'react';
import { getStoredToken } from '../api/client';

interface SSEMessage {
  event: string;
  data: unknown;
}

interface UseEventSSEOptions {
  eventId: string;
  onMessage: (msg: SSEMessage) => void;
  enabled?: boolean;
}

/**
 * Hook that maintains an SSE connection to the event stream.
 * Auth is passed via ?jwt= query param since EventSource doesn't support headers.
 * Auto-reconnects with exponential backoff on disconnect.
 */
export function useEventSSE({ eventId, onMessage, enabled = true }: UseEventSSEOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !eventId) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 1000;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const token = getStoredToken();
      if (!token) return;

      const url = `/api/events/${eventId}/stream?jwt=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.onopen = () => {
        retryDelay = 1000; // Reset backoff on successful connect.
      };

      // Listen for named events: "passing", "competitor".
      for (const eventType of ['passing', 'competitor']) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as unknown;
            onMessageRef.current({ event: eventType, data });
          } catch {
            // Ignore malformed JSON.
          }
        });
      }

      es.onerror = () => {
        es?.close();
        es = null;
        if (!disposed) {
          retryTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, [eventId, enabled]);
}
