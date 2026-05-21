-- NOVACTORY NETWORK S.H.D.D. — Co-op Lobbies
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS coop_lobbies (
  world_code   TEXT PRIMARY KEY,
  host_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  world_seed   INTEGER NOT NULL,
  state        TEXT DEFAULT 'open' CHECK (state IN ('open','in_game','closed')),
  max_players  INTEGER DEFAULT 8,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coop_lobbies_host_idx ON coop_lobbies (host_id);

ALTER TABLE coop_lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lobbies are viewable by everyone" ON coop_lobbies FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create lobbies" ON coop_lobbies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Host can update own lobby" ON coop_lobbies FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Host can delete own lobby" ON coop_lobbies FOR DELETE USING (auth.uid() = host_id);

CREATE TABLE IF NOT EXISTS coop_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_code     TEXT NOT NULL REFERENCES coop_lobbies ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  username       TEXT NOT NULL,
  role           TEXT DEFAULT 'member' CHECK (role IN ('host','member')),
  joined_at      TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(world_code, user_id)
);

CREATE INDEX IF NOT EXISTS coop_members_world_idx ON coop_members (world_code);
CREATE INDEX IF NOT EXISTS coop_members_user_idx ON coop_members (user_id);

ALTER TABLE coop_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members are viewable by everyone" ON coop_members FOR SELECT USING (true);
CREATE POLICY "Users can join lobbies" ON coop_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own heartbeat" ON coop_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave lobbies" ON coop_members FOR DELETE USING (auth.uid() = user_id OR auth.uid() IN (SELECT host_id FROM coop_lobbies WHERE world_code = coop_members.world_code));
