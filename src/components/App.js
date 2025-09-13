import React, { useState, useEffect, useRef } from 'react';
import ChessBoard from './ChessBoard';
import GameControls from './GameControls';
import GameInfo from './GameInfo';
import '../styles/App.css';

const App = () => {
  // State variables
  const [username, setUsername] = useState(localStorage.getItem('username') || 'Player');
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [playerColor, setPlayerColor] = useState('white');
  const [status, setStatus] = useState('Ready to play');
  const [moveHistory, setMoveHistory] = useState([]);
  const [isGameActive, setIsGameActive] = useState(false);
  const [position, setPosition] = useState('start');
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [socket, setSocket] = useState(null);
  
  const chessBoardRef = useRef(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const serverUrl = localStorage.getItem('SERVER_URL') || 'https://silentcheckmate.onrender.com';
    const wsUrl = serverUrl.replace(/^http/, m => m === "https" ? "wss" : "ws") + "/ws";
    
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log("WebSocket connected");
      setStatus("Connected to server");
      
      // Send login message with username if available
      if (username) {
        newSocket.send(JSON.stringify({ type: "LOGIN", payload: { username } }));
      }
      
      // Keep-alive ping
      const pingInterval = setInterval(() => {
        if (newSocket.readyState === 1) {
          newSocket.send(JSON.stringify({ t: "PING" }));
        }
      }, 25000);
      
      // Store interval ID for cleanup
      newSocket.pingInterval = pingInterval;
    };
    
    newSocket.onmessage = handleSocketMessage;
    
    newSocket.onclose = () => {
      console.log("WebSocket disconnected");
      setStatus("Disconnected from server. Reconnecting...");
      clearInterval(newSocket.pingInterval);
      
      // Reconnect after a delay
      setTimeout(() => {
        setSocket(null); // This will trigger the useEffect to run again
      }, 2000);
    };
    
    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Connection error");
    };
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        clearInterval(newSocket.pingInterval);
        newSocket.close();
      }
    };
  }, [username]); // Re-run when username changes or socket is null

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
        
        // update the board position if the chessboard instance exists
        if (window.chessboardInstance) {
          window.chessboardInstance.position(payload.fen);
        }
        
        // update move history
        const lastMove = payload.move;
        setMoveHistory(prev => [...prev, `${payload.player}: ${lastMove.from} to ${lastMove.to}`]);
        
        // check game status
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
  
  // make handleMessage available globally
  React.useEffect(() => {
    window.handleChessMessage = handleMessage;
    return () => {
      window.handleChessMessage = null;
    };
  }, [handleMessage]);
  
  // effect to send login message when logged in
  useEffect(() => {
    if (isLoggedIn && isConnected) {
      sendMessage('LOGIN', { username });
    }
  }, [isLoggedIn, isConnected, username, sendMessage]);

  // handle piece movement is now handled in the chessboard initialization

  // handle login
  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    
    // login message will be sent by the effect above
  };

  const createGame = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "CREATE_GAME" }));
      setStatus("Creating new game...");
    } else {
      setStatus("Not connected to server. Please try again.");
    }
  };
  
  // Join an existing game
  const joinGame = (id) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "JOIN_GAME", payload: { gameId: id } }));
      setStatus(`Joining game ${id}...`);
    } else {
      setStatus("Not connected to server. Please try again.");
    }
  };
  
  // Reset the board
  const resetGame = () => {
    setPosition("start");
    setMoveHistory([]);
    setStatus("Board reset");
    
    // If in a game, rejoin to get the current state
    if (isGameActive && gameId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ t: "JOIN", gameId }));
    }
  };
  
  // Resign from the current game
  const resignGame = () => {
    if (isGameActive && gameId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "RESIGN", payload: { gameId } }));
      setStatus("You resigned");
    }
  };
  
  // Offer a draw
  const offerDraw = () => {
    if (isGameActive && gameId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "OFFER_DRAW", payload: { gameId } }));
      setStatus("You offered a draw");
    }
  };
  
  // Handle move from the chessboard
  const handleMove = (move, fen) => {
    if (isGameActive && gameId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "MAKE_MOVE",
        payload: {
          gameId,
          move: move.san,
          fen
        }
      }));
    }
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>SilentCheckmate</h1>
        <div className="user-info">
          <span className="username">{username}</span>
        </div>
      </header>
      
      <main className="app-content">
        <div className="board-container">
          <ChessBoard
            ref={chessBoardRef}
            position={position}
            orientation={playerColor}
            onMove={handleMove}
            gameId={gameId}
            socket={socket}
            disabled={!isGameActive}
          />
        </div>
        
        <div className="side-panel">
          <GameControls
            createGame={createGame}
            joinGame={joinGame}
            resetGame={resetGame}
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

// wrap ChessApp with ServerConnection
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
