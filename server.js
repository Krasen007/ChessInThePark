const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Global game state
let gameState = {
  players: [],
  currentGame: null,
  gameStarted: false,
  currentPlayer: 'white'
};

// Reset game state
function resetGame() {
  gameState = {
    players: [],
    currentGame: null,
    gameStarted: false,
    currentPlayer: 'white'
  };
}

// Socket connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle joining the multiplayer lobby
  socket.on('join-lobby', () => {
    // Check if lobby is full
    if (gameState.players.length >= 2) {
      socket.emit('lobby-full');
      return;
    }

    // Add player to lobby
    const playerColor = gameState.players.length === 0 ? 'white' : 'black';
    const player = {
      id: socket.id,
      color: playerColor
    };

    gameState.players.push(player);
    socket.join('game-lobby');

    console.log(`Player joined as ${playerColor}. Total players: ${gameState.players.length}`);

    if (gameState.players.length === 1) {
      // First player - waiting for opponent
      socket.emit('waiting-for-opponent');
    } else if (gameState.players.length === 2) {
      // Second player joined - start game
      gameState.gameStarted = true;
      gameState.currentGame = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Starting FEN
      
      // Notify both players
      io.to('game-lobby').emit('game-start', {
        players: gameState.players,
        fen: gameState.currentGame,
        currentPlayer: gameState.currentPlayer
      });

      console.log('Game started with 2 players');
    }
  });

  // Handle chess moves
  socket.on('make-move', (moveData) => {
    if (!gameState.gameStarted) {
      socket.emit('error', 'Game not started');
      return;
    }

    // Find the player making the move
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    // Check if it's the player's turn
    if (player.color !== gameState.currentPlayer) {
      socket.emit('error', 'Not your turn');
      return;
    }

    // Update game state (we'll validate with chess.js on client side for now)
    gameState.currentGame = moveData.fen;
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    // Broadcast move to all players in the lobby
    socket.to('game-lobby').emit('opponent-move', {
      from: moveData.from,
      to: moveData.to,
      fen: moveData.fen,
      currentPlayer: gameState.currentPlayer
    });

    console.log(`Move made: ${moveData.from} to ${moveData.to}`);
  });

  // Handle game over
  socket.on('game-over', (result) => {
    if (gameState.gameStarted) {
      io.to('game-lobby').emit('game-ended', result);
      console.log('Game ended:', result);
      
      // Reset after a delay
      setTimeout(() => {
        resetGame();
        console.log('Game state reset');
      }, 5000);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove player from game
    const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const disconnectedPlayer = gameState.players[playerIndex];
      gameState.players.splice(playerIndex, 1);

      console.log(`Player ${disconnectedPlayer.color} disconnected`);

      if (gameState.gameStarted) {
        // Notify remaining player that opponent left
        socket.to('game-lobby').emit('opponent-left');
      }

      // Reset game if no players left or game was in progress
      if (gameState.players.length === 0 || gameState.gameStarted) {
        resetGame();
        console.log('Game reset due to disconnection');
      }
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});