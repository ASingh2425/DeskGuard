-- Migration 002: booking duration, waitlist, desk metadata
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 120;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS extended_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  desk_id UUID NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  UNIQUE(desk_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_desk ON waitlist(desk_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist(user_id);

ALTER TABLE desks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE desks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
