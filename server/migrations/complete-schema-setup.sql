-- Complete schema setup script for SilentCheckmate
-- Run this in Neon's SQL editor to ensure all tables match the code's expectations

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Matches table with all required columns
CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  white_player_id BIGINT NOT NULL REFERENCES users(id),
  black_player_id BIGINT NOT NULL REFERENCES users(id),
  winner_id BIGINT REFERENCES users(id),
  result TEXT NOT NULL CHECK (result IN ('white_win', 'black_win', 'draw')),
  white_elo_before INTEGER NOT NULL,
  black_elo_before INTEGER NOT NULL,
  white_elo_change INTEGER NOT NULL,
  black_elo_change INTEGER NOT NULL,
  game_pgn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for match history lookups
CREATE INDEX IF NOT EXISTS idx_matches_white_player ON matches(white_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_black_player ON matches(black_player_id);

-- Migration to fix any column name mismatches
DO $$
BEGIN
  -- Check if white_id exists (indicating old schema)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'white_id'
  ) THEN
    -- Rename columns from old schema to match code expectations
    ALTER TABLE matches
      RENAME COLUMN white_id TO white_player_id;
      
    ALTER TABLE matches
      RENAME COLUMN black_id TO black_player_id;
  END IF;
  
  -- Add missing columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'winner_id'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN winner_id BIGINT REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'white_elo_before'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN white_elo_before INTEGER NOT NULL DEFAULT 1200;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'black_elo_before'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN black_elo_before INTEGER NOT NULL DEFAULT 1200;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'white_elo_change'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN white_elo_change INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'black_elo_change'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN black_elo_change INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'game_pgn'
  ) THEN
    ALTER TABLE matches
      ADD COLUMN game_pgn TEXT;
  END IF;
END $$;
