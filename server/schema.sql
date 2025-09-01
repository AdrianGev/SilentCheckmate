-- Database schema for SilentCheckmate

-- Users table: stores user information and ELO ratings
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens table: for token rotation & revocation
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Index for faster token lookups by user
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Match history table: records game results and ELO changes
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
