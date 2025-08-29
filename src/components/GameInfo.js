const React = require('react');

const GameInfo = ({ username, opponent, status, gameId, playerColor, moveHistory }) => {
  return (
    <div className="game-info">
      <div className="player-info">
        <h3>Game Information</h3>
        <p><strong>Your Username:</strong> {username}</p>
        <p><strong>Playing as:</strong> {playerColor}</p>
        {opponent && <p><strong>Opponent:</strong> {opponent}</p>}
        {gameId && <p><strong>Game ID:</strong> {gameId}</p>}
      </div>
      
      <div className="game-status">
        <h3>Status</h3>
        <p>{status}</p>
      </div>
      
      <div className="move-history">
        <h3>Move History</h3>
        {moveHistory.length === 0 ? (
          <p>No moves yet</p>
        ) : (
          <ul className="move-list">
            {moveHistory.map((move, index) => (
              <li key={index}>{move}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

module.exports = GameInfo;
