// Import dependencies
const { ipcRenderer } = require('electron');
const React = require('react');
const ReactDOM = require('react-dom');
const { Chess } = require('chess.js');

// Import the App component
const App = require('./components/App').default;

// Make Chess.js available globally
window.Chess = Chess;

// Use a self-executing function to handle async operations
(async () => {
  try {
    // Wait for the DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      // Create root element if it doesn't exist
      let rootElement = document.getElementById('root');
      if (!rootElement) {
        rootElement = document.createElement('div');
        rootElement.id = 'root';
        document.body.appendChild(rootElement);
      }
      
      // Render the App component to the root element
      ReactDOM.render(
        React.createElement(App),
        rootElement
      );
      
      console.log('React app rendered successfully');
    });

    // Notify the main process that the app is ready
    ipcRenderer.send('app-ready');
  } catch (error) {
    console.error('Error rendering React app:', error);
    
    // Display error in the UI for debugging
    const rootElement = document.getElementById('root') || document.body;
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Error Loading Application</h2>
        <pre>${error.message}\n${error.stack}</pre>
      </div>
    `;
  }
})();
