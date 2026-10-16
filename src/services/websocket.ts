// WebSocket Client Implementation for Real-time Updates and Push Notifications
// This file handles WebSocket connections and real-time event processing for the React Native app

import {io, Socket} from 'socket.io-client';
import {AsyncStorage} from '@react-native-async-storage/async-storage';
import {APP_CONFIG} from '../config/app';

// WebSocket connection configuration
const SOCKET_URL = APP_CONFIG.WS_URL || 'https://UniOsunInfobackend.onrender.com';
const WEBSOCKET_TIMEOUT = 30000;

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealTimeEvent {
  type: 'new-post' | 'post-liked' | 'post-commented' | 'mention' | 'election-update' | 'admin-alert' | 'push-notification';
  data: any;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  // Event listeners
  private eventListeners: Map<string, Array<(event: RealTimeEvent) => void>> = new Map();
  private connectionListeners: Array<(connected: boolean) => void> = [];

  constructor() {
    this.initializeEventListeners();
  }

  // Initialize WebSocket connection
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.socket?.connected) {
      return true;
    }

    this.isConnecting = true;

    try {
      // Get authentication token
      const token = await AsyncStorage.getItem('UniOsunInfo.access_token');
      if (!token) {
        console.log('No authentication token available for WebSocket connection');
        this.isConnecting = false;
        return false;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: WEBSOCKET_TIMEOUT,
        forceNew: true,
        query: { clientType: 'react-native' },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect
      this.socket.connect();

      // Wait for connection
      await this.waitForConnection();

      this.connectionAttempts = 0;
      this.notifyConnectionStatus(true);
      console.log('WebSocket connected successfully');
      return true;

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
      this.notifyConnectionStatus(false);
      return false;
    }
  }

  // Wait for connection to be established
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (this.socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, WEBSOCKET_TIMEOUT);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Set up event handlers
  private setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connectionAttempts = 0;
      this.notifyConnectionStatus(true);
      this.emit('connection', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.notifyConnectionStatus(false);
      this.emit('connection', { connected: false, reason });

      if (reason === 'io server error' || this.connectionAttempts >= this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionAttempts++;
    });

    // Reconnection
    this.socket.on('reconnect', (attempt) => {
      console.log('WebSocket reconnected after', attempt, 'attempts');
      this.connectionAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('Reconnection attempt', attempt);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection attempts exhausted');
      this.notifyConnectionStatus(false);
    });

    // Pong response
    this.socket.on('pong', () => {
      // Heartbeat response
    });

    // Custom event handlers
    this.socket.onAny((event, ...args) => {
      console.log('WebSocket event received:', event, args);
      this.handleIncomingEvent(event, args[0]);
    });
  }

  // Handle incoming events
  private handleIncomingEvent(event: string, data: any) {
    const realTimeEvent: RealTimeEvent = {
      type: event as RealTimeEvent['type'],
      data,
      timestamp: new Date().toISOString(),
    };

    // Emit to all listeners
    this.emit(event, realTimeEvent);

    // Handle specific events
    switch (event) {
      case 'new-post':
        this.handleNewPost(realTimeEvent);
        break;
      case 'post-liked':
        this.handlePostLiked(realTimeEvent);
        break;
      case 'post-commented':
        this.handlePostCommented(realTimeEvent);
        break;
      case 'mention':
        this.handleMention(realTimeEvent);
        break;
      case 'election-update':
        this.handleElectionUpdate(realTimeEvent);
        break;
      case 'admin-alert':
        this.handleAdminAlert(realTimeEvent);
        break;
      case 'push-notification':
        this.handlePushNotification(realTimeEvent);
        break;
    }
  }

  // Event-specific handlers
  private handleNewPost(event: RealTimeEvent) {
    console.log('New post received:', event.data);
    this.emit('new-post', event);

    // Could trigger notification, update feed, etc.
    this.showPushNotification(event.data, {
      title: 'New Post',
      body: event.data.post.title || event.data.post.body?.substring(0, 100) + '...',
      data: { postId: event.data.post.id, authorId: event.data.author.id },
    });
  }

  private handlePostLiked(event: RealTimeEvent) {
    console.log('Post liked received:', event.data);
    this.emit('post-liked', event);

    this.showPushNotification(event.data, {
      title: 'Post Liked',
      body: `${event.data.likerName} liked your post`,
      data: { postId: event.data.post.id, userId: event.data.userId },
    });
  }

  private handlePostCommented(event: RealTimeEvent) {
    console.log('Post commented received:', event.data);
    this.emit('post-commented', event);

    this.showPushNotification(event.data, {
      title: 'New Comment',
      body: `${event.data.commenterName} commented on your post`,
      data: { postId: event.data.post.id, userId: event.data.commenterName },
    });
  }

  private handleMention(event: RealTimeEvent) {
    console.log('Mention received:', event.data);
    this.emit('mention', event);

    this.showPushNotification(event.data, {
      title: 'You were mentioned',
      body: event.data.post.title || 'Someone mentioned you in a post',
      data: { postId: event.data.post.id, authorId: event.data.author.id },
    });
  }

  private handleElectionUpdate(event: RealTimeEvent) {
    console.log('Election update received:', event.data);
    this.emit('election-update', event);

    this.showPushNotification(event.data, {
      title: 'Election Update',
      body: event.data.message,
      data: { electionId: event.data.election.id, type: event.data.updateType },
    });
  }

  private handleAdminAlert(event: RealTimeEvent) {
    console.log('Admin alert received:', event.data);
    this.emit('admin-alert', event);

    this.showPushNotification(event.data, {
      title: 'Admin Alert',
      body: event.data.alert.message,
      data: { alertId: event.data.alert.id },
    });
  }

  private handlePushNotification(event: RealTimeEvent) {
    console.log('Push notification received:', event.data);
    this.emit('push-notification', event);

    this.showPushNotification(event.data, event.data);
  }

  // Push notification handler (simplified - would integrate with actual push service)
  private showPushNotification(data: any, notification: any) {
    // In a real implementation, this would integrate with:
    // - React Native Push Notification (expo-notifications)
    // - Firebase Cloud Messaging
    // - APN (Apple Push Notification Service)

    console.log('Push notification:', notification);

    // For now, just emit the event for the UI to handle
    this.emit('local-notification', notification);
  }

  // Event listener management
  on(event: string, callback: (event: RealTimeEvent) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // Emit event to listeners
  private emit(event: string, eventData: RealTimeEvent) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Connection status listeners
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.push(callback);

    // Call immediately with current status
    callback(this.socket?.connected || false);

    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  private notifyConnectionStatus(connected: boolean) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  // Join topic room
  joinTopic(topic: string) {
    if (this.socket?.connected) {
      this.socket.emit('join-topic', topic);
      console.log('Joined topic room:', topic);
    }
  }

  // Leave topic room
  leaveTopic(topic: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave-topic', topic);
      console.log('Left topic room:', topic);
    }
  }

  // Update user preferences
  updatePreferences(preferences: any) {
    if (this.socket?.connected) {
      this.socket.emit('update-preferences', preferences);
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = false;
    this.notifyConnectionStatus(false);
  }

  // Schedule reconnection
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.connectionAttempts < this.maxReconnectAttempts) {
        console.log('Attempting to reconnect WebSocket...');
        this.connect();
      }
    }, this.reconnectInterval * Math.pow(2, this.connectionAttempts)); // Exponential backoff
  }

  // Initialize event listeners
  private initializeEventListeners() {
    // Ensure event listeners map is initialized
    if (!this.eventListeners) {
      this.eventListeners = new Map();
    }

    // Pre-populate common events
    const commonEvents = [
      'new-post', 'post-liked', 'post-commented', 'mention',
      'election-update', 'admin-alert', 'push-notification',
      'connection', 'local-notification'
    ];

    commonEvents.forEach(event => {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
    });
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.socket?.connected || false,
      connectionAttempts: this.connectionAttempts,
      socketId: this.socket?.id || null,
    };
  }

  // Send custom event
  sendEvent(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot send event:', event, '- WebSocket not connected');
    }
  }
}

// Export singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;

// Export types for use in other files
export type { WebSocketMessage, RealTimeEvent };
