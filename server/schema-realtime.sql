-- Database schema for real-time updates and push notifications
-- This schema extends the base UniOsunPulse database schema
-- NOTE: user_id columns assume users.id is TEXT. Change if yours differs.

-- Optional: clean up any partially created tables from the failed run
DROP TABLE IF EXISTS notification_delivery CASCADE;
DROP TABLE IF EXISTS realtime_event_queue CASCADE;
DROP TABLE IF EXISTS topic_subscriptions CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS realtime_events CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;

-- User devices table for push notifications
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  push_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- Real-time event logs table
CREATE TABLE IF NOT EXISTS realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'new-post', 'mention', 'election-update', 'admin-alert'
  user_id text REFERENCES users(id),
  target_id TEXT, -- post_id, election_id, etc. (TEXT so it works with any ID type)
  target_type VARCHAR(20), -- 'post', 'election', 'user'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes for real-time queries
CREATE INDEX IF NOT EXISTS idx_realtime_events_user_id ON realtime_events(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_event_type ON realtime_events(event_type);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at);

-- User preferences table for notification preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_posts BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  election_updates BOOLEAN DEFAULT true,
  admin_alerts BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Topic subscriptions table
CREATE TABLE IF NOT EXISTS topic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(50) NOT NULL, -- 'ACADEMIC', 'CAMPUS LIFE', etc.
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_topic_unique ON topic_subscriptions(user_id, topic);

-- Real-time event queue for processing
CREATE TABLE IF NOT EXISTS realtime_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  priority INTEGER DEFAULT 0, -- 0 = normal, 1 = high, 2 = urgent
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_realtime_event_queue_processed ON realtime_event_queue(processed);
CREATE INDEX IF NOT EXISTS idx_realtime_event_queue_priority ON realtime_event_queue(priority, created_at);

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES realtime_events(id),
  user_id text REFERENCES users(id),
  delivery_type VARCHAR(20) NOT NULL, -- 'websocket', 'push', 'email'
  delivered_at TIMESTAMP DEFAULT now(),
  delivered_successfully BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Indexes for notification delivery
CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_id ON notification_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_event_id ON notification_delivery(event_id);

-- Table documentation
COMMENT ON TABLE user_devices IS 'Stores device tokens for push notifications';
COMMENT ON TABLE realtime_events IS 'Logs all real-time events for auditing and analytics';
COMMENT ON TABLE user_preferences IS 'User notification preferences and settings';
COMMENT ON TABLE topic_subscriptions IS 'User subscriptions to specific topics for interest-based notifications';
COMMENT ON TABLE realtime_event_queue IS 'Queue for processing real-time events asynchronously';
COMMENT ON TABLE notification_delivery IS 'Tracks delivery of notifications to users';