// WebSocket Configuration and Real-time Infrastructure

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

// Initialize WebSocket server for real-time updates
function setupWebSocketServer(server, pool) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // User sessions tracking
  const userSockets = new Map(); // userId -> socketId
  const socketUsers = new Map(); // socketId -> userId

  // Authentication middleware for WebSocket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const {rows} = await pool.query(
        `SELECT id, email, full_name, role FROM users WHERE id = $1`,
        [claims.sub],
      );

      if (rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.userId = rows[0].id;
      socket.userEmail = rows[0].email;
      socket.userRole = rows[0].role;
      socket.userFullName = rows[0].full_name;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Handle connection establishment
  io.on('connection', async (socket) => {
    console.log(`WebSocket connected: ${socket.userId} (${socket.id})`);

    // Store user-socket mapping
    userSockets.set(socket.userId, socket.id);
    socketUsers.set(socket.id, socket.userId);

    // Join user-specific room for personalized updates
    socket.join(`user:${socket.userId}`);

    // Join topic rooms for interest-based updates
    socket.on('join-topic', async (topic) => {
      const topicRoom = `topic:${topic}`;
      socket.join(topicRoom);
      console.log(`User ${socket.userId} joined topic room: ${topicRoom}`);
    });

    socket.on('leave-topic', (topic) => {
      const topicRoom = `topic:${topic}`;
      socket.leave(topicRoom);
      console.log(`User ${socket.userId} left topic room: ${topicRoom}`);
    });

    // Handle heartbeat/ping
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`WebSocket disconnected: ${socket.userId} (${socket.id}) - ${reason}`);

      // Clean up mappings
      userSockets.delete(socket.userId);
      socketUsers.delete(socket.id);
    });
  });

  // Broadcast functions for real-time events
  const broadcast = {
    // New post created
    newPost: async (post, author) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM follows WHERE following_id = $1 AND user_id IN (
            SELECT id FROM users WHERE role = 'student' AND email_verified = true
          )`,
          [author.id],
        );

        // Notify followers
        const followerIds = rows.map(row => row.user_id);
        followerIds.forEach(userId => {
          const room = `user:${userId}`;
          io.to(room).emit('new-post', {
            post,
            author,
            timestamp: new Date().toISOString(),
          });
        });

        // Broadcast to topic rooms
        if (post.tag) {
          const topicRoom = `topic:${post.tag}`;
          io.to(topicRoom).emit('new-post', {
            post,
            author,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error broadcasting new post:', error);
      }
    },

    // Post liked
    postLiked: async (post, userId, likerName) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM posts WHERE id = $1`,
          [post.id],
        );
        const authorId = rows[0]?.user_id;

        if (authorId !== userId) {
          const room = `user:${authorId}`;
          io.to(room).emit('post-liked', {
            post,
            likerName,
            userId,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error broadcasting post like:', error);
      }
    },

    // Post commented
    postCommented: async (post, comment, commenterName) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM posts WHERE id = $1`,
          [post.id],
        );
        const authorId = rows[0]?.user_id;

        if (authorId !== commenterName) {
          const room = `user:${authorId}`;
          io.to(room).emit('post-commented', {
            post,
            comment,
            commenterName,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error broadcasting post comment:', error);
      }
    },

    // Mention notification
    mention: async (post, author, mentionedUserId, mentionedUserName) => {
      try {
        const room = `user:${mentionedUserId}`;
        io.to(room).emit('mention', {
          post,
          author,
          mentionedUserId,
          mentionedUserName,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error broadcasting mention:', error);
      }
    },

    // Election update
    electionUpdated: async (election, updateType, message) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM profiles JOIN users ON profiles.user_id = users.id 
           WHERE (users.role = 'student' OR users.role = 'admin') AND users.email_verified = true`,
        );

        const userIds = rows.map(row => row.user_id);

        userIds.forEach(userId => {
          const room = `user:${userId}`;
          io.to(room).emit('election-update', {
            election,
            updateType,
            message,
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error('Error broadcasting election update:', error);
      }
    },

    // Admin alert
    adminAlert: async (alert) => {
      try {
        const {rows} = await pool.query(
          `SELECT user_id FROM profiles JOIN users ON profiles.user_id = users.id WHERE users.role = 'admin'`,
        );

        rows.forEach(row => {
          const room = `user:${row.user_id}`;
          io.to(room).emit('admin-alert', {
            alert,
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error('Error broadcasting admin alert:', error);
      }
    },

    // Push notification for mobile
    pushNotification: async (userId, notification) => {
      try {
        const room = `user:${userId}`;
        io.to(room).emit('push-notification', {
          ...notification,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    },
  };

  return { io, broadcast, userSockets, socketUsers };
}

// Push notification service (Firebase/Expo compatible)
class PushNotificationService {
  constructor(pool) {
    this.pool = pool;
    this.emailTransporter = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD}
        : undefined,
    });
  }

  async sendEmailNotification(to, subject, text, html) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Email notification sent to ${to}: ${subject}`);
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  async sendPushToDevices(userIds, notification) {
    try {
      // Get device tokens from database
      const {rows} = await pool.query(
        `SELECT device_token, device_type FROM user_devices 
         WHERE user_id = ANY($1::uuid[]) AND push_enabled = true`,
        [userIds],
      );

      if (rows.length > 0 && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        await this.sendToFirebase(rows, notification);
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }

  async sendToFirebase(devices, notification) {
    // Placeholder for Firebase/Expo integration
    // In production, you would integrate with Firebase Cloud Messaging or Expo Push Service
    console.log('Firebase push notification would be sent:', {
      devices: devices.length,
      notification,
    });
  }
}

module.exports = {
  setupWebSocketServer,
};