const React = require('react');
const { useState, useEffect, useCallback } = React;
// Use global Chess object from CDN
// const { Chess } = require('chess.js');
// const { Chessboard } = require('react-chessboard');
// const io = require('socket.io-client');
const Login = require('./Login');
const GameControls = require('./GameControls');
const GameInfo = require('./GameInfo');
const ServerConnection = require('./ServerConnection');

// Main App component
const ChessApp = ({ sendMessage, isConnected }) => {
  // State variables
  const [game, setGame] = useState(new window.Chess());
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [gameId, setGameId] = useState('');
  const [playerColor, setPlayerColor] = useState('white');
  const [opponent, setOpponent] = useState('');
  const [status, setStatus] = useState('Waiting for opponent...');
  // No longer need socket state as it's managed by ServerConnection
  const [moveHistory, setMoveHistory] = useState([]);
  const [isGameActive, setIsGameActive] = useState(false);

  // Initialize chessboard
  useEffect(() => {
    if (isLoggedIn) {
      // Initialize the chessboard when logged in
      let board = null;
      const config = {
        draggable: true,
        position: game.fen(),
        orientation: playerColor === 'black' ? 'black' : 'white',
        onDragStart: (source, piece) => {
          // Only allow the player to drag their own pieces
          if (!isGameActive) return false;
          if ((game.turn() === 'w' && playerColor !== 'white') ||
              (game.turn() === 'b' && playerColor !== 'black')) {
            return false;
          }
          // Don't allow moving pieces if it's not your turn
          if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
              (playerColor === 'black' && piece.search(/^w/) !== -1)) {
            return false;
          }
          return true;
        },
        onDrop: (source, target) => {
          // Try to make the move
          const move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Always promote to queen for simplicity
          });

          // If the move is invalid
          if (move === null) return 'snapback';

          // Update the game state
          setGame(new window.Chess(game.fen()));

          // Send the move to the server
          if (isConnected) {
            sendMessage('MAKE_MOVE', {
              gameId,
              move,
              fen: game.fen()
            });
          }

          // Update move history
          setMoveHistory(prev => [...prev, `${username}: ${source} to ${target}`]);

          // Check game status
          if (game.isGameOver()) {
            if (game.isCheckmate()) {
              setStatus(`Checkmate! ${username} wins!`);
            } else if (game.isDraw()) {
              setStatus('Game ended in a draw');
            } else {
              setStatus('Game over');
            }
            setIsGameActive(false);
          }
        }
      };

      // Initialize the board
      if (window.Chessboard) {
        board = window.Chessboard('chessboard', config);
        
        // Store the board in a ref so we can access it later
        window.chessboardInstance = board;
      }

      // Clean up function
      return () => {
        if (board && board.destroy) {
          board.destroy();
        }
      };
    }
  }, [isLoggedIn, game, playerColor, isGameActive, gameId, username, isConnected]);

  // Handle WebSocket messages - expose to ref
  const handleMessage = useCallback((message) => {
    const { type, payload } = message;
    
    switch (type) {
      case 'CONNECTED':
        console.log('Connected to server');
        break;
        
      case 'LOGIN_SUCCESS':
        console.log('Login successful');
        break;
        
      case 'GAME_CREATED':
        setGameId(payload.gameId);
        setPlayerColor('white');
        setStatus(`Game created. Waiting for opponent. Share game ID: ${payload.gameId}`);
        break;
        
      case 'GAME_JOINED':
        setGameId(payload.gameId);
        setPlayerColor('black');
        setOpponent(payload.creator);
        setIsGameActive(true);
        setStatus(`Game started. Playing as black against ${payload.creator}`);
        break;
        
      case 'OPPONENT_JOINED':
        setOpponent(payload.opponent);
        setIsGameActive(true);
        setStatus(`Game started. Playing as white against ${payload.opponent}`);
        break;
        
      case 'MOVE_MADE':
        const newGame = new window.Chess(payload.fen);
        setGame(newGame);
        
        // Update the board position if the chessboard instance exists
        if (window.chessboardInstance) {
          window.chessboardInstance.position(payload.fen);
        }
        
        // Update move history
        const lastMove = payload.move;
        setMoveHistory(prev => [...prev, `${payload.player}: ${lastMove.from} to ${lastMove.to}`]);
        
        // Check game status
        if (newGame.isGameOver()) {
          if (newGame.isCheckmate()) {
            setStatus(`Checkmate! ${payload.player} wins!`);
          } else if (newGame.isDraw()) {
            setStatus('Game ended in a draw');
          } else {
            setStatus('Game over');
          }
          setIsGameActive(false);
        }
        break;
        
      case 'GAME_OVER':
        setIsGameActive(false);
        if (payload.reason === 'resignation') {
          setStatus(`${payload.loser} resigned. ${payload.winner} wins.`);
        } else if (payload.reason === 'checkmate') {
          setStatus(`Checkmate! ${payload.winner} wins!`);
        } else if (payload.reason === 'draw') {
          setStatus('Game ended in a draw');
        } else {
          setStatus('Game over');
        }
        break;
        
      case 'ERROR':
        console.error('Error:', payload.message);
        setStatus(`Error: ${payload.message}`);
        break;
        
      case 'OPPONENT_DISCONNECTED':
        setStatus(`${payload.opponent} disconnected.`);
        setIsGameActive(false);
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  }, []);
  
  // Make handleMessage available globally
  React.useEffect(() => {
    window.handleChessMessage = handleMessage;
    return () => {
      window.handleChessMessage = null;
    };
  }, [handleMessage]);
  
  // Effect to send login message when logged in
  useEffect(() => {
    if (isLoggedIn && isConnected) {
      sendMessage('LOGIN', { username });
    }
  }, [isLoggedIn, isConnected, username, sendMessage]);

  // Handle piece movement is now handled in the chessboard initialization

  // Handle login
  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    
    // Login message will be sent by the effect above
  };

  // Create a new game
  const createGame = () => {
    if (isConnected) {
      sendMessage('CREATE_GAME', {});
      setGame(new window.Chess());
      setMoveHistory([]);
    }
  };

  // Join an existing game
  const joinGame = (id) => {
    if (isConnected && id) {
      sendMessage('JOIN_GAME', { gameId: id });
      setGameId(id);
      setGame(new window.Chess());
      setMoveHistory([]);
    }
  };

  // Reset the game
  const resetGame = () => {
    const newGame = new window.Chess();
    setGame(newGame);
    setMoveHistory([]);
    setStatus('Game reset. Create or join a game to start playing.');
    setIsGameActive(false);
    setGameId('');
    setOpponent('');
  };

  // Resign from the game
  const resignGame = () => {
    if (isConnected && gameId) {
      sendMessage('RESIGN', { gameId });
      setStatus(`You resigned. ${opponent} wins.`);
      setIsGameActive(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>Silent Checkmate</h1>
      </div>

      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div className="game-container">
          <GameInfo 
            username={username} 
            opponent={opponent} 
            status={status} 
            gameId={gameId} 
            playerColor={playerColor}
            moveHistory={moveHistory}
          />
          
          <div className="chessboard">
            <div id="chessboard" className="chess-board" style={{ width: '400px', height: '400px' }}></div>
          </div>
          
          <GameControls 
            createGame={createGame} 
            joinGame={joinGame} 
            resetGame={resetGame} 
            resignGame={resignGame}
            isGameActive={isGameActive}
          />
        </div>
      )}
    </div>
  );
};

// Wrap ChessApp with ServerConnection
const App = () => {
  return (
    <ServerConnection 
      onMessage={(message) => window.handleChessMessage && window.handleChessMessage(message)} 
      onConnectionChange={(isConnected) => console.log(`Connection status: ${isConnected ? 'connected' : 'disconnected'}`)}
    >
      <ChessApp />
    </ServerConnection>
  );
};

module.exports = App;
