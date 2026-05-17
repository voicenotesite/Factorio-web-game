-- ============================================================
-- NOVACTORIO — Supabase Schema (Nano-optimized)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles (lower(username));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  user_username TEXT NOT NULL,
  friend_username TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_user_idx ON friendships (user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships (friend_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their friendships" ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update friendships they received" ON friendships FOR UPDATE
  USING (auth.uid() = friend_id);
CREATE POLICY "Users can delete their friendships" ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Chat messages table (max 200 chars enforced at DB level)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  username TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can chat" ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Auto-cleanup: keep only the last 300 messages to save storage on Nano
CREATE OR REPLACE FUNCTION cleanup_old_chat()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE id IN (
    SELECT id FROM chat_messages
    ORDER BY created_at DESC
    OFFSET 300
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_cleanup ON chat_messages;
CREATE TRIGGER chat_cleanup
  AFTER INSERT ON chat_messages
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_chat();

-- Rate-limit: max 1 message per 2 seconds per user (prevents spam/flood)
CREATE OR REPLACE FUNCTION check_chat_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM chat_messages
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '2 seconds'
  ) THEN
    RAISE EXCEPTION 'rate_limit: too fast';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_rate_limit ON chat_messages;
CREATE TRIGGER chat_rate_limit
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION check_chat_rate_limit();

-- World snapshots (minimal — only metadata, no game state)
CREATE TABLE IF NOT EXISTS world_snapshots (
  user_id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  tick INTEGER NOT NULL DEFAULT 0,
  building_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE world_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "World snapshots are public" ON world_snapshots FOR SELECT USING (true);
CREATE POLICY "Users can upsert own snapshot" ON world_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTE: Chat uses Realtime BROADCAST (not postgres_changes) — no WAL overhead!
-- No need to add chat_messages to supabase_realtime publication.
-- Broadcast is pure pub/sub and doesn't touch the WAL decoder at all.
-- This is critical for Nano tier with limited CPU/RAM.

-- Add world_data column for co-op world visiting (run if not exists)
ALTER TABLE world_snapshots ADD COLUMN IF NOT EXISTS world_data TEXT;

