// Real-time Updates and Push Notifications Infrastructure

const {Server} = require('socket.io');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Initialize Socket.IO for real-time updates
function setupSocketIO(app, pool) {
  const io = new Server(app, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Store connected users for push notifications
  const connectedUsers = new Map();
  const userChannels = new Map();

  // Initialize notification service
  const notificationService = new PushNotificationService(pool);

  // Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const {rows} = await pool.query(
        'SELECT id, email, full_name, role FROM users WHERE id = $1',
        [claims.sub],
      );

      if (rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = rows[0];
      socket.userId = rows[0].id;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Handle socket connections
  io.on('connection', async socket => {
    console.log(`Socket connected: ${socket.userId} (${socket.id})`);

    // Join user-specific channel for personalized updates
    const userChannel = `user:${socket.userId}`;
    socket.join(userChannel);
    connectedUsers.set(socket.id, socket.userId);

    // Store user's notification preferences
    userChannels.set(socket.userId, {
      socketId: socket.id,
      channel: userChannel,
      notifications: {
        newPosts: true,
        mentions: true,
        electionUpdates: true,
        adminAlerts: true,
      },
    });

    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });

    // Handle reconnection
    socket.on('reconnect', () => {
      console.log(`Socket reconnected: ${socket.userId} (${socket.id})`);
      socket.join(userChannel);
    });

    // Handle disconnection
    socket.on('disconnect', reason => {
      console.log(
        `Socket disconnected: ${socket.userId} (${socket.id}) - ${reason}`,
      );
      connectedUsers.delete(socket.id);
    });

    // Handle user preference updates
    socket.on('update-preferences', preferences => {
      if (userChannels.has(socket.userId)) {
        const userChannelData = userChannels.get(socket.userId);
        userChannelData.notifications = {
          ...userChannelData.notifications,
          ...preferences,
        };
        userChannels.set(socket.userId, userChannelData);
      }
    });

    // Join specific topic channels for interest-based updates
    socket.on('join-topic', topic => {
      const topicChannel = `topic:${topic}`;
      socket.join(topicChannel);
    });

    socket.on('leave-topic', topic => {
      const topicChannel = `topic:${topic}`;
      socket.leave(topicChannel);
    });
  });

  // Broadcast functions for real-time updates
  const broadcast = {
    // New post notification
    newPost: async (post, author) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM follows WHERE following_id = $1 AND user_id IN (
            SELECT id FROM users WHERE role = 'student' AND email_verified = true
          )`,
          [author.id],
        );

        const followerIds = rows.map(row => row.user_id);

        // Send real-time updates to followers
        followerIds.forEach(userId => {
          const channel = `user:${userId}`;
          io.to(channel).emit('new-post', {
            post,
            author,
            timestamp: new Date().toISOString(),
          });
        });

        // Send push notifications to mobile apps
        await notificationService.sendPushNotifications(
          'new-post',
          followerIds,
          {
            title: 'New Post from @' + author.full_name,
            body: post.title || post.body?.substring(0, 100) + '...',
            data: {postId: post.id, authorId: author.id},
          },
        );
      } catch (error) {
        console.error('Error broadcasting new post:', error);
      }
    },

    // Post mention notification
    mention: async (post, author, mentionUserId) => {
      try {
        const mentionedUserChannel = `user:${mentionUserId}`;
        io.to(mentionedUserChannel).emit('mention', {
          post,
          author,
          mentionUserId,
          timestamp: new Date().toISOString(),
        });

        await notificationService.sendPushNotifications(
          'mention',
          [mentionUserId],
          {
            title: 'You were mentioned in a post',
            body: post.title || post.body?.substring(0, 100) + '...',
            data: {postId: post.id, authorId: author.id},
          },
        );
      } catch (error) {
        console.error('Error broadcasting mention:', error);
      }
    },

    // Election update notification
    electionUpdate: async (election, updateType, message) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM profiles JOIN users ON profiles.user_id = users.id 
           WHERE (users.role = 'student' OR users.role = 'admin') AND users.email_verified = true`,
        );

        const userIds = rows.map(row => row.user_id);

        userIds.forEach(userId => {
          const channel = `user:${userId}`;
          io.to(channel).emit('election-update', {
            election,
            updateType,
            message,
            timestamp: new Date().toISOString(),
          });
        });

        await notificationService.sendPushNotifications(
          'election-update',
          userIds,
          {
            title: 'Election Update',
            body: message,
            data: {electionId: election.id, type: updateType},
          },
        );
      } catch (error) {
        console.error('Error broadcasting election update:', error);
      }
    },

    // Admin alert notification
    adminAlert: async alert => {
      try {
        // Send to all admins
        const {rows} = await pool.query(
          "SELECT user_id FROM profiles JOIN users ON profiles.user_id = users.id WHERE users.role = 'admin'",
        );

        rows.forEach(row => {
          const channel = `user:${row.user_id}`;
          io.to(channel).emit('admin-alert', {
            alert,
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error('Error broadcasting admin alert:', error);
      }
    },
  };

  return {io, connectedUsers, broadcast, userChannels, notificationService};
}

// Push notification service (Firebase/Expo compatible)
class PushNotificationService {
  constructor(pool) {
    this.pool = pool;
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD}
        : undefined,
    });
  }

  async sendPushNotifications(type, userIds, notification) {
    try {
      // Get user device tokens from database
      await this.pool.query(
        'SELECT device_token, push_enabled FROM user_devices WHERE user_id = ANY($1::uuid[]) AND push_enabled = true',
        [userIds],
      );

      // Send email notifications as fallback
      await this.sendEmailNotification(type, notification);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }

  async sendEmailNotification(type, notification) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: process.env.SMTP_NOTIFICATIONS_EMAIL,
        subject: `UniOsun Pulse - ${notification.title}`,
        text: `${notification.body}\n\nData: ${JSON.stringify(
          notification.data,
        )}`,
        html: `<h2>${notification.title}</h2><p>${
          notification.body
        }</p><pre>${JSON.stringify(notification.data, null, 2)}</pre>`,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log('Email notification sent:', mailOptions.subject);
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }
}

module.exports = {
  setupSocketIO,
};
