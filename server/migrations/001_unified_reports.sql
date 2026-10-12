-- Unified reports table to replace reported_posts, reported_comments, reported_marketplace_listings
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL
    CHECK (content_type IN ('post', 'comment', 'marketplace')),
  content_id text NOT NULL,
  reporter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_name text,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'actioned', 'dismissed')),
  action_taken text,
  resolved_by text REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraints based on content_type
ALTER TABLE reports
  ADD CONSTRAINT fk_reports_post
  FOREIGN KEY (content_id) REFERENCES posts(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE reports
  ADD CONSTRAINT fk_reports_comment
  FOREIGN KEY (content_id) REFERENCES comments(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE reports
  ADD CONSTRAINT fk_reports_marketplace
  FOREIGN KEY (content_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Partial unique indexes to prevent duplicate reports per user per content
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_post_unique
  ON reports (content_id, reporter_id)
  WHERE content_type = 'post';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_comment_unique
  ON reports (content_id, reporter_id)
  WHERE content_type = 'comment';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_marketplace_unique
  ON reports (content_id, reporter_id)
  WHERE content_type = 'marketplace';

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_content
  ON reports (content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
  ON reports (reporter_id, created_at DESC);