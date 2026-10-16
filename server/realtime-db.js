// Database schema setup for real-time features
async function setupRealtimeDatabase(pool) {
  try {
    // Create user devices table for push notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_token TEXT NOT NULL,
        device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
        push_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create real-time event logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL, -- 'new-post', 'mention', 'election-update', 'admin-alert'
        user_id UUID REFERENCES users(id),
        target_id UUID, -- post_id, election_id, etc.
        target_type VARCHAR(20), -- 'post', 'election', 'user'
        metadata JSONB,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    // Create indexes for real-time queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_realtime_events_user_id ON realtime_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_realtime_events_event_type ON realtime_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at);
    `);

    console.log('Real-time database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing real-time database schema:', error);
  }
}

// Log real-time events
async function logRealtimeEvent(pool, eventType, userId, targetId, targetType, metadata) {
  try {
    await pool.query(
      `INSERT INTO realtime_events (event_type, user_id, target_id, target_type, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, userId, targetId, targetType, metadata],
    );
  } catch (error) {
    console.error('Error logging real-time event:', error);
  }
}

module.exports = {
  setupRealtimeDatabase,
  logRealtimeEvent,
};