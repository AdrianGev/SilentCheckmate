const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
// Try to import chess.js with different syntax
try {
  var Chess = require('chess.js');
} catch (e) {
  console.error('Error importing chess.js:', e);
  try {
    var { Chess } = require('chess.js');
  } catch (e2) {
    console.error('Second attempt failed:', e2);
    // Last resort - use a dummy Chess class for server-side
    var Chess = class {
      constructor(fen) {
        this.fen = fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      isGameOver() { return false; }
    };
    console.log('Using dummy Chess class');
  }
}

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create Socket.IO server with CORS enabled
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store active games
const games = {};
const userSockets = {};

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new game
  socket.on('createGame', (data) => {
    const username = data.username;
    const gameId = uuidv4().substring(0, 8); // Generate a shorter game ID for ease of use
    
    // Store user socket mapping
    userSockets[username] = socket.id;
    
    // Create new game
    games[gameId] = {
      id: gameId,
      creator: username,
      creatorSocketId: socket.id,
      opponent: null,
      opponentSocketId: null,
      game: new Chess(),
      status: 'waiting'
    };
    
    // Join the socket to a room with the game ID
    socket.join(gameId);
    
    // Notify the client that the game was created
    socket.emit('gameCreated', { gameId });
    console.log(`Game created by ${username} with ID: ${gameId}`);
  });

  // Join an existing game
  socket.on('joinGame', (data) => {
    const { gameId, username } = data;
    
    // Check if the game exists
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if the game is already full
    if (games[gameId].status !== 'waiting') {
      socket.emit('error', { message: 'Game is already in progress or completed' });
      return;
    }
    
    // Store user socket mapping
    userSockets[username] = socket.id;
    
    // Update game with opponent information
    games[gameId].opponent = username;
    games[gameId].opponentSocketId = socket.id;
    games[gameId].status = 'playing';
    
    // Join the socket to the game room
    socket.join(gameId);
    
    // Notify both players that the game has started
    socket.emit('gameJoined', { 
      gameId, 
      creator: games[gameId].creator 
    });
    
    io.to(games[gameId].creatorSocketId).emit('opponentJoined', { 
      gameId, 
      opponent: username 
    });
    
    console.log(`${username} joined game ${gameId}`);
  });

  // Handle a move
  socket.on('makeMove', (data) => {
    const { gameId, move, fen, player } = data;
    
    // Check if the game exists
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Update the game state
    try {
      games[gameId].game = new Chess(fen);
      
      // Broadcast the move to all players in the game
      io.to(gameId).emit('moveMade', {
        move,
        fen,
        player
      });
      
      // Check if the game is over
      if (games[gameId].game.isGameOver()) {
        games[gameId].status = 'completed';
      }
    } catch (error) {
      console.error('Error processing move:', error);
      socket.emit('error', { message: 'Invalid move' });
    }
  });

  // Handle player resignation
  socket.on('resign', (data) => {
    const { gameId, username } = data;
    
    // Check if the game exists
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Determine the winner
    const winner = username === games[gameId].creator ? games[gameId].opponent : games[gameId].creator;
    
    // Update game status
    games[gameId].status = 'completed';
    
    // Notify all players in the game
    io.to(gameId).emit('gameOver', {
      reason: 'resignation',
      winner,
      loser: username
    });
    
    console.log(`${username} resigned from game ${gameId}. ${winner} wins.`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find games where this socket is a player
    Object.keys(games).forEach(gameId => {
      const game = games[gameId];
      
      if (game.creatorSocketId === socket.id || game.opponentSocketId === socket.id) {
        // Determine the disconnected player
        const disconnectedPlayer = game.creatorSocketId === socket.id ? game.creator : game.opponent;
        const remainingPlayer = game.creatorSocketId === socket.id ? game.opponent : game.creator;
        const remainingSocketId = game.creatorSocketId === socket.id ? game.opponentSocketId : game.creatorSocketId;
        
        // Only notify if there's another player in the game
        if (remainingPlayer && remainingSocketId) {
          io.to(remainingSocketId).emit('opponentDisconnected', {
            gameId,
            opponent: disconnectedPlayer
          });
        }
        
        // If the game was in progress, mark it as abandoned
        if (game.status === 'playing') {
          game.status = 'abandoned';
        }
        
        console.log(`${disconnectedPlayer} disconnected from game ${gameId}`);
      }
    });
    
    // Remove user from socket mapping
    for (const [username, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) {
        delete userSockets[username];
        break;
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the server for use in other files
module.exports = server;
