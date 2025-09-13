require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { Chess } = require('chess.js');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

// --- middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss:", "https://silentcheckmate.onrender.com"],
    },
  },
}));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://silentcheckmate.onrender.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));

// --- db ---
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1); // only exit on failure
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check and DB test endpoints
app.get('/health', (_req, res) => res.send('ok'));
app.get('/dbtest', async (_req, res) => {
  try {
    const { rows } = await pool.query('select now() as ts');
    res.json({ ok: true, ts: rows[0].ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API routes
app.use('/api', apiRoutes);

// Root route redirects to chess client
app.get('/', (req, res) => {
  res.redirect('/chess-client.html');
});

// WebSocket server setup
const wss = new WebSocketServer({ server });

// Game state storage
const games = {};
const playerGames = {};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  let playerId = null;
  let gameId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // Handle both message formats (type and t)
      const messageType = data.type || data.t;
      console.log('Received:', messageType);

      switch (messageType) {
        case 'LOGIN':
          handleLogin(ws, data);
          break;
        case 'CREATE_GAME':
          handleCreateGame(ws, data);
          break;
        case 'JOIN_GAME':
          handleJoinGame(ws, data);
          break;
        case 'MAKE_MOVE':
          handleMakeMove(ws, data);
          break;
        case 'RESIGN':
          handleResign(ws, data);
          break;
        case 'OFFER_DRAW':
          handleDrawOffer(ws, data);
          break;
        case 'ACCEPT_DRAW':
          handleAcceptDraw(ws, data);
          break;
        case 'DECLINE_DRAW':
          handleDeclineDraw(ws, data);
          break;
        case 'JOIN':
          // Handle JOIN message for existing game
          if (data.gameId) {
            gameId = data.gameId;
            console.log(`Player ${playerId} joining game room ${gameId}`);
          }
          break;
        case 'PING':
          // Handle ping message (keep-alive)
          ws.send(JSON.stringify({ t: 'PONG' }));
          break;
        case 'MOVE':
          // Handle move in new format
          if (data.gameId && data.from && data.to) {
            handleMakeMove(ws, {
              type: 'MAKE_MOVE',
              payload: {
                gameId: data.gameId,
                from: data.from,
                to: data.to,
                promotion: data.promo
              }
            });
          }
          break;
        default:
          console.log('Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Handle player disconnection
    if (playerId && gameId && games[gameId]) {
      // Mark player as disconnected but keep the game state
      if (games[gameId].white === playerId) {
        games[gameId].whiteConnected = false;
      } else if (games[gameId].black === playerId) {
        games[gameId].blackConnected = false;
      }
    }
  });

  // Handler functions
  function handleLogin(ws, data) {
    playerId = data.username || `Player_${uuidv4().substring(0, 8)}`;
    ws.playerId = playerId;
    console.log(`Player logged in: ${playerId}`);
    
    ws.send(JSON.stringify({
      type: 'LOGIN_SUCCESS',
      playerId: playerId
    }));
  }

  function handleCreateGame(ws, data) {
    if (!playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'You must log in first'
      }));
      return;
    }

    gameId = uuidv4();
    const chess = new Chess();
    
    games[gameId] = {
      id: gameId,
      white: playerId,
      whiteConnected: true,
      black: null,
      blackConnected: false,
      chess: chess,
      status: 'waiting',
      drawOffer: null,
      moves: []
    };
    
    playerGames[playerId] = gameId;
    
    ws.send(JSON.stringify({
      type: 'GAME_CREATED',
      gameId: gameId,
      color: 'white',
      fen: chess.fen()
    }));
    
    console.log(`Game created: ${gameId} by ${playerId}`);
  }

  function handleJoinGame(ws, data) {
    if (!playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'You must log in first'
      }));
      return;
    }

    const joinGameId = data.gameId;
    
    if (!games[joinGameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Game not found'
      }));
      return;
    }
    
    if (games[joinGameId].status !== 'waiting') {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Game already in progress'
      }));
      return;
    }
    
    if (games[joinGameId].white === playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'You cannot join your own game'
      }));
      return;
    }
    
    gameId = joinGameId;
    games[gameId].black = playerId;
    games[gameId].blackConnected = true;
    games[gameId].status = 'playing';
    playerGames[playerId] = gameId;
    
    // Notify both players that the game has started
    ws.send(JSON.stringify({
      type: 'GAME_JOINED',
      gameId: gameId,
      color: 'black',
      opponent: games[gameId].white,
      fen: games[gameId].chess.fen()
    }));
    
    // Find the white player's connection and notify them
    wss.clients.forEach((client) => {
      if (client.playerId === games[gameId].white) {
        client.send(JSON.stringify({
          type: 'OPPONENT_JOINED',
          gameId: gameId,
          opponent: playerId,
          fen: games[gameId].chess.fen()
        }));
      }
    });
    
    console.log(`Player ${playerId} joined game ${gameId}`);
  }

  function handleMakeMove(ws, data) {
    if (!playerId || !gameId || !games[gameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid game state'
      }));
      return;
    }
    
    const game = games[gameId];
    
    // Check if it's the player's turn
    const isWhite = game.chess.turn() === 'w';
    if ((isWhite && game.white !== playerId) || (!isWhite && game.black !== playerId)) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Not your turn'
      }));
      return;
    }
    
    try {
      // Attempt to make the move
      const move = game.chess.move({
        from: data.from,
        to: data.to,
        promotion: data.promotion || undefined
      });
      
      if (!move) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Invalid move'
        }));
        return;
      }
      
      // Store the move
      game.moves.push(move);
      
      // Check game status
      let gameOver = false;
      let result = null;
      
      if (game.chess.isCheckmate()) {
        gameOver = true;
        result = isWhite ? 'white_win' : 'black_win';
      } else if (game.chess.isDraw()) {
        gameOver = true;
        result = 'draw';
      }
      
      // Broadcast the move to both players
      const moveData = {
        type: 'MOVE_MADE',
        from: data.from,
        to: data.to,
        promotion: data.promotion,
        fen: game.chess.fen(),
        pgn: game.chess.pgn()
      };
      
      if (gameOver) {
        moveData.gameOver = true;
        moveData.result = result;
        game.status = 'completed';
        
        // Record the game result in the database if both players are registered
        recordGameResult(game, result);
      }
      
      // Reset draw offer after a move
      game.drawOffer = null;
      
      // Send move to both players
      wss.clients.forEach((client) => {
        if (client.playerId === game.white || client.playerId === game.black) {
          client.send(JSON.stringify(moveData));
        }
      });
      
      console.log(`Move made in game ${gameId}: ${data.from} to ${data.to}`);
    } catch (error) {
      console.error('Error making move:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Error making move'
      }));
    }
  }

  function handleResign(ws, data) {
    if (!playerId || !gameId || !games[gameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid game state'
      }));
      return;
    }
    
    const game = games[gameId];
    
    // Check if the player is part of this game
    if (game.white !== playerId && game.black !== playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'You are not part of this game'
      }));
      return;
    }
    
    // Determine the winner
    const result = game.white === playerId ? 'black_win' : 'white_win';
    game.status = 'completed';
    
    // Record the game result
    recordGameResult(game, result);
    
    // Notify both players
    wss.clients.forEach((client) => {
      if (client.playerId === game.white || client.playerId === game.black) {
        client.send(JSON.stringify({
          type: 'GAME_OVER',
          result: result,
          reason: 'resignation',
          winner: result === 'white_win' ? game.white : game.black,
          fen: game.chess.fen(),
          pgn: game.chess.pgn()
        }));
      }
    });
    
    console.log(`Player ${playerId} resigned in game ${gameId}`);
  }

  function handleDrawOffer(ws, data) {
    if (!playerId || !gameId || !games[gameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid game state'
      }));
      return;
    }
    
    const game = games[gameId];
    
    // Check if the player is part of this game
    if (game.white !== playerId && game.black !== playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'You are not part of this game'
      }));
      return;
    }
    
    // Set draw offer
    game.drawOffer = playerId;
    
    // Notify the opponent
    const opponent = game.white === playerId ? game.black : game.white;
    
    wss.clients.forEach((client) => {
      if (client.playerId === opponent) {
        client.send(JSON.stringify({
          type: 'DRAW_OFFERED',
          offeredBy: playerId
        }));
      }
    });
    
    // Confirm to the offering player
    ws.send(JSON.stringify({
      type: 'DRAW_OFFER_SENT'
    }));
    
    console.log(`Player ${playerId} offered a draw in game ${gameId}`);
  }

  function handleAcceptDraw(ws, data) {
    if (!playerId || !gameId || !games[gameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid game state'
      }));
      return;
    }
    
    const game = games[gameId];
    
    // Check if there is a draw offer and it's not from this player
    if (!game.drawOffer || game.drawOffer === playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'No valid draw offer to accept'
      }));
      return;
    }
    
    // End the game as a draw
    game.status = 'completed';
    
    // Record the game result
    recordGameResult(game, 'draw');
    
    // Notify both players
    wss.clients.forEach((client) => {
      if (client.playerId === game.white || client.playerId === game.black) {
        client.send(JSON.stringify({
          type: 'GAME_OVER',
          result: 'draw',
          reason: 'agreement',
          fen: game.chess.fen(),
          pgn: game.chess.pgn()
        }));
      }
    });
    
    console.log(`Draw accepted in game ${gameId}`);
  }

  function handleDeclineDraw(ws, data) {
    if (!playerId || !gameId || !games[gameId]) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid game state'
      }));
      return;
    }
    
    const game = games[gameId];
    
    // Check if there is a draw offer and it's not from this player
    if (!game.drawOffer || game.drawOffer === playerId) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'No valid draw offer to decline'
      }));
      return;
    }
    
    // Clear the draw offer
    const offeredBy = game.drawOffer;
    game.drawOffer = null;
    
    // Notify the player who offered the draw
    wss.clients.forEach((client) => {
      if (client.playerId === offeredBy) {
        client.send(JSON.stringify({
          type: 'DRAW_DECLINED',
          declinedBy: playerId
        }));
      }
    });
    
    // Confirm to the declining player
    ws.send(JSON.stringify({
      type: 'DRAW_DECLINE_SENT'
    }));
    
    console.log(`Draw declined in game ${gameId}`);
  }

  // Helper function to record game results in the database
  async function recordGameResult(game, result) {
    try {
      // Check if both players are registered users
      const whiteQuery = await pool.query(
        'SELECT id, elo FROM users WHERE username = $1',
        [game.white]
      );
      
      const blackQuery = await pool.query(
        'SELECT id, elo FROM users WHERE username = $1',
        [game.black]
      );
      
      // If either player is not registered, don't record the result
      if (whiteQuery.rows.length === 0 || blackQuery.rows.length === 0) {
        console.log('Skipping ELO update: one or both players not registered');
        return;
      }
      
      const whitePlayer = whiteQuery.rows[0];
      const blackPlayer = blackQuery.rows[0];
      
      // Calculate ELO changes
      let whiteResult, blackResult;
      
      if (result === 'white_win') {
        whiteResult = 'win';
        blackResult = 'loss';
      } else if (result === 'black_win') {
        whiteResult = 'loss';
        blackResult = 'win';
      } else {
        whiteResult = blackResult = 'draw';
      }
      
      // Calculate ELO changes
      const { userEloChange: whiteEloChange, opponentEloChange: blackEloChange } = calculateEloChanges(
        whitePlayer.elo,
        blackPlayer.elo,
        whiteResult
      );
      
      // Start a transaction
      await pool.query('BEGIN');
      
      // Record the match
      let winnerId = null;
      if (result === 'white_win') {
        winnerId = whitePlayer.id;
      } else if (result === 'black_win') {
        winnerId = blackPlayer.id;
      }
      
      await pool.query(
        `INSERT INTO matches 
         (white_player_id, black_player_id, winner_id, result, 
          white_elo_before, black_elo_before, 
          white_elo_change, black_elo_change, game_pgn) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          whitePlayer.id, blackPlayer.id, winnerId, result,
          whitePlayer.elo, blackPlayer.elo,
          whiteEloChange, blackEloChange,
          game.chess.pgn()
        ]
      );
      
      // Update player ELO ratings
      await pool.query(
        'UPDATE users SET elo = GREATEST(0, elo + $1), updated_at = NOW() WHERE id = $2',
        [whiteEloChange, whitePlayer.id]
      );
      
      await pool.query(
        'UPDATE users SET elo = GREATEST(0, elo + $1), updated_at = NOW() WHERE id = $2',
        [blackEloChange, blackPlayer.id]
      );
      
      // Commit the transaction
      await pool.query('COMMIT');
      
      console.log(`Game result recorded: ${result}, White ELO change: ${whiteEloChange}, Black ELO change: ${blackEloChange}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error recording game result:', error);
    }
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

// --- startup ---
(async () => {
  try {
    const { rows } = await pool.query('select now() as ts');
    console.log('Database connected:', rows[0].ts);
    // IMPORTANT: DO NOT process.exit(0) here
    const port = process.env.PORT || 3000;
    server.listen(port, () => console.log('API listening on', port));
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1); // exit only on failure
  }
})();

/**
 * Create and configure the server
 * @returns {http.Server} The configured HTTP server
 */
function createServer() {
  return server;
}

// Export the createServer function
module.exports = { createServer, pool };
