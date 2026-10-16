// Push Notification Service for Real-time Updates and Native Notifications
// This service handles push notifications for both background and foreground app states

import {AsyncStorage} from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-push-notification/cjs/SIOSPushNotification';

// Configure push notifications
PushNotification.configure({
  onRegister: function (token) {
    console.log('PUSH TOKEN:', token);
    // Save device token to storage
    AsyncStorage.setItem('pushToken', token.token);
  },

  onNotification: function (notification) {
    console.log('PUSH NOTIFICATION RECEIVED:', notification);

    // Handle notification when app is in foreground
    if (Platform.OS === 'ios') {
      PushNotificationIOS.addNotificationListener((notification) => {
        console.log('iOS Push Notification:', notification);
        // Handle iOS push notification
      });
    }

    // Show local notification
    if (notification.data) {
      PushNotification.localNotification({
        title: notification.title || 'UniOsun Pulse',
        message: notification.message || notification.body,
        ...notification.data,
      });
    }
  },

  onAction: function (notification) {
    console.log('PUSH ACTION:', notification.action);
  },

  onRegistrationError: function (error) {
    console.error('PUSH REGISTRATION ERROR:', error);
  },

  permissions: {
    alert: true,
    badge: true,
    sound: true,
    criticalAlert: true,
    provisional: false,
    authorizationRequest: true,
  },

  popInitialNotification: true,
});

// Clear all notifications
PushNotification.clearAllNotifications();

export interface PushNotificationService {
  requestPermissions(): Promise<boolean>;
  scheduleLocalNotification(options: LocalNotificationOptions): void;
  cancelAllLocalNotifications(): void;
  getPendingNotifications(): Promise<LocalNotification[]>;
  setBadgeCount(count: number): void;
  getBadgeCount(): Promise<number>;
  configurePushToken(): Promise<void>;
  handleIncomingNotification(notification: any): void;
}

export interface LocalNotification {
  title: string;
  body: string;
  data?: any;
  date?: Date;
  scheduled?: boolean;
}

export interface LocalNotificationOptions extends LocalNotification {
  foreground?: boolean;
  alertAction?: string;
  categoryName?: string;
  userInfo?: any;
  propagate?: boolean;
  priority?: 'min' | 'low' | 'normal' | 'high' | 'max';
  playSound?: boolean;
  soundName?: string;
  lives?: boolean;
  ignoreInForeground?: boolean;
  repeatTime?: number;
  repeats?: boolean;
}

class PushNotificationServiceImpl implements PushNotificationService {
  private static instance: PushNotificationServiceImpl;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): PushNotificationServiceImpl {
    if (!PushNotificationServiceImpl.instance) {
      PushNotificationServiceImpl.instance = new PushNotificationServiceImpl();
    }
    return PushNotificationServiceImpl.instance;
  }

  // Request push notification permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        PushNotification.requestPermissions((permissionResult) => {
          resolve(permissionResult.alert || permissionResult.sound || permissionResult.badge || false);
        });
      });
    } else {
      // Android permissions are handled by the system
      return Promise.resolve(true);
    }
  }

  // Schedule a local notification
  scheduleLocalNotification(options: LocalNotificationOptions): void {
    const notificationOptions: any = {
      title: options.title,
      message: options.body,
      foreground: options.foreground ?? true,
      priority: options.priority ?? 'normal',
      playSound: options.playSound ?? true,
      soundName: options.soundName ?? 'default',
      repeatTime: options.repeatTime,
      repeats: options.repeats,
    };

    if (options.data) {
      notificationOptions.userInfo = options.data;
    }

    if (options.date) {
      notificationOptions.date = options.date.toISOString();
    }

    PushNotification.localNotification(notificationOptions);

    // Also schedule as scheduled notification if date is specified
    if (options.date) {
      PushNotification.localNotificationSchedule({
        title: options.title,
        message: options.body,
        date: options.date,
        repeatType: options.repeats ? 'day' : undefined,
        ...options.data,
      });
    }
  }

  // Cancel all local notifications
  cancelAllLocalNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  // Get pending notifications
  async getPendingNotifications(): Promise<LocalNotification[]> {
    return Promise.resolve([]); // Implementation depends on platform
  }

  // Set app badge count
  setBadgeCount(count: number): void {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  // Get current badge count
  async getBadgeCount(): Promise<number> {
    return Promise.resolve(0); // Implementation depends on platform
  }

  // Configure push token
  async configurePushToken(): Promise<void> {
    // The push notification configuration is already set up in the constructor
    // This method ensures the token is registered
    return Promise.resolve();
  }

  // Handle incoming push notification
  handleIncomingNotification(notification: any): void {
    console.log('Handling incoming push notification:', notification);

    // Process the notification based on its type
    switch (notification.type) {
      case 'new-post':
        this.handleNewPostNotification(notification);
        break;
      case 'mention':
        this.handleMentionNotification(notification);
        break;
      case 'election-update':
        this.handleElectionUpdateNotification(notification);
        break;
      case 'admin-alert':
        this.handleAdminAlertNotification(notification);
        break;
      default:
        this.handleGenericNotification(notification);
    }
  }

  // New post notification handler
  private handleNewPostNotification(notification: any): void {
    console.log('New post notification:', notification);
    // Update post feed
    // Show local notification
    this.scheduleLocalNotification({
      title: 'New Post',
      body: notification.author?.full_name || 'Someone',
      data: notification.data,
      foreground: true,
    });
  }

  // Mention notification handler
  private handleMentionNotification(notification: any): void {
    console.log('Mention notification:', notification);
    this.scheduleLocalNotification({
      title: 'You were mentioned',
      body: notification.author?.full_name || 'Someone',
      data: notification.data,
      foreground: true,
    });
  }

  // Election update notification handler
  private handleElectionUpdateNotification(notification: any): void {
    console.log('Election update notification:', notification);
    this.scheduleLocalNotification({
      title: 'Election Update',
      body: notification.message,
      data: notification.data,
      foreground: true,
    });
  }

  // Admin alert notification handler
  private handleAdminAlertNotification(notification: any): void {
    console.log('Admin alert notification:', notification);
    this.scheduleLocalNotification({
      title: 'Admin Alert',
      body: notification.alert?.message,
      data: notification.data,
      foreground: true,
    });
  }

  // Generic notification handler
  private handleGenericNotification(notification: any): void {
    console.log('Generic notification:', notification);
    this.scheduleLocalNotification({
      title: notification.title || 'UniOsun Pulse',
      body: notification.body,
      data: notification.data,
      foreground: true,
    });
  }

  // Cancel scheduled notification by ID
  cancelScheduledNotification(notificationId: string): void {
    // Implementation depends on platform
    console.log('Cancel scheduled notification:', notificationId);
  }

  // Check if notifications are enabled
  async areNotificationsEnabled(): Promise<boolean> {
    return this.requestPermissions();
  }
}

// Export singleton instance
const pushNotificationService = PushNotificationServiceImpl.getInstance();

export default pushNotificationService;

// Export types
export type { PushNotificationService, LocalNotification, LocalNotificationOptions };
