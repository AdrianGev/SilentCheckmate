// import required modules
const { ipcRenderer } = require('electron');

// log that renderer is starting
console.log('Renderer process starting...');

// global variables
let game = null;
let board = null;
let username = '';
let gameId = '';
let playerColor = 'white';
let isGameActive = false;
let moveHistory = [];
let opponent = '';
let socket = null;

// initialize socket connection
function initializeSocket() {
  try {
    // use the global io object from the CDN
    socket = io('http://localhost:3001');
    console.log('Socket initialized');
    setupSocketEvents();
  } catch (error) {
    console.error('Error initializing socket:', error);
    updateStatus('Error connecting to server: ' + error.message);
  }
}

// initialize chess game
function initializeChessGame() {
  try {
    // use the global Chess object from the CDN
    game = new Chess();
    console.log('Chess game initialized');
  } catch (error) {
    console.error('Error initializing chess game:', error);
    updateStatus('Error initializing chess game: ' + error.message);
  }
}

// socket event handlers
function setupSocketEvents() {
  if (!socket) {
    console.error('Cannot setup socket events: socket is null');
    return;
  }

  socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateStatus('Disconnected from server. Please refresh the page.');
  });

  socket.on('gameCreated', (data) => {
    console.log('Game created event received:', data);
    gameId = data.gameId;
    playerColor = 'white';
    isGameActive = true;
    
    // update UI
    document.getElementById('game-id').textContent = gameId;
    document.getElementById('game-id-info').style.display = 'block';
    document.getElementById('player-color').textContent = playerColor;
    updateStatus('Game created! Share the Game ID with your opponent.');
    
    // enable/disable buttons
    document.getElementById('create-game-btn').disabled = true;
    document.getElementById('join-game-btn').disabled = true;
    document.getElementById('join-game-id').disabled = true;
    document.getElementById('resign-btn').disabled = false;
    
    // Reset the board
    if (game) game.reset();
    if (board) {
      board.position('start');
      board.orientation('white');
    }
    
    // Clear move history
    moveHistory = [];
    updateMoveList();
  });

  socket.on('gameJoined', (data) => {
    console.log('Game joined event received:', data);
    gameId = data.gameId;
    playerColor = data.color;
    opponent = data.opponent;
    isGameActive = true;
    
    // update UI
    document.getElementById('game-id').textContent = gameId;
    document.getElementById('game-id-info').style.display = 'block';
    document.getElementById('player-color').textContent = playerColor;
    document.getElementById('opponent-name').textContent = opponent;
    document.getElementById('opponent-info').style.display = 'block';
    
    updateStatus(`Game joined! You are playing as ${playerColor}.`);
    
    // enable/disable buttons
    document.getElementById('create-game-btn').disabled = true;
    document.getElementById('join-game-btn').disabled = true;
    document.getElementById('join-game-id').disabled = true;
    document.getElementById('resign-btn').disabled = false;
    
    // set board orientation
    if (board) board.orientation(playerColor);
  });

  socket.on('opponentJoined', (data) => {
    console.log('Opponent joined event received:', data);
    opponent = data.opponent;
    
    // update UI
    document.getElementById('opponent-name').textContent = opponent;
    document.getElementById('opponent-info').style.display = 'block';
    
    updateStatus(`${opponent} has joined the game. Your move!`);
  });

  socket.on('moveMade', (data) => {
    console.log('Move made event received:', data);
    // update the game state
    if (game) {
      game.move(data.move);
      if (board) board.position(game.fen());
      
      // add to move history
      moveHistory.push(data.move);
      updateMoveList();
      
      // update status
      if (data.username !== username) {
        updateStatus(`${opponent} moved ${data.move}. Your turn.`);
      } else {
        updateStatus(`You moved ${data.move}. Waiting for opponent.`);
      }
      
      // check for game over
      if (game.isGameOver()) {
        handleGameOver();
      }
    }
  });

  socket.on('gameOver', (data) => {
    console.log('Game over event received:', data);
    isGameActive = false;
    updateStatus(data.message);
    
    // enable/disable buttons
    document.getElementById('create-game-btn').disabled = false;
    document.getElementById('join-game-btn').disabled = false;
    document.getElementById('join-game-id').disabled = false;
    document.getElementById('resign-btn').disabled = true;
  });

  socket.on('opponentDisconnected', (data) => {
    console.log('Opponent disconnected event received');
    updateStatus('Your opponent has disconnected.');
  });

  socket.on('error', (data) => {
    console.error('Error message received:', data);
    updateStatus(`Error: ${data.message}`);
  });
}

// DOM elements
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  
  // initialize chess game and socket
  initializeChessGame();
  initializeSocket();
  
  // login form
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const loginError = document.getElementById('login-error');
  const loginScreen = document.getElementById('login-screen');
  const gameScreen = document.getElementById('game-screen');
  
  // login form handler
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Login form submitted');
      const usernameValue = usernameInput.value.trim();
      
      if (!usernameValue) {
        loginError.textContent = 'Username cannot be empty';
        return;
      }
      
      username = usernameValue;
      document.getElementById('player-username').textContent = username;
      
      // hide login screen, show game screen
      loginScreen.style.display = 'none';
      gameScreen.style.display = 'block';
      
      // initialize the board
      initializeBoard();
      
      // connect to socket server
      if (socket) {
        // no need to emit login event so just use username when creating/joining games probably
        console.log('Login successful with username:', username);
      } else {
        console.error('Socket not initialized');
        updateStatus('Error connecting to server. Please refresh the page.');
        return;
      }
      
      updateStatus('Logged in. Create or join a game to start playing.');
    });
  } else {
    console.error('Login form not found');
  }
  
  // game control buttons
  const createGameBtn = document.getElementById('create-game-btn');
  const joinGameIdInput = document.getElementById('join-game-id');
  const joinGameBtn = document.getElementById('join-game-btn');
  const resetBtn = document.getElementById('reset-btn');
  const resignBtn = document.getElementById('resign-btn');
  
  // create game button
  if (createGameBtn) {
    createGameBtn.addEventListener('click', () => {
      if (!username) {
        updateStatus('Please login first');
        return;
      }
      
      if (socket) {
        socket.emit('createGame', { username });
        updateStatus('Creating a new game...');
      } else {
        updateStatus('Error: Not connected to server');
      }
    });
  }
  
  // join game button
  if (joinGameBtn) {
    joinGameBtn.addEventListener('click', () => {
      const gameIdValue = joinGameIdInput.value.trim();
      
      if (!username) {
        updateStatus('Please login first');
        return;
      }
      
      if (!gameIdValue) {
        updateStatus('Please enter a Game ID');
        return;
      }
      
      if (socket) {
        socket.emit('joinGame', { username, gameId: gameIdValue });
        updateStatus('Joining game...');
      } else {
        updateStatus('Error: Not connected to server');
      }
    });
  }
  
  // reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (game) {
        game.reset();
        if (board) board.position(game.fen());
        updateStatus('Board reset');
        
        if (isGameActive && gameId && socket) {
          socket.emit('resetBoard', { gameId });
        }
      }
    });
  }
  
  // resign button
  if (resignBtn) {
    resignBtn.addEventListener('click', () => {
      if (isGameActive && gameId && socket) {
        socket.emit('resign', { gameId, username });
        updateStatus('You resigned the game');
      }
    });
  }
  
  // notify the main process that the app is ready
  ipcRenderer.send('app-ready');
});

// initialize the chessboard
function initializeBoard() {
  try {
    console.log('Initializing chessboard...');
    const config = {
      draggable: true,
      position: 'start',
      orientation: playerColor,
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd
    };
    
    if (typeof Chessboard === 'function') {
      board = Chessboard('board', config);
      console.log('Chessboard initialized successfully');
      updateStatus('Board initialized');
    } else {
      console.error('Chessboard function not found');
      updateStatus('Error initializing board. Chessboard library not loaded.');
    }
  } catch (error) {
    console.error('Error initializing board:', error);
    updateStatus('Error initializing board: ' + error.message);
  }
}

// chess piece drag start handler
function onDragStart(source, piece, position, orientation) {
  // do not allow piece movement if the game is over
  if (game && game.isGameOver()) return false;
  
  // only allow the current player to move their pieces
  if (!isGameActive) return false;
  
  // Only allow the player to move their own pieces
  if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
      (playerColor === 'black' && piece.search(/^w/) !== -1)) {
    return false;
  }
  
  // Only allow moves if it's the player's turn
  if (game && ((game.turn() === 'w' && playerColor === 'black') ||
      (game.turn() === 'b' && playerColor === 'white'))) {
    return false;
  }
}

// chess piece drop handler
function onDrop(source, target) {
  // check if the move is legal
  if (!game) return 'snapback';
  
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Always promote to queen for simplicity
  });
  
  // if illegal move, snap back
  if (move === null) return 'snapback';
  
  // send the move to the server
  if (isGameActive && gameId && socket) {
    socket.emit('makeMove', {
      gameId,
      move: move.san,
      fen: game.fen(),
      player: username
    });
  }
  
  // check for game over
  if (game.isGameOver()) {
    handleGameOver();
  }
}

// after a piece snap animation completes
function onSnapEnd() {
  if (board && game) {
    board.position(game.fen());
  }
}

// handle game over conditions
function handleGameOver() {
  if (!game) return;
  
  isGameActive = false;
  
  if (game.isCheckmate()) {
    updateStatus(game.turn() === 'w' ? 'Checkmate! Black wins.' : 'Checkmate! White wins.');
  } else if (game.isDraw()) {
    updateStatus('Game over. It\'s a draw!');
  } else if (game.isStalemate()) {
    updateStatus('Game over. Stalemate!');
  } else if (game.isThreefoldRepetition()) {
    updateStatus('Game over. Draw by threefold repetition.');
  } else if (game.isInsufficientMaterial()) {
    updateStatus('Game over. Draw by insufficient material.');
  }
  
  // enable/disable buttons
  document.getElementById('create-game-btn').disabled = false;
  document.getElementById('join-game-btn').disabled = false;
  document.getElementById('join-game-id').disabled = false;
  document.getElementById('resign-btn').disabled = true;
}

// update the game status message
function updateStatus(message) {
  const statusEl = document.getElementById('game-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log('Status:', message);
}

// update the move history list
function updateMoveList() {
  const moveListEl = document.getElementById('move-list');
  
  if (moveListEl) {
    if (moveHistory.length === 0) {
      moveListEl.innerHTML = '<li>No moves yet</li>';
    } else {
      moveListEl.innerHTML = '';
      moveHistory.forEach((move, index) => {
        const li = document.createElement('li');
        li.textContent = `${Math.floor(index / 2) + 1}. ${move}`;
        moveListEl.appendChild(li);
      });
    }
  }
}
