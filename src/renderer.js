// Import dependencies
const { ipcRenderer } = require('electron');

// Use a self-executing function to handle async operations
(async () => {
  try {
    // Import React and ReactDOM
    const React = require('react');
    const ReactDOM = require('react-dom');

    // Import the App component
    const App = require('./components/App');

    // Wait for the DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      // Ensure the Chess and io objects are available globally
      if (!window.Chess) {
        console.error('Chess.js library not loaded!');
      }
      
      if (!window.io) {
        console.error('Socket.IO client not loaded!');
      }
      
      // Render the App component to the root element
      ReactDOM.render(
        React.createElement(App),
        document.getElementById('root')
      );
    });

    // Notify the main process that the app is ready
    ipcRenderer.send('app-ready');
    
    console.log('React app rendered successfully');
  } catch (error) {
    console.error('Error rendering React app:', error);
    
    // Display error in the UI for debugging
    document.getElementById('root').innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Error Loading Application</h2>
        <pre>${error.message}\n${error.stack}</pre>
      </div>
    `;
  }
})();
