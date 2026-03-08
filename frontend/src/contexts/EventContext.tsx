/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.ts';
import type { EventItem } from '../api/types.ts';

interface EventContextValue {
  eventId: string;
  displayName: string;
  date: string;          // YYYY-MM-DD — used as baseDate for TimeInput
  timezone: string;      // IANA timezone string (hardcoded "UTC" for now)
  loading: boolean;
}

const EventContext = createContext<EventContextValue | null>(null);

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useEvent must be used within EventProvider');
  }
  return ctx;
}

/** Safe version that returns null outside EventProvider (e.g. in AppBar on events list page). */
export function useEventOptional(): EventContextValue | null {
  return useContext(EventContext);
}

export function EventProvider({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<EventItem>(`/api/events/${eventId}`)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  const value: EventContextValue = {
    eventId: eventId ?? '',
    displayName: event?.displayName ?? '',
    date: (() => {
      const raw = event?.date;
      if (!raw) return new Date().toISOString().slice(0, 10);
      // Backend may return DD.MM.YYYY — convert to YYYY-MM-DD
      const dotMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (dotMatch) return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
      return raw;
    })(),
    timezone: 'UTC',
    loading,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}
