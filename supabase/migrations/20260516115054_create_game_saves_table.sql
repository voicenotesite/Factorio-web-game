/*
  # Create game saves table

  1. New Tables
    - `game_saves`
      - `id` (uuid, primary key)
      - `name` (text, save name)
      - `save_data` (jsonb, serialized game state)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `game_saves` table
    - Add policy for anyone to read/write saves (public game, no auth required)
*/

CREATE TABLE IF NOT EXISTS game_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled Save',
  save_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game saves"
  ON game_saves FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert game saves"
  ON game_saves FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete game saves"
  ON game_saves FOR DELETE
  TO anon, authenticated
  USING (true);
