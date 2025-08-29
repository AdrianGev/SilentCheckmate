const React = require('react');
const { useState } = React;

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }
    
    onLogin(username);
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Welcome to Silent Checkmate</h2>
        <p>Enter a username to start playing</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
            {error && <div className="error-message">{error}</div>}
          </div>
          
          <button type="submit">Start Playing</button>
        </form>
      </div>
    </div>
  );
};

module.exports = Login;
