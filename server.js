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

  // Clean up any stale connections
  const staleConnections = gameState.players.filter(p => {
    const clientSocket = io.sockets.sockets.get(p.id);
    return !clientSocket || !clientSocket.connected;
  });

  if (staleConnections.length > 0) {
    console.log('Cleaning up stale connections:', staleConnections.map(p => p.id));
    gameState.players = gameState.players.filter(p => {
      const clientSocket = io.sockets.sockets.get(p.id);
      return clientSocket && clientSocket.connected;
    });

    if (gameState.players.length === 0) {
      resetGame();
      console.log('Game reset due to all stale connections');
    }
  }

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

    // Handle pawn promotion request
    if (moveData.needsPromotion) {
      socket.emit('promotion-required');
      return;
    }

    // Update game state
    gameState.currentGame = moveData.fen;
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    // Validate move data before broadcasting
    const broadcastMove = {
      from: moveData.from,
      to: moveData.to,
      piece: moveData.piece,
      fen: moveData.fen,
      currentPlayer: gameState.currentPlayer,
      isCheck: Boolean(moveData.isCheck),
      isCheckmate: Boolean(moveData.isCheckmate),
      isStalemate: Boolean(moveData.isStalemate),
      isDraw: Boolean(moveData.isDraw),
      gameStatus: moveData.gameStatus || 'active',
      promotedTo: moveData.promotedTo
    };

    // Broadcast move to ALL players in the lobby, including the sender
    io.to('game-lobby').emit('move-update', broadcastMove);

    // Handle game end conditions
    if (moveData.isCheckmate || moveData.isStalemate || moveData.isDraw) {
      io.to('game-lobby').emit('game-over', {
        type: moveData.isCheckmate ? 'checkmate' :
          moveData.isStalemate ? 'stalemate' :
            moveData.gameStatus,
        winner: moveData.isCheckmate ? player.color : null
      });

      // Reset the game state after a delay
      setTimeout(() => {
        resetGame();
        io.to('game-lobby').emit('game-reset');
      }, 5000);
    }

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

  // Handle player explicitly leaving the game
  socket.on('leave-game', () => {
    handlePlayerLeaving(socket);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    handlePlayerLeaving(socket);
  });
});

// Function to handle player leaving (either through disconnect or explicit leave)
function handlePlayerLeaving(socket) {
  // First, remove any disconnected sockets from players array
  gameState.players = gameState.players.filter(p => {
    const clientSocket = io.sockets.sockets.get(p.id);
    if (p.id === socket.id || !clientSocket || !clientSocket.connected) {
      console.log(`Removing player ${p.id} (${p.color})`);
      return false;
    }
    return true;
  });

  console.log(`Players remaining after cleanup: ${gameState.players.length}`);

  // Notify remaining players if game was in progress
  if (gameState.gameStarted) {
    io.to('game-lobby').emit('opponent-left');
    gameState.gameStarted = false;
  }

  // Only fully reset if no players left
  if (gameState.players.length === 0) {
    resetGame();
    console.log('Game fully reset - no players remaining');
  }

  socket.leave('game-lobby');
}

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