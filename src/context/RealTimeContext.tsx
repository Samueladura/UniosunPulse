// Real-time Context for WebSocket and Push Notifications
// This context provides real-time updates and notification management to React components

import React, {createContext, useContext, useReducer, useEffect, ReactNode} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import webSocketService from './websocket';
import pushNotificationService from './push-notifications';

export interface RealTimeState {
  // WebSocket connection state
  isConnected: boolean;
  connectionError: string | null;
  connectionAttempts: number;
  socketId: string | null;
  
  // Notification state
  isPushEnabled: boolean;
  pendingNotifications: any[];
  badgeCount: number;
  
  // User preferences
  preferences: UserPreferences;
  
  // Joined topics
  joinedTopics: string[];
}

export interface UserPreferences {
  newPosts: boolean;
  mentions: boolean;
  electionUpdates: boolean;
  adminAlerts: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface RealTimeContextType {
  state: RealTimeState;
  
  // Connection management
  connect(): Promise<boolean>;
  disconnect(): void;
  reconnect(): void;
  
  // Notification management
  enablePushNotifications(): Promise<boolean>;
  disablePushNotifications(): void;
  scheduleNotification(notification: any): void;
  cancelAllNotifications(): void;
  
  // Topic management
  joinTopic(topic: string): void;
  leaveTopic(topic: string): void;
  
  // Preference management
  updatePreferences(preferences: Partial<UserPreferences>): void;
  
  // Event listeners
  on(event: string, callback: (event: any) => void): () => void;
  onConnectionChange(callback: (connected: boolean) => void): () => void;
}

export interface RealTimeProviderProps {
  children: ReactNode;
}

// Initial state
const initialState: RealTimeState = {
  isConnected: false,
  connectionError: null,
  connectionAttempts: 0,
  socketId: null,
  isPushEnabled: false,
  pendingNotifications: [],
  badgeCount: 0,
  preferences: {
    newPosts: true,
    mentions: true,
    electionUpdates: true,
    adminAlerts: true,
    pushNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
  },
  joinedTopics: [],
};

// Reducer for state management
function realTimeReducer(state: RealTimeState, action: any): RealTimeState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.connected,
        connectionError: action.payload.error || null,
        socketId: action.payload.socketId || null,
      };

    case 'SET_CONNECTION_ATTEMPTS':
      return {
        ...state,
        connectionAttempts: action.payload,
      };

    case 'SET_PUSH_ENABLED':
      return {
        ...state,
        isPushEnabled: action.payload,
      };

    case 'SET_PENDING_NOTIFICATIONS':
      return {
        ...state,
        pendingNotifications: action.payload,
      };

    case 'SET_BADGE_COUNT':
      return {
        ...state,
        badgeCount: action.payload,
      };

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };

    case 'SET_JOINED_TOPICS':
      return {
        ...state,
        joinedTopics: action.payload,
      };

    case 'ADD_PENDING_NOTIFICATION':
      return {
        ...state,
        pendingNotifications: [...state.pendingNotifications, action.payload],
      };

    case 'REMOVE_PENDING_NOTIFICATION':
      return {
        ...state,
        pendingNotifications: state.pendingNotifications.filter(
          (notification) => notification.id !== action.payload
        ),
      };

    default:
      return state;
  }
}

// Create context
const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

// Real-time provider component
export function RealTimeProvider({children}: RealTimeProviderProps) {
  const [state, dispatch] = useReducer(realTimeReducer, initialState);

  // Load user preferences from AsyncStorage
  useEffect(() => {
    loadUserPreferences();
    loadPushNotificationStatus();
  }, []);

  // Set up app state listeners
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App became active, ensure WebSocket connection
        if (!state.isConnected) {
          webSocketService.connect();
        }
      } else if (nextAppState === 'background') {
        // App went to background
        // Could pause some notifications or adjust behavior
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, [state.isConnected]);

  // Set up WebSocket event listeners
  useEffect(() => {
    // Connection events
    const connectionChangeUnsub = webSocketService.onConnectionChange(
      (connected) => {
        dispatch({
          type: 'SET_CONNECTION_STATUS',
          payload: {
            connected,
            error: connected ? null : 'Connection lost',
            socketId: connected ? webSocketService.getConnectionStatus().socketId : null,
          },
        });

        if (connected) {
          dispatch({type: 'SET_CONNECTION_ATTEMPTS', payload: 0});
        }
      }
    );

    // Event listeners for different notification types
    const eventUnsubs: Array<() => void> = [];

    const events = [
      'new-post', 'post-liked', 'post-commented', 'mention',
      'election-update', 'admin-alert', 'push-notification', 'local-notification'
    ];

    events.forEach(event => {
      const unsub = webSocketService.on(event, (eventData) => {
        handleRealTimeEvent(event, eventData);
      });
      eventUnsubs.push(unsub);
    });

    return () => {
      connectionChangeUnsub();
      eventUnsubs.forEach(unsub => unsub());
    };
  }, []);

  // Real-time event handler
  const handleRealTimeEvent = (event: string, eventData: any) => {
    console.log(`Real-time event received: ${event}`, eventData);

    switch (event) {
      case 'new-post':
        handleNewPostEvent(eventData);
        break;
      case 'mention':
        handleMentionEvent(eventData);
        break;
      case 'election-update':
        handleElectionUpdateEvent(eventData);
        break;
      case 'admin-alert':
        handleAdminAlertEvent(eventData);
        break;
      case 'local-notification':
        handleLocalNotificationEvent(eventData);
        break;
    }

    // Add to pending notifications
    dispatch({
      type: 'ADD_PENDING_NOTIFICATION',
      payload: {
        id: Date.now().toString(),
        event,
        data: eventData,
        timestamp: new Date().toISOString(),
      },
    });
  };

  // Specific event handlers
  const handleNewPostEvent = (data: any) => {
    // Update posts feed
    // Show notification if preferences allow
    if (state.preferences.newPosts && state.isPushEnabled) {
      pushNotificationService.scheduleLocalNotification({
        title: 'New Post',
        body: data.author?.full_name || 'Someone',
        data,
        foreground: true,
      });
    }
  };

  const handleMentionEvent = (data: any) => {
    if (state.preferences.mentions && state.isPushEnabled) {
      pushNotificationService.scheduleLocalNotification({
        title: 'You were mentioned',
        body: data.author?.full_name || 'Someone',
        data,
        foreground: true,
      });
    }
  };

  const handleElectionUpdateEvent = (data: any) => {
    if (state.preferences.electionUpdates && state.isPushEnabled) {
      pushNotificationService.scheduleLocalNotification({
        title: 'Election Update',
        body: data.message,
        data,
        foreground: true,
      });
    }
  };

  const handleAdminAlertEvent = (data: any) => {
    if (state.preferences.adminAlerts && state.isPushEnabled) {
      pushNotificationService.scheduleLocalNotification({
        title: 'Admin Alert',
        body: data.alert?.message,
        data,
        foreground: true,
      });
    }
  };

  const handleLocalNotificationEvent = (data: any) => {
    // Handle locally generated notifications
    pushNotificationService.handleIncomingNotification(data);
  };

  // Context value
  const contextValue: RealTimeContextType = {
    state,

    // Connection management
    connect: async () => {
      return await webSocketService.connect();
    },

    disconnect: () => {
      webSocketService.disconnect();
    },

    reconnect: () => {
      webSocketService.disconnect();
      setTimeout(() => {
        webSocketService.connect();
      }, 1000);
    },

    // Notification management
    enablePushNotifications: async () => {
      const enabled = await pushNotificationService.areNotificationsEnabled();
      if (enabled) {
        await pushNotificationService.configurePushToken();
        dispatch({type: 'SET_PUSH_ENABLED', payload: true});
      }
      return enabled;
    },

    disablePushNotifications: () => {
      pushNotificationService.cancelAllLocalNotifications();
      dispatch({type: 'SET_PUSH_ENABLED', payload: false});
    },

    scheduleNotification: (notification: any) => {
      pushNotificationService.scheduleLocalNotification(notification);
    },

    cancelAllNotifications: () => {
      pushNotificationService.cancelAllLocalNotifications();
      dispatch({type: 'SET_PENDING_NOTIFICATIONS', payload: []});
    },

    // Topic management
    joinTopic: (topic: string) => {
      webSocketService.joinTopic(topic);
      if (!state.joinedTopics.includes(topic)) {
        dispatch({
          type: 'SET_JOINED_TOPICS',
          payload: [...state.joinedTopics, topic],
        });
      }
    },

    leaveTopic: (topic: string) => {
      webSocketService.leaveTopic(topic);
      dispatch({
        type: 'SET_JOINED_TOPICS',
        payload: state.joinedTopics.filter(t => t !== topic),
      });
    },

    // Preference management
    updatePreferences: (preferences: Partial<UserPreferences>) => {
      dispatch({type: 'UPDATE_PREFERENCES', payload: preferences});
      webSocketService.updatePreferences(preferences);
      saveUserPreferences(preferences);
    },

    // Event listeners
    on: (event: string, callback: (event: any) => void) => {
      return webSocketService.on(event, callback);
    },

    onConnectionChange: (callback: (connected: boolean) => void) => {
      return webSocketService.onConnectionChange(callback);
    },
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}

// Helper functions
async function loadUserPreferences(): Promise<void> {
  try {
    const savedPreferences = await AsyncStorage.getItem('realtime_preferences');
    if (savedPreferences) {
      const preferences = JSON.parse(savedPreferences);
      // Dispatch preferences update
      // This would need to be done through the context
    }
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
}

async function saveUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
  try {
    const savedPreferences = await AsyncStorage.getItem('realtime_preferences');
    const currentPreferences = savedPreferences ? JSON.parse(savedPreferences) : {};
    const updatedPreferences = {...currentPreferences, ...preferences};
    await AsyncStorage.setItem('realtime_preferences', JSON.stringify(updatedPreferences));
  } catch (error) {
    console.error('Error saving user preferences:', error);
  }
}

async function loadPushNotificationStatus(): Promise<void> {
  try {
    const enabled = await pushNotificationService.areNotificationsEnabled();
    // This would need to be done through the context
  } catch (error) {
    console.error('Error loading push notification status:', error);
  }
}

// Custom hook for using real-time features
export function useRealTime() {
  const context = useContext(RealTimeContext);

  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }

  return context;
}

export default RealTimeContext;
