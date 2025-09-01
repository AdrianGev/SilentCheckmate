# Silent Checkmate

A multiplayer chess application that allows users to play chess with each other from different computers, with secure authentication and ELO rating system.

## Features

- Play chess with friends over the internet
- Real-time game synchronization
- Secure authentication with JWT and PostgreSQL
- ELO rating system to track player skill levels
- Match history and leaderboards
- Beautiful and intuitive user interface
- Cross-platform support (Windows, macOS, Linux)
- Web client for playing without installation

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- PostgreSQL (v13 or higher) for the server

### Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/silentcheckmate.git
   cd silentcheckmate
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the server directory based on `.env.example`:
   ```
   cp server/.env.example server/.env
   ```
   Then edit the `.env` file with your PostgreSQL connection details and JWT secrets.

4. Run the application in development mode:
   ```
   npm run dev
   ```
   This will start both the Electron app and the server.

### Building for Distribution

To build the application for your platform:

```
npm run build
```

The packaged application will be available in the `dist` folder.

## How to Play

1. Start the application or visit the web client
2. Register a new account or log in with existing credentials
3. Create a new game or join an existing game using a game ID
4. Share the game ID with your opponent
5. Play chess and earn ELO points for victories!

## Game Controls

- **Create New Game**: Start a new chess game and generate a game ID
- **Join Game**: Join an existing game using a game ID
- **Reset Board**: Reset the chess board to its initial state
- **Resign**: Forfeit the current game
- **Offer Draw**: Propose a draw to your opponent
- **Accept/Decline Draw**: Respond to a draw offer

## Technologies Used

- Electron.js
- React
- Socket.IO / WebSocket
- Express.js
- PostgreSQL
- JWT Authentication
- Argon2 Password Hashing
- chess.js
- react-chessboard

## Deployment

The application can be deployed as:

1. **Desktop Application**: Built with Electron for Windows, macOS, and Linux
2. **Web Application**: Hosted on services like Render or Netlify

See the `server/DEPLOYMENT.md` file for detailed instructions on deploying the server with PostgreSQL integration.

## License

ISC License
