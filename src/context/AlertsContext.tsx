import React, {createContext, useContext, useState, ReactNode} from 'react';

interface AlertsContextValue {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({children}: {children: ReactNode}) {
  const [unreadCount, setUnreadCount] = useState(0);
  return (
    <AlertsContext.Provider value={{unreadCount, setUnreadCount}}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return ctx;
}
