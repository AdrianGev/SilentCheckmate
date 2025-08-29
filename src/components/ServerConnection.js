// ServerConnection.js - Manages WebSocket connection to the server
const React = require('react');
const { useState, useEffect, useCallback } = React;

// Helper to get server URL from localStorage or use default
const getServerUrl = () => {
  // Try to get from localStorage first
  const savedUrl = localStorage.getItem('SERVER_URL');
  if (savedUrl) return savedUrl;
  
  // Default to localhost for development
  return 'http://localhost:3001';
};

// Helper to convert HTTP URL to WebSocket URL
const getWebSocketUrl = (serverUrl) => {
  return serverUrl.replace(/^http/, 'ws') + '/ws';
};

// Create a connection manager component
const ServerConnection = ({ children, onMessage, onConnectionChange }) => {
  const [serverUrl, setServerUrl] = useState(getServerUrl());
  const [wsUrl, setWsUrl] = useState(getWebSocketUrl(serverUrl));
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
  
  // Function to connect to the server
  const connectToServer = useCallback(() => {
    if (socket) {
      socket.close();
    }
    
    try {
      console.log(`Connecting to WebSocket server at ${wsUrl}`);
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        onConnectionChange(true);
        
        // Set up keep-alive ping
        const pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 25000);
        
        // Store the interval ID for cleanup
        newSocket.pingInterval = pingInterval;
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      newSocket.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        onConnectionChange(false);
        
        // Clear the ping interval
        if (newSocket.pingInterval) {
          clearInterval(newSocket.pingInterval);
        }
        
        // Try to reconnect after a delay
        setTimeout(connectToServer, 5000);
      };
      
      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      setSocket(newSocket);
    } catch (error) {
      console.error('Error connecting to server:', error);
    }
  }, [wsUrl, onMessage, onConnectionChange]);
  
  // Connect to the server when the component mounts
  useEffect(() => {
    connectToServer();
    
    // Clean up when the component unmounts
    return () => {
      if (socket) {
        if (socket.pingInterval) {
          clearInterval(socket.pingInterval);
        }
        socket.close();
      }
    };
  }, [connectToServer]);
  
  // Function to send a message to the server
  const sendMessage = useCallback((type, payload) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        type,
        payload,
        timestamp: Date.now()
      };
      
      socket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message, socket not connected');
    }
  }, [socket]);
  
  // Function to update the server URL
  const updateServerUrl = () => {
    // Save to localStorage
    localStorage.setItem('SERVER_URL', tempServerUrl);
    
    // Update state
    setServerUrl(tempServerUrl);
    setWsUrl(getWebSocketUrl(tempServerUrl));
    
    // Reconnect
    connectToServer();
    
    // Hide settings
    setShowSettings(false);
  };
  
  // Render settings UI if needed
  const renderSettings = () => {
    if (!showSettings) {
      return (
        <div className="server-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          <button onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      );
    }
    
    return (
      <div className="server-settings">
        <h3>Server Settings</h3>
        <div>
          <label>
            Server URL:
            <input 
              type="text" 
              value={tempServerUrl} 
              onChange={(e) => setTempServerUrl(e.target.value)}
              placeholder="http://localhost:3001 or https://your-app.onrender.com"
            />
          </label>
        </div>
        <div className="settings-buttons">
          <button onClick={updateServerUrl}>Save</button>
          <button onClick={() => setShowSettings(false)}>Cancel</button>
        </div>
      </div>
    );
  };
  
  // Return the connection context and UI
  return (
    <div className="server-connection">
      {renderSettings()}
      {React.cloneElement(children, { sendMessage, isConnected })}
    </div>
  );
};

module.exports = ServerConnection;
