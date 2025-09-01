/**
 * SilentCheckmate Server Entry Point
 * 
 * This file serves as the main entry point for the SilentCheckmate server.
 * It imports and uses the enhanced server implementation from server/index.js
 * which includes PostgreSQL database integration, authentication, and ELO rating.
 */

// Use CommonJS syntax
const { createServer } = require('./server/index');

// Start the server
const PORT = process.env.PORT || 3001;
const server = createServer();

server.listen(PORT, () => {
  console.log(`SilentCheckmate server running on port ${PORT}`);
});

// Export the server for use in other files (e.g., tests)
module.exports = server;
