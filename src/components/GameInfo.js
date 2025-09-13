import React from 'react';
import '../styles/GameInfo.css';

const GameInfo = ({ 
  username, 
  opponent, 
  status, 
  gameId, 
  playerColor, 
  moveHistory,
  isGameOver,
  result
 }) => {
  // Format move history into pairs (white move, black move)
  const formatMoveHistory = () => {
    const formattedMoves = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      formattedMoves.push({
        moveNumber: Math.floor(i / 2) + 1,
        whiteMove: moveHistory[i],
        blackMove: i + 1 < moveHistory.length ? moveHistory[i + 1] : null
      });
    }
    return formattedMoves;
  };

  return (
    <div className="game-info-container">
      <div className="info-header">
        <h3>Game Information</h3>
        {isGameOver && (
          <div className={`game-result ${result?.toLowerCase()}`}>
            {result === 'win' ? 'You Won!' : 
             result === 'loss' ? 'You Lost' : 
             result === 'draw' ? 'Draw' : 'Game Over'}
          </div>
        )}
      </div>
      
      <div className="players-section">
        <div className="player-card you">
          <div className="player-avatar">
            <i className="fas fa-user"></i>
          </div>
          <div className="player-details">
            <div className="player-name">{username}</div>
            <div className="player-color">{playerColor === 'white' ? '⚪ White' : '⚫ Black'}</div>
          </div>
        </div>
        
        {opponent ? (
          <div className="player-card opponent">
            <div className="player-avatar opponent">
              <i className="fas fa-user-friends"></i>
            </div>
            <div className="player-details">
              <div className="player-name">{opponent}</div>
              <div className="player-color">{playerColor === 'white' ? '⚫ Black' : '⚪ White'}</div>
            </div>
          </div>
        ) : (
          <div className="player-card waiting">
            <div className="player-avatar waiting">
              <i className="fas fa-hourglass"></i>
            </div>
            <div className="player-details">
              <div className="player-name">Waiting for opponent...</div>
              <div className="player-color">{playerColor === 'white' ? '⚫ Black' : '⚪ White'}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="status-section">
        <h4>Status</h4>
        <div className="status-message">{status}</div>
      </div>
      
      <div className="move-history-section">
        <h4>Move History</h4>
        {moveHistory.length === 0 ? (
          <div className="no-moves">No moves yet</div>
        ) : (
          <div className="move-table-container">
            <table className="move-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>White</th>
                  <th>Black</th>
                </tr>
              </thead>
              <tbody>
                {formatMoveHistory().map((movePair) => (
                  <tr key={movePair.moveNumber}>
                    <td className="move-number">{movePair.moveNumber}.</td>
                    <td className="white-move">{movePair.whiteMove}</td>
                    <td className="black-move">{movePair.blackMove}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameInfo;
