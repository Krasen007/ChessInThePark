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

    // Check if a king is in check
    isInCheck(isWhiteKing) {
        // Find the king
        let kingRow, kingCol;
        const kingPiece = isWhiteKing ? 'K' : 'k';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.board[row][col] === kingPiece) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== undefined) break;
        }

        if (kingRow === undefined) return false;

        // Check if any opponent's piece can capture the king
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece || (isWhiteKing === (piece === piece.toUpperCase()))) continue;

                if (this.isValidPieceMove(piece, row, col, kingRow, kingCol)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Complete chess rules validation
    isValidPieceMove(piece, fromRow, fromCol, toRow, toCol) {
        const pieceType = piece.toLowerCase();
        const isWhite = piece === piece.toUpperCase();
        const deltaRow = toRow - fromRow;
        const deltaCol = toCol - fromCol;
        const absDeltaRow = Math.abs(deltaRow);
        const absDeltaCol = Math.abs(deltaCol);

        // Basic validation
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

        const targetPiece = this.board[toRow][toCol];
        if (targetPiece && (isWhite === (targetPiece === targetPiece.toUpperCase()))) {
            return false; // Can't capture own piece
        }

        // Check castling
        if (pieceType === 'k' && absDeltaCol === 2 && deltaRow === 0) {
            const castlingSide = deltaCol > 0 ? 'kingside' : 'queenside';
            return this.canCastle(isWhite, castlingSide);
        }

        switch (pieceType) {
            case 'p': // Pawn
                if (isWhite) {
                    // White pawns move up (negative row direction)
                    if (deltaCol === 0 && !targetPiece) {
                        if (deltaRow === -1) return true;
                        if (fromRow === 6 && deltaRow === -2 && !this.board[fromRow - 1][fromCol]) return true;
                    }
                    // Regular capture diagonally
                    if (absDeltaCol === 1 && deltaRow === -1 && targetPiece) return true;
                    // En passant capture
                    if (absDeltaCol === 1 && deltaRow === -1 && !targetPiece && this.lastMove) {
                        const [lFromRow, lFromCol, lToRow, lToCol] = this.lastMove;
                        if (this.board[toRow + 1][toCol] === 'p' && // Black pawn
                            lFromRow === 1 && lToRow === 3 && // Moved two squares
                            lToCol === toCol && // Same column as capture
                            lFromCol === toCol) { // Started from that column
                            return true;
                        }
                    }
                } else {
                    // Black pawns move down (positive row direction)
                    if (deltaCol === 0 && !targetPiece) {
                        if (deltaRow === 1) return true;
                        if (fromRow === 1 && deltaRow === 2 && !this.board[fromRow + 1][fromCol]) return true;
                    }
                    // Regular capture diagonally
                    if (absDeltaCol === 1 && deltaRow === 1 && targetPiece) return true;
                    // En passant capture
                    if (absDeltaCol === 1 && deltaRow === 1 && !targetPiece && this.lastMove) {
                        const [lFromRow, lFromCol, lToRow, lToCol] = this.lastMove;
                        if (this.board[toRow - 1][toCol] === 'P' && // White pawn
                            lFromRow === 6 && lToRow === 4 && // Moved two squares
                            lToCol === toCol && // Same column as capture
                            lFromCol === toCol) { // Started from that column
                            return true;
                        }
                    }
                }
                return false;

            case 'r': // Rook
                return (deltaRow === 0 || deltaCol === 0) &&
                    this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'n': // Knight
                return (absDeltaRow === 2 && absDeltaCol === 1) ||
                    (absDeltaRow === 1 && absDeltaCol === 2);

            case 'b': // Bishop
                return absDeltaRow === absDeltaCol &&
                    this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'q': // Queen
                return (deltaRow === 0 || deltaCol === 0 || absDeltaRow === absDeltaCol) &&
                    this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'k': // King
                return absDeltaRow <= 1 && absDeltaCol <= 1;
        }
        return false;
    }

    // Check if path is clear between two squares
    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;

        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        return true;
    }

    // Complete castling validation with all conditions
    canCastle(isWhite, side) {
        const row = isWhite ? 7 : 0;
        const king = isWhite ? 'K' : 'k';
        const rook = isWhite ? 'R' : 'r';

        // Check if the king and rook are in their original positions
        if (this.board[row][4] !== king) return false;

        if (side === 'kingside') {
            if (!this.castlingRights[isWhite ? 'K' : 'k']) return false;
            if (this.board[row][7] !== rook) return false;
            // Check if squares between king and rook are empty
            if (this.board[row][5] || this.board[row][6]) return false;
            // Check if king is in check
            if (this.isInCheck(isWhite)) return false;
            // Check if king passes through or ends in check
            if (this.isSquareAttacked(row, 5, isWhite) || this.isSquareAttacked(row, 6, isWhite)) return false;
            return true;
        } else {
            if (!this.castlingRights[isWhite ? 'Q' : 'q']) return false;
            if (this.board[row][0] !== rook) return false;
            // Check if squares between king and rook are empty
            if (this.board[row][1] || this.board[row][2] || this.board[row][3]) return false;
            // Check if king is in check
            if (this.isInCheck(isWhite)) return false;
            // Check if king passes through or ends in check
            if (this.isSquareAttacked(row, 2, isWhite) || this.isSquareAttacked(row, 3, isWhite)) return false;
            return true;
        }
    }

    // Check if a square is attacked by the opponent
    isSquareAttacked(row, col, isWhiteKing) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece || (isWhiteKing === (piece === piece.toUpperCase()))) continue;
                if (this.isValidPieceMove(piece, r, c, row, col)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Check if the current player has any legal moves
    hasLegalMoves(isWhiteTurn) {
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (!piece || (isWhiteTurn !== (piece === piece.toUpperCase()))) continue;

                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Validate if a move is legal (includes check validation)
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return false;

        // Check if it's the right player's turn
        const isWhite = piece === piece.toUpperCase();
        if ((isWhite && this.turn !== 'w') || (!isWhite && this.turn !== 'b')) {
            return false;
        }

        // Use piece movement validation
        if (!this.isValidPieceMove(piece, fromRow, fromCol, toRow, toCol)) {
            return false;
        }

        // Test if move would leave king in check
        const tempPiece = this.board[toRow][toCol];
        const originalPiece = this.board[fromRow][fromCol];
        
        // Handle en passant capture for test move
        let enPassantCaptured = null;
        const pieceType = piece.toLowerCase();
        if (pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !tempPiece) {
            const captureRow = isWhite ? toRow + 1 : toRow - 1;
            enPassantCaptured = this.board[captureRow][toCol];
            this.board[captureRow][toCol] = null;
        }

        // Make test move
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(isWhite);

        // Undo test move
        this.board[fromRow][fromCol] = originalPiece;
        this.board[toRow][toCol] = tempPiece;
        
        // Restore en passant captured piece
        if (enPassantCaptured) {
            const captureRow = isWhite ? toRow + 1 : toRow - 1;
            this.board[captureRow][toCol] = enPassantCaptured;
        }

        return !inCheck;
    }

    // Make a move and update game state
    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        let piece = this.getPiece(fromRow, fromCol);
        if (!piece) return false;

        const isWhite = piece === piece.toUpperCase();
        const pieceType = piece.toLowerCase();
        const targetPiece = this.getPiece(toRow, toCol);

        // Validate the move
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) {
            return false;
        }

        // Update halfmove clock
        if (pieceType === 'p' || targetPiece) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // Handle castling
        if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
            const row = isWhite ? 7 : 0;
            const isKingside = toCol > fromCol;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? 5 : 3;
            const rook = isWhite ? 'R' : 'r';

            // Move both the king and rook
            this.setPiece(toRow, toCol, piece);
            this.setPiece(fromRow, fromCol, null);
            this.setPiece(row, rookToCol, rook);
            this.setPiece(row, rookFromCol, null);

            // Update castling rights
            if (isWhite) {
                this.castlingRights.K = false;
                this.castlingRights.Q = false;
            } else {
                this.castlingRights.k = false;
                this.castlingRights.q = false;
            }
        } else {
            // Handle en passant capture
            if (pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !targetPiece) {
                const captureRow = isWhite ? toRow + 1 : toRow - 1;
                this.setPiece(captureRow, toCol, null);
            }

            // Make the regular move
            this.setPiece(toRow, toCol, piece);
            this.setPiece(fromRow, fromCol, null);

            // Handle pawn promotion
            if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
                // Automatically promote to queen
                const promotedPiece = isWhite ? 'Q' : 'q';
                this.setPiece(toRow, toCol, promotedPiece);
                piece = promotedPiece;
            }

            // Update castling rights
            if (pieceType === 'k') {
                if (isWhite) {
                    this.castlingRights.K = false;
                    this.castlingRights.Q = false;
                } else {
                    this.castlingRights.k = false;
                    this.castlingRights.q = false;
                }
            } else if (pieceType === 'r') {
                if (fromRow === 7 && fromCol === 0) this.castlingRights.Q = false;
                if (fromRow === 7 && fromCol === 7) this.castlingRights.K = false;
                if (fromRow === 0 && fromCol === 0) this.castlingRights.q = false;
                if (fromRow === 0 && fromCol === 7) this.castlingRights.k = false;
            }
        }

        // Store last move for en passant
        this.lastMove = [fromRow, fromCol, toRow, toCol];

        // Switch turns
        this.turn = this.turn === 'w' ? 'b' : 'w';

        // Check game status AFTER the move
        const nextIsWhite = this.turn === 'w';
        this.check = this.isInCheck(nextIsWhite);

        return {
            from: this.positionToString(fromRow, fromCol),
            to: this.positionToString(toRow, toCol),
            piece: piece,
            capturedPiece: targetPiece,
            isCheck: this.check,
            promotedTo: pieceType === 'p' && (toRow === 0 || toRow === 7) ? piece : null,
            isEnPassant: pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !targetPiece
        };
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

    // Validate move data
    if (!moveData.from || !moveData.to || !moveData.piece) {
      socket.emit('error', 'Invalid move data');
      return;
    }

    // Parse move positions
    const fromPos = gameState.serverGame.stringToPosition(moveData.from);
    const toPos = gameState.serverGame.stringToPosition(moveData.to);
    
    if (!fromPos || !toPos) {
      socket.emit('error', 'Invalid move positions');
      return;
    }

    const [fromRow, fromCol] = fromPos;
    const [toRow, toCol] = toPos;

    // Validate the move using server-side game logic
    if (!gameState.serverGame.isValidMove(fromRow, fromCol, toRow, toCol)) {
      socket.emit('error', 'Invalid move');
      return;
    }

    // Make the move on the server
    const moveResult = gameState.serverGame.makeMove(fromRow, fromCol, toRow, toCol);
    if (!moveResult) {
      socket.emit('error', 'Move failed');
      return;
    }

    // Update game state
    gameState.currentGame = gameState.serverGame.getBoardFEN();
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    // Create validated move data for broadcast
    const broadcastMove = {
      from: moveResult.from,
      to: moveResult.to,
      piece: moveResult.piece,
      fen: gameState.currentGame,
      currentPlayer: gameState.currentPlayer,
      isCheck: Boolean(moveResult.isCheck),
      isCheckmate: Boolean(moveData.isCheckmate), // Client still handles checkmate detection
      isStalemate: Boolean(moveData.isStalemate), // Client still handles stalemate detection
      isDraw: Boolean(moveData.isDraw),
      gameStatus: moveData.gameStatus || 'active',
      promotedTo: moveResult.promotedTo,
      capturedPiece: moveResult.capturedPiece,
      isEnPassant: Boolean(moveResult.isEnPassant)
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

    console.log(`Move validated and made: ${moveResult.from} to ${moveResult.to}, FEN: ${gameState.currentGame}`);
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
