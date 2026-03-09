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

/** Raw settings map from GET /api/events/:id/settings */
export type EventSettings = Record<string, string>;

interface EventContextValue {
  eventId: string;
  settings: EventSettings;
  displayName: string;
  date: string;          // YYYY-MM-DD — used as baseDate for TimeInput
  timezone: string;      // IANA timezone string from event settings
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
  const [settings, setSettings] = useState<EventSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setSettings({});
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<EventSettings>(`/api/events/${eventId}/settings`)
      .then(setSettings)
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, [eventId]);

  const value: EventContextValue = {
    eventId: eventId ?? '',
    settings,
    displayName: settings.event_name ?? '',
    date: settings.event_date || new Date().toISOString().slice(0, 10),
    timezone: settings.event_timezone || 'UTC',
    loading,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}
