// server.js (ESM)
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS: allow Electron (file://) and your cloud URL
app.use(cors({ origin: true, credentials: true }));

// health check for Render
app.get("/health", (_, res) => res.type("text").send("ok"));

// Serve static files from the public directory
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// API route
app.get("/api", (_, res) => res.json({ name: "SilentCheckmate", ok: true }));

// Root route - serve the web client
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Serve index.html for all other routes (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// create HTTP server + WS server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Store active games
const games = {};
const userSockets = new Map();

// Store rooms for direct chess.js validation
const rooms = new Map(); // gameId -> { chess, sockets:Set }
function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { chess: new Chess(), sockets: new Set() });
  return rooms.get(id);
}

// Helper to send JSON messages
const sendJSON = (socket, data) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(data));
  }
};

// Helper to broadcast to all clients in a game
const broadcastToGame = (gameId, data, excludeSocket = null) => {
  const gameClients = Array.from(wss.clients).filter(
    client => client.gameId === gameId && client !== excludeSocket
  );
  
  gameClients.forEach(client => {
    sendJSON(client, data);
  });
};

// Socket connection handler
wss.on("connection", (socket) => {
  console.log("Client connected");
  
  // Set up keep-alive
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
  
  // Send welcome message
  sendJSON(socket, { 
    type: "CONNECTED", 
    message: "Connected to SilentCheckmate server",
    timestamp: Date.now()
  });
  
  // Handle messages
  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      console.error("Invalid message format:", error);
      return;
    }
    
    // Handle both old and new message formats
    if (message.t) {
      // New format (t, gameId, from, to)
      const msg = message;
      
      if (msg.t === "JOIN" && msg.gameId) {
        const r = getRoom(msg.gameId);
        r.sockets.add(socket);
        socket._room = msg.gameId;
        console.log("JOIN", msg.gameId);
        socket.send(JSON.stringify({ t: "STATE", fen: r.chess.fen(), last: null }));
        return;
      }
      
      if (msg.t === "MOVE" && socket._room && msg.gameId === socket._room) {
        const r = getRoom(socket._room);
        const mv = r.chess.move({ from: msg.from, to: msg.to, promotion: msg.promo || "q" });
        if (!mv) {
          socket.send(JSON.stringify({ t: "ILLEGAL" }));
          return;
        }
        const payload = JSON.stringify({ t: "STATE", fen: r.chess.fen(), last: mv.san });
        console.log("MOVE", socket._room, mv.san);
        for (const s of r.sockets) if (s.readyState === 1) s.send(payload);
        return;
      }
      
      if (msg.t === "PING") socket.send(JSON.stringify({ t: "PONG" }));
      return;
    }
    
    // Original format (type, payload)
    const { type, payload } = message;
    
    // Handle different message types
    switch (type) {
      case "PING":
        sendJSON(socket, { type: "PONG", timestamp: Date.now() });
        break;
        
      case "LOGIN":
        const { username } = payload;
        socket.username = username;
        userSockets.set(username, socket);
        sendJSON(socket, { 
          type: "LOGIN_SUCCESS", 
          payload: { username },
          timestamp: Date.now()
        });
        break;
        
      case "CREATE_GAME":
        const gameId = uuidv4().substring(0, 8);
        socket.gameId = gameId;
        
        // Create new game
        games[gameId] = {
          id: gameId,
          creator: socket.username,
          creatorSocket: socket,
          opponent: null,
          opponentSocket: null,
          game: new Chess(),
          status: "waiting"
        };
        
        sendJSON(socket, { 
          type: "GAME_CREATED", 
          payload: { gameId },
          timestamp: Date.now()
        });
        break;
        
      case "JOIN_GAME":
        const { gameId: joinGameId } = payload;
        
        // Check if game exists
        if (!games[joinGameId]) {
          sendJSON(socket, { 
            type: "ERROR", 
            payload: { message: "Game not found" },
            timestamp: Date.now()
          });
          return;
        }
        
        // Check if game is already full
        if (games[joinGameId].status !== "waiting") {
          sendJSON(socket, { 
            type: "ERROR", 
            payload: { message: "Game is already in progress or completed" },
            timestamp: Date.now()
          });
          return;
        }
        
        // Join the game
        socket.gameId = joinGameId;
        games[joinGameId].opponent = socket.username;
        games[joinGameId].opponentSocket = socket;
        games[joinGameId].status = "playing";
        
        // Notify both players
        sendJSON(socket, { 
          type: "GAME_JOINED", 
          payload: { 
            gameId: joinGameId, 
            creator: games[joinGameId].creator,
            color: "black"
          },
          timestamp: Date.now()
        });
        
        sendJSON(games[joinGameId].creatorSocket, { 
          type: "OPPONENT_JOINED", 
          payload: { 
            gameId: joinGameId, 
            opponent: socket.username,
            color: "white"
          },
          timestamp: Date.now()
        });
        break;
        
      case "MAKE_MOVE":
        const { gameId: moveGameId, move, fen } = payload;
        
        // Check if game exists
        if (!games[moveGameId]) {
          sendJSON(socket, { 
            type: "ERROR", 
            payload: { message: "Game not found" },
            timestamp: Date.now()
          });
          return;
        }
        
        // Update game state
        try {
          games[moveGameId].game = new Chess(fen);
          
          // Broadcast move to all players in the game
          broadcastToGame(moveGameId, {
            type: "MOVE_MADE",
            payload: {
              move,
              fen,
              player: socket.username
            },
            timestamp: Date.now()
          });
          
          // Check if game is over
          if (games[moveGameId].game.isGameOver()) {
            games[moveGameId].status = "completed";
            
            let reason = "unknown";
            if (games[moveGameId].game.isCheckmate()) {
              reason = "checkmate";
            } else if (games[moveGameId].game.isDraw()) {
              reason = "draw";
            } else if (games[moveGameId].game.isStalemate()) {
              reason = "stalemate";
            }
            
            broadcastToGame(moveGameId, {
              type: "GAME_OVER",
              payload: {
                reason,
                winner: socket.username
              },
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error("Error processing move:", error);
          sendJSON(socket, { 
            type: "ERROR", 
            payload: { message: "Invalid move" },
            timestamp: Date.now()
          });
        }
        break;
        
      case "RESIGN":
        const { gameId: resignGameId } = payload;
        
        // Check if game exists
        if (!games[resignGameId]) {
          sendJSON(socket, { 
            type: "ERROR", 
            payload: { message: "Game not found" },
            timestamp: Date.now()
          });
          return;
        }
        
        // Determine the winner
        const winner = socket.username === games[resignGameId].creator 
          ? games[resignGameId].opponent 
          : games[resignGameId].creator;
        
        // Update game status
        games[resignGameId].status = "completed";
        
        // Notify all players
        broadcastToGame(resignGameId, {
          type: "GAME_OVER",
          payload: {
            reason: "resignation",
            winner,
            loser: socket.username
          },
          timestamp: Date.now()
        });
        break;
        
      default:
        console.log("Unknown message type:", type);
    }
  });
  
  // Handle disconnection
  socket.on("close", () => {
    console.log("Client disconnected");
    
    // Remove from user sockets
    if (socket.username) {
      userSockets.delete(socket.username);
    }
    
    // Handle game disconnection
    if (socket.gameId && games[socket.gameId]) {
      const game = games[socket.gameId];
      
      // Determine the disconnected player
      const isCreator = game.creator === socket.username;
      const remainingSocket = isCreator ? game.opponentSocket : game.creatorSocket;
      
      // Only notify if there's another player in the game
      if (remainingSocket) {
        sendJSON(remainingSocket, {
          type: "OPPONENT_DISCONNECTED",
          payload: {
            gameId: socket.gameId,
            opponent: socket.username
          },
          timestamp: Date.now()
        });
      }
      
      // If the game was in progress, mark it as abandoned
      if (game.status === "playing") {
        game.status = "abandoned";
      }
    }
  });
});

// ping clients every 25s so idle connections stay alive
setInterval(() => {
  wss.clients.forEach((socket) => {
    if (!socket.isAlive) return socket.terminate();
    socket.isAlive = false;
    socket.ping();
  });
}, 25000);

// IMPORTANT for Render: listen on process.env.PORT and 0.0.0.0
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default server;
