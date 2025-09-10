const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Simple chess logic for server-side validation
class SimpleChess {
    constructor() {
        this.board = this.getStartingPosition();
        this.turn = 'w';
        this.history = [];
        this.gameStatus = 'active';
        this.check = false;
        this.lastMove = null;
        this.castlingRights = { K: true, Q: true, k: true, q: true };
        this.halfMoveClock = 0;
        this.positions = new Map();
    }

    getStartingPosition() {
        return [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
    }

    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    setPiece(row, col, piece) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return false;
        this.board[row][col] = piece;
        return true;
    }

    positionToString(row, col) {
        return String.fromCharCode(97 + col) + (8 - row);
    }

    stringToPosition(pos) {
        if (!pos || typeof pos !== 'string' || pos.length !== 2) return null;
        const col = pos.charCodeAt(0) - 97;
        const row = 8 - parseInt(pos[1]);
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return [row, col];
    }

    getBoardFEN() {
        let fen = '';
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += piece;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (row < 7) fen += '/';
        }

        fen += ' ' + this.turn;

        let castling = '';
        if (this.castlingRights.K) castling += 'K';
        if (this.castlingRights.Q) castling += 'Q';
        if (this.castlingRights.k) castling += 'k';
        if (this.castlingRights.q) castling += 'q';
        fen += ' ' + (castling || '-');

        let enPassant = '-';
        if (this.lastMove) {
            const [fromRow, fromCol, toRow, toCol] = this.lastMove;
            if (Math.abs(toRow - fromRow) === 2 &&
                (this.board[toRow][toCol] === 'P' || this.board[toRow][toCol] === 'p')) {
                const enPassantRow = fromRow === 1 ? 2 : (fromRow === 6 ? 5 : -1);
                if (enPassantRow !== -1) {
                    enPassant = String.fromCharCode(97 + fromCol) + (8 - enPassantRow);
                }
            }
        }
        fen += ' ' + enPassant;

        fen += ' ' + this.halfMoveClock + ' ' + (Math.floor(this.history.length / 2) + 1);

        return fen;
    }

    loadFromFEN(fen) {
        if (!fen || typeof fen !== 'string') return false;

        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) return false;

        const [boardPart, turnPart, castlingPart, enPassantPart] = parts;
        const halfMovePart = parts[4] || '0';
        const fullMovePart = parts[5] || '1';

        const rows = boardPart.split('/');
        if (rows.length !== 8) return false;

        this.board = [];
        for (let i = 0; i < 8; i++) {
            const row = [];
            let col = 0;

            for (const char of rows[i]) {
                if (char >= '1' && char <= '8') {
                    const emptyCount = parseInt(char);
                    for (let j = 0; j < emptyCount; j++) {
                        row.push(null);
                        col++;
                    }
                } else {
                    row.push(char);
                    col++;
                }
            }

            if (col !== 8) return false;
            this.board.push(row);
        }

        this.turn = turnPart === 'w' ? 'w' : 'b';

        this.castlingRights = { K: false, Q: false, k: false, q: false };
        if (castlingPart !== '-') {
            if (castlingPart.includes('K')) this.castlingRights.K = true;
            if (castlingPart.includes('Q')) this.castlingRights.Q = true;
            if (castlingPart.includes('k')) this.castlingRights.k = true;
            if (castlingPart.includes('q')) this.castlingRights.q = true;
        }

        this.lastMove = null;
        this.halfMoveClock = parseInt(halfMovePart) || 0;
        this.history = [];
        this.gameStatus = 'active';
        this.check = false;
        this.positions = new Map();

        return true;
    }

    reset() {
        this.board = this.getStartingPosition();
        this.turn = 'w';
        this.history = [];
        this.gameStatus = 'active';
        this.check = false;
        this.lastMove = null;
        this.castlingRights = { K: true, Q: true, k: true, q: true };
        this.halfMoveClock = 0;
        this.positions = new Map();
    }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Global game state
let gameState = {
  players: [],
  currentGame: null,
  gameStarted: false,
  currentPlayer: 'white',
  serverGame: null // Server-side game instance for validation
};

// Reset game state
function resetGame() {
  gameState = {
    players: [],
    currentGame: null,
    gameStarted: false,
    currentPlayer: 'white',
    serverGame: null
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

      // Initialize server-side game for validation
      if (typeof SimpleChess !== 'undefined') {
        gameState.serverGame = new SimpleChess();
        gameState.serverGame.loadFromFEN(gameState.currentGame);
      }

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

    // Update server-side game state with the new FEN
    if (gameState.serverGame && moveData.fen) {
      const fenLoaded = gameState.serverGame.loadFromFEN(moveData.fen);
      if (!fenLoaded) {
        console.error('Failed to load FEN:', moveData.fen);
        socket.emit('error', 'Invalid game state');
        return;
      }
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
      promotedTo: moveData.promotedTo,
      capturedPiece: moveData.capturedPiece,
      isEnPassant: moveData.isEnPassant
    };

    // Broadcast move to ALL players in the lobby, including the sender
    io.to('game-lobby').emit('move-update', broadcastMove);

    // Handle game end conditions
    if (moveData.isCheckmate || moveData.isStalemate || moveData.isDraw) {
      gameState.gameStarted = false; // Mark game as ended

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

    console.log(`Move made: ${moveData.from} to ${moveData.to}, FEN: ${moveData.fen}`);
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

// Return app version from package.json
app.get('/version', (req, res) => {
  try {
    const pkg = require(path.join(__dirname, 'package.json'));
    res.json({ version: pkg.version });
  } catch (err) {
    res.status(500).json({ error: 'Unable to read version' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
