# SilentCheckmate Server

This is the server component for the SilentCheckmate chess application. It handles multiplayer game sessions, move validation, and real-time communication between players.

## Features

- WebSocket-based real-time communication
- Game creation and joining
- Chess move validation using chess.js
- Keep-alive mechanism for Render free tier
- Health check endpoint

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

## Environment Variables

Create a `.env` file based on `.env.example` to configure:

- `PORT`: The port to run the server on (defaults to 3001)

## Deployment

This server is designed to be deployed on Render's free tier. When deploying:

1. Connect your GitHub repository to Render
2. Select the `/server` directory as the root
3. Use `npm start` as the start command
4. Add any necessary environment variables in the Render dashboard

## API Endpoints

- `GET /health`: Health check endpoint (returns "ok")
- `GET /`: Basic info endpoint (returns JSON with app name)
- WebSocket endpoint at `/ws`: Handles all game communication

## WebSocket Protocol

The server uses a JSON-based message protocol with the following structure:

```json
{
  "type": "MESSAGE_TYPE",
  "payload": {
    // Message-specific data
  },
  "timestamp": 1629123456789
}
```

### Message Types

- `PING`/`PONG`: Keep-alive messages
- `LOGIN`: Authenticate with username
- `CREATE_GAME`: Create a new chess game
- `JOIN_GAME`: Join an existing game by ID
- `MAKE_MOVE`: Make a chess move
- `RESIGN`: Resign from a game
- `GAME_OVER`: Notification of game completion

## License

MIT
