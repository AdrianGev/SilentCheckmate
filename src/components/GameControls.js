const React = require('react');
const { useState } = React;

const GameControls = ({ createGame, joinGame, resetGame, resignGame, isGameActive }) => {
  const [gameIdInput, setGameIdInput] = useState('');

  const handleJoinGame = () => {
    if (gameIdInput.trim()) {
      joinGame(gameIdInput);
      setGameIdInput('');
    }
  };

  return (
    <div className="controls">
      <button onClick={createGame} disabled={isGameActive}>
        Create New Game
      </button>
      
      <div className="join-game">
        <input
          type="text"
          value={gameIdInput}
          onChange={(e) => setGameIdInput(e.target.value)}
          placeholder="Enter Game ID"
          disabled={isGameActive}
        />
        <button onClick={handleJoinGame} disabled={isGameActive}>
          Join Game
        </button>
      </div>
      
      <button onClick={resetGame}>
        Reset Board
      </button>
      
      <button onClick={resignGame} disabled={!isGameActive}>
        Resign
      </button>
    </div>
  );
};

module.exports = GameControls;
