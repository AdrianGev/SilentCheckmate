import React, { useState } from 'react';
import '../styles/GameControls.css';

const GameControls = ({ 
  createGame, 
  joinGame, 
  resetGame, 
  resignGame, 
  offerDraw,
  isGameActive,
  gameId,
  playerColor
 }) => {
  const [gameIdInput, setGameIdInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleJoinGame = () => {
    if (gameIdInput.trim()) {
      joinGame(gameIdInput.trim());
      setGameIdInput('');
    }
  };

  const handleCopyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinGame();
    }
  };

  return (
    <div className="game-controls">
      <div className="control-section">
        <button 
          className="control-button create-button" 
          onClick={createGame} 
          disabled={isGameActive}
        >
          <i className="fas fa-plus"></i> Create New Game
        </button>
        
        <div className="join-game">
          <input
            type="text"
            value={gameIdInput}
            onChange={(e) => setGameIdInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter Game ID"
            disabled={isGameActive}
            className="game-id-input"
          />
          <button 
            className="control-button join-button" 
            onClick={handleJoinGame} 
            disabled={isGameActive || !gameIdInput.trim()}
          >
            <i className="fas fa-sign-in-alt"></i> Join
          </button>
        </div>
      </div>
      
      {gameId && (
        <div className="game-id-container">
          <div className="game-id-header">
            <i className="fas fa-key"></i> Game ID (Share with opponent)
          </div>
          <div className="game-id-display">
            <div className="game-id-value">{gameId}</div>
            <button 
              className="copy-button" 
              onClick={handleCopyGameId} 
              title="Copy Game ID"
            >
              {copied ? (
                <span className="copied-text">
                  <i className="fas fa-check"></i> Copied!
                </span>
              ) : (
                <span>
                  <i className="fas fa-copy"></i> Copy
                </span>
              )}
            </button>
          </div>
          <div className="game-id-instructions">
            Share this ID with your opponent so they can join your game
          </div>
        </div>
      )}
      
      <div className="control-section">
        <button 
          className="control-button reset-button" 
          onClick={resetGame}
        >
          <i className="fas fa-redo"></i> Reset
        </button>
        
        <button 
          className="control-button resign-button" 
          onClick={resignGame} 
          disabled={!isGameActive}
        >
          <i className="fas fa-flag"></i> Resign
        </button>
        
        <button 
          className="control-button draw-button" 
          onClick={offerDraw} 
          disabled={!isGameActive}
        >
          <i className="fas fa-handshake"></i> Offer Draw
        </button>
      </div>
      
      {isGameActive && playerColor && (
        <div className="player-info">
          Playing as: <span className={`color-indicator ${playerColor}`}>{playerColor}</span>
        </div>
      )}
    </div>
  );
};

export default GameControls;
