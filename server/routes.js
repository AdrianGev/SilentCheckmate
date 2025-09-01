// API routes for authentication and ELO rating management
import { Router } from 'express';
import { z } from 'zod';
import { query } from './db.js';
import { 
  argon2, 
  signAccessToken, 
  signRefreshToken, 
  sha256, 
  setAuthCookies, 
  requireAuth,
  jwt 
} from './auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({ 
  username: z.string(), 
  password: z.string() 
});

const eloSchema = z.object({ 
  delta: z.number().int().min(-1000).max(1000) 
});

const matchResultSchema = z.object({
  opponentId: z.number().int().positive(),
  result: z.enum(['win', 'loss', 'draw']),
  pgn: z.string().optional()
});

// Register a new user
router.post('/auth/register', async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { username, email, password } = parse.data;
  
  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    
    const rows = await query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, elo`,
      [username, email ?? null, hash]
    );
    
    const user = rows[0];
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash) 
       VALUES ($1, $2)`,
      [user.id, sha256(refreshToken)]
    );
    
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ id: user.id, username: user.username, elo: user.elo });
  } catch (error) {
    if (String(error.message).includes('duplicate')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login an existing user
router.post('/auth/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { username, password } = parse.data;
  
  try {
    const rows = await query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );
    
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash) 
       VALUES ($1, $2)`,
      [user.id, sha256(refreshToken)]
    );
    
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ id: user.id, username: user.username, elo: user.elo });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Refresh access token
router.post('/auth/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.REFRESH_SECRET);
    
    const match = await query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
      [payload.sub, sha256(token)]
    );
    
    if (!match[0]) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const [user] = await query(
      `SELECT id, username, elo FROM users WHERE id = $1`,
      [payload.sub]
    );
    
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Rotate tokens: revoke old, store new
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [match[0].id]
    );
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash) 
       VALUES ($1, $2)`,
      [user.id, sha256(refreshToken)]
    );

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ ok: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/auth/logout', async (req, res) => {
  const token = req.cookies?.refresh_token;
  
  if (token) {
    try {
      await query(
        `UPDATE refresh_tokens SET revoked_at = NOW() 
         WHERE token_hash = $1`,
        [sha256(token)]
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ ok: true });
});

// Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await query(
      `SELECT id, username, elo, created_at 
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    
    res.json(user);
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({ error: 'Server error retrieving user info' });
  }
});

// Update user's ELO rating manually (for testing)
router.post('/elo/update', requireAuth, async (req, res) => {
  const parse = eloSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  
  const { delta } = parse.data;
  
  try {
    const rows = await query(
      `UPDATE users 
       SET elo = GREATEST(0, elo + $1), updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, username, elo`,
      [delta, req.user.sub]
    );
    
    res.json(rows[0]);
  } catch (error) {
    console.error('ELO update error:', error);
    res.status(500).json({ error: 'Server error updating ELO rating' });
  }
});

// Record a match result and update ELO ratings
router.post('/matches', requireAuth, async (req, res) => {
  const parse = matchResultSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  
  const { opponentId, result, pgn } = parse.data;
  const userId = req.user.sub;
  
  // Don't allow matches against yourself
  if (userId === opponentId) {
    return res.status(400).json({ error: 'Cannot play against yourself' });
  }
  
  try {
    // Start a transaction
    await query('BEGIN');
    
    // Get current ELO ratings
    const [currentUser] = await query(
      'SELECT id, username, elo FROM users WHERE id = $1',
      [userId]
    );
    
    const [opponent] = await query(
      'SELECT id, username, elo FROM users WHERE id = $1',
      [opponentId]
    );
    
    if (!opponent) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Opponent not found' });
    }
    
    // Calculate ELO changes
    const { userEloChange, opponentEloChange } = calculateEloChanges(
      currentUser.elo,
      opponent.elo,
      result
    );
    
    // Determine match result format for database
    let dbResult;
    let winnerId = null;
    
    if (result === 'win') {
      dbResult = 'white_win';
      winnerId = userId;
    } else if (result === 'loss') {
      dbResult = 'black_win';
      winnerId = opponentId;
    } else {
      dbResult = 'draw';
    }
    
    // Record the match
    await query(
      `INSERT INTO matches 
       (white_player_id, black_player_id, winner_id, result, 
        white_elo_before, black_elo_before, 
        white_elo_change, black_elo_change, game_pgn) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId, opponentId, winnerId, dbResult,
        currentUser.elo, opponent.elo,
        userEloChange, opponentEloChange,
        pgn || null
      ]
    );
    
    // Update user ELO ratings
    await query(
      'UPDATE users SET elo = GREATEST(0, elo + $1), updated_at = NOW() WHERE id = $2',
      [userEloChange, userId]
    );
    
    await query(
      'UPDATE users SET elo = GREATEST(0, elo + $1), updated_at = NOW() WHERE id = $2',
      [opponentEloChange, opponentId]
    );
    
    // Get updated user info
    const [updatedUser] = await query(
      'SELECT id, username, elo FROM users WHERE id = $1',
      [userId]
    );
    
    // Commit the transaction
    await query('COMMIT');
    
    res.json({
      match: {
        result,
        eloChange: userEloChange,
        newElo: updatedUser.elo
      }
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Match recording error:', error);
    res.status(500).json({ error: 'Server error recording match result' });
  }
});

// Get user's match history
router.get('/matches/history', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    const matches = await query(
      `SELECT m.*,
        w.username as white_username,
        b.username as black_username
       FROM matches m
       JOIN users w ON m.white_player_id = w.id
       JOIN users b ON m.black_player_id = b.id
       WHERE m.white_player_id = $1 OR m.black_player_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    const formattedMatches = matches.map(match => {
      const isWhite = match.white_player_id === userId;
      const opponent = isWhite ? match.black_username : match.white_username;
      const eloChange = isWhite ? match.white_elo_change : match.black_elo_change;
      let result;
      
      if (match.result === 'draw') {
        result = 'draw';
      } else if (
        (match.result === 'white_win' && isWhite) ||
        (match.result === 'black_win' && !isWhite)
      ) {
        result = 'win';
      } else {
        result = 'loss';
      }
      
      return {
        id: match.id,
        opponent,
        result,
        eloChange,
        date: match.created_at
      };
    });
    
    res.json(formattedMatches);
  } catch (error) {
    console.error('Match history error:', error);
    res.status(500).json({ error: 'Server error retrieving match history' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const leaderboard = await query(
      `SELECT id, username, elo
       FROM users
       ORDER BY elo DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error retrieving leaderboard' });
  }
});

// Helper function to calculate ELO changes
function calculateEloChanges(userElo, opponentElo, result) {
  const K = 32; // K-factor
  
  // Calculate expected scores
  const expectedUserScore = 1 / (1 + Math.pow(10, (opponentElo - userElo) / 400));
  const expectedOpponentScore = 1 / (1 + Math.pow(10, (userElo - opponentElo) / 400));
  
  // Calculate actual scores
  let actualUserScore, actualOpponentScore;
  
  if (result === 'win') {
    actualUserScore = 1;
    actualOpponentScore = 0;
  } else if (result === 'loss') {
    actualUserScore = 0;
    actualOpponentScore = 1;
  } else { // draw
    actualUserScore = 0.5;
    actualOpponentScore = 0.5;
  }
  
  // Calculate ELO changes
  const userEloChange = Math.round(K * (actualUserScore - expectedUserScore));
  const opponentEloChange = Math.round(K * (actualOpponentScore - expectedOpponentScore));
  
  return { userEloChange, opponentEloChange };
}

export default router;
