// Custom hook for using real-time features in components
import { useContext, useEffect, useState, useCallback } from 'react';
import RealTimeContext from './RealTimeContext';
import { RealTimeState, UserPreferences } from './RealTimeContext';

export function useRealTime() {
  const context = useContext(RealTimeContext);

  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }

  const { state, ...actions } = context;

  // Local state for component-specific needs
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: state.isConnected,
    error: state.connectionError,
    attempts: state.connectionAttempts,
  });

  // Sync local state with context state
  useEffect(() => {
    setConnectionStatus({
      isConnected: state.isConnected,
      error: state.connectionError,
      attempts: state.connectionAttempts,
    });
  }, [state.isConnected, state.connectionError, state.connectionAttempts]);

  // Auto-connect on mount if not already connected
  useEffect(() => {
    if (!state.isConnected) {
      actions.connect();
    }
  }, []);

  // Reconnect on focus (app comes back to foreground)
  useEffect(() => {
    const handleFocus = () => {
      if (!state.isConnected) {
        actions.connect();
      }
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        handleFocus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state.isConnected]);

  // Event listener hook
  const useEventListener = (
    event: string,
    callback: (event: any) => void,
    dependencies: any[] = []
  ) => {
    useEffect(() => {
      const unsubscribe = actions.on(event, callback);
      return unsubscribe;
    }, dependencies);
  };

  return {
    // State
    ...state,
    connectionStatus,

    // Actions
    ...actions,

    // Hooks
    useEventListener,

    // Computed values
    isNotificationEnabled: state.isPushEnabled && state.preferences.pushNotifications,
    isNewPostsEnabled: state.preferences.newPosts,
    isMentionsEnabled: state.preferences.mentions,
    isElectionUpdatesEnabled: state.preferences.electionUpdates,
    isAdminAlertsEnabled: state.preferences.adminAlerts,

    // Helper methods
    joinTopic: (topic: string) => {
      actions.joinTopic(topic);
    },

    leaveTopic: (topic: string) => {
      actions.leaveTopic(topic);
    },

    updateNotificationPreferences: (preferences: Partial<UserPreferences>) => {
      actions.updatePreferences(preferences);
    },
  };
}

export default useRealTime;
