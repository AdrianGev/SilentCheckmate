-- Migration script to fix matches table schema
-- This will ensure the table has the correct column names expected by the code

-- First, check if the table exists with old column names
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
    
    RAISE NOTICE 'Matches table schema updated successfully';
  ELSE
    RAISE NOTICE 'Matches table already has the correct schema';
  END IF;
END $$;
