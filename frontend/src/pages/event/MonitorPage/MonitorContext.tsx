/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { Course, Group } from '../../../api/types';

interface MonitorContextValue {
  eventId: string;
  courses: Map<string, Course>;
  groups: Map<string, Group>;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

export function useMonitorContext(): MonitorContextValue {
  const ctx = useContext(MonitorContext);
  if (!ctx) {
    throw new Error('useMonitorContext must be used within MonitorProvider');
  }
  return ctx;
}

export function MonitorProvider({
  value,
  children,
}: {
  value: MonitorContextValue;
  children: ReactNode;
}) {
  return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}
