// serverConnection.js - manages WebSocket connection to the server
const React = require('react');
const { useState, useEffect, useCallback } = React;

// Helper to get server URL from localStorage or use default
const getServerUrl = () => {
  // Try to get from localStorage first
  const savedUrl = localStorage.getItem('SERVER_URL');
  if (savedUrl) return savedUrl;
  
  // Default to the deployed server
  return 'https://silentcheckmate.onrender.com';
};

// Helper to convert HTTP URL to WebSocket URL
const getWebSocketUrl = (serverUrl) => {
  // Use wss:// for secure connections (https://)
  return serverUrl.replace(/^https?/, serverUrl.startsWith('https') ? 'wss' : 'ws') + '/ws';
};

// create a connection manager component
const ServerConnection = ({ children, onMessage, onConnectionChange }) => {
  const [serverUrl, setServerUrl] = useState(getServerUrl());
  const [wsUrl, setWsUrl] = useState(getWebSocketUrl(serverUrl));
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
  
  // function to connect to the server
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
        
        // set up keep-alive ping
        const pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 25000);
        
        // store the interval ID for cleanup
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
        
        // clear the ping interval
        if (newSocket.pingInterval) {
          clearInterval(newSocket.pingInterval);
        }
        
        // try to reconnect after a delay
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
  
  // connect to the server when the component mounts
  useEffect(() => {
    connectToServer();
    
    // clean up when the component unmounts
    return () => {
      if (socket) {
        if (socket.pingInterval) {
          clearInterval(socket.pingInterval);
        }
        socket.close();
      }
    };
  }, [connectToServer]);
  
  // function to send a message to the server
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
  
  // function to update the server URL
  const updateServerUrl = () => {
    // save to localStorage
    localStorage.setItem('SERVER_URL', tempServerUrl);
    
    // update state
    setServerUrl(tempServerUrl);
    setWsUrl(getWebSocketUrl(tempServerUrl));
    
    // reconnect
    connectToServer();
    
    // hide settings
    setShowSettings(false);
  };
  
  // render settings UI if needed
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
              placeholder="https://silentcheckmate.onrender.com (no port needed)"
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
  
  // return the connection context and UI
  return (
    <div className="server-connection">
      {renderSettings()}
      {React.cloneElement(children, { sendMessage, isConnected })}
    </div>
  );
};

module.exports = ServerConnection;
