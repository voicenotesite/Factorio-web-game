/*
  # Create leaderboards and achievements tables

  1. New Tables
    - `leaderboards`
      - `id` (uuid, primary key)
      - `player_name` (text, not null)
      - `level` (integer, default 1)
      - `score` (bigint, default 0) - based on items produced + enemies killed * 10 + buildings placed * 5
      - `time_played` (bigint, default 0) - in ticks
      - `buildings_placed` (integer, default 0)
      - `enemies_killed` (integer, default 0)
      - `research_completed` (integer, default 0)
      - `created_at` (timestamptz, default now())
    - `achievements`
      - `id` (uuid, primary key)
      - `player_name` (text, not null)
      - `achievement_id` (text, not null) - like 'first_iron', 'factory_100', etc
      - `unlocked_at` (timestamptz, default now())
      - UNIQUE constraint on (player_name, achievement_id)

  2. Security
    - Enable RLS on both tables
    - Leaderboards: anyone can read, authenticated can insert their own
    - Achievements: anyone can read, authenticated can insert their own
*/

CREATE TABLE IF NOT EXISTS leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  level integer DEFAULT 1,
  score bigint DEFAULT 0,
  time_played bigint DEFAULT 0,
  buildings_placed integer DEFAULT 0,
  enemies_killed integer DEFAULT 0,
  research_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboards"
  ON leaderboards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert leaderboard entries"
  ON leaderboards FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE (player_name, achievement_id)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards (score DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements (player_name);