# Silent Checkmate

A multiplayer chess application that allows users to play chess with each other from different computers.

## Features

- Play chess with friends over the internet
- Real-time game synchronization
- Simple user authentication
- Beautiful and intuitive user interface
- Cross-platform support (Windows, macOS, Linux)

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

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

3. Run the application in development mode:
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

1. Start the application
2. Enter a username to log in
3. Create a new game or join an existing game using a game ID
4. Share the game ID with your opponent
5. Play chess!

## Game Controls

- **Create New Game**: Start a new chess game and generate a game ID
- **Join Game**: Join an existing game using a game ID
- **Reset Board**: Reset the chess board to its initial state
- **Resign**: Forfeit the current game

## Technologies Used

- Electron.js
- React
- Socket.IO
- chess.js
- react-chessboard

## License

ISC License
