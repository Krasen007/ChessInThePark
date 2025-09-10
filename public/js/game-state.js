
// Simple chess logic
class SimpleChess {
    constructor() {
        this.board = this.getStartingPosition();
        this.turn = 'w';
        this.history = [];
        this.gameStatus = 'active'; // active, checkmate, stalemate
        this.check = false;
        this.lastMove = null;
        this.castlingRights = { K: true, Q: true, k: true, q: true };
        this.halfMoveClock = 0;
        this.positions = new Map(); // For threefold repetition
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
        return this.board[row][col];
    }

    setPiece(row, col, piece) {
        this.board[row][col] = piece;
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return false;

        // Check if it's the right player's turn
        const isWhite = piece === piece.toUpperCase();
        if ((isWhite && this.turn !== 'w') || (!isWhite && this.turn !== 'b')) {
            return false;
        }

        // Use ChessRules to validate the move
        if (!ChessRules.isValidMove(piece, fromRow, fromCol, toRow, toCol, this.board, this.lastMove, this.castlingRights)) {
            return false;
        }

        // Test if move would leave king in check
        const tempPiece = this.board[toRow][toCol];
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        const inCheck = ChessRules.isInCheck(this.board, isWhite);

        // Undo test move
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = tempPiece;

        return !inCheck;
    }

    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        let piece = this.getPiece(fromRow, fromCol);
        if (!piece) {
            return false;
        }

        const isWhite = piece === piece.toUpperCase();
        const pieceType = piece.toLowerCase();
        const targetPiece = this.getPiece(toRow, toCol);

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

            // First check if castling is allowed
            const castlingSide = isKingside ? 'kingside' : 'queenside';
            if (!ChessRules.canCastle(isWhite, castlingSide, this.board, this.castlingRights)) {
                return false;
            }

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

            // Switch turns for castling
            this.turn = this.turn === 'w' ? 'b' : 'w';

            const move = {
                from: this.positionToString(fromRow, fromCol),
                to: this.positionToString(toRow, toCol),
                piece: piece,
                capturedPiece: null,
                isEnPassant: false,
                isCheck: false,
                isCheckmate: false,
                isStalemate: false,
                isDraw: false
            };

            this.history.push(move);
            return move;
        }

        // Handle en passant capture
        if (pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !targetPiece) {
            const captureRow = isWhite ? toRow + 1 : toRow - 1;
            this.setPiece(captureRow, toCol, null);
        }

        // Make the move
        this.setPiece(toRow, toCol, piece);
        this.setPiece(fromRow, fromCol, null);

        // Handle pawn promotion
        if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
            // Make the initial pawn move
            this.setPiece(toRow, toCol, piece);
            this.setPiece(fromRow, fromCol, null);

            // Automatically promote to queen
            const promotedPiece = isWhite ? 'Q' : 'q';
            this.setPiece(toRow, toCol, promotedPiece);
            piece = promotedPiece;  // Update piece for move history

            // Update game state
            this.lastMove = [fromRow, fromCol, toRow, toCol];
            const position = this.getBoardFEN();
            this.positions.set(position, (this.positions.get(position) || 0) + 1);

            // Switch turns
            this.turn = this.turn === 'w' ? 'b' : 'w';

            // Create and return the move object
            const move = {
                from: this.positionToString(fromRow, fromCol),
                to: this.positionToString(toRow, toCol),
                piece: piece,
                capturedPiece: targetPiece,
                isEnPassant: pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !targetPiece,
                isCheck: this.check,
                isCheckmate: this.gameStatus === 'checkmate',
                isStalemate: this.gameStatus === 'stalemate',
                isDraw: this.gameStatus.startsWith('draw-'),
                promotedTo: promotedPiece
            };
            this.history.push(move);
            return move;
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

        // Store last move for en passant
        this.lastMove = [fromRow, fromCol, toRow, toCol];

        // Update position history for threefold repetition
        const position = this.getBoardFEN();
        this.positions.set(position, (this.positions.get(position) || 0) + 1);

        // Switch turns
        this.turn = this.turn === 'w' ? 'b' : 'w';

        // Check game status
        const nextIsWhite = this.turn === 'w';
        this.check = ChessRules.isInCheck(this.board, nextIsWhite);

        // Check for game end conditions
        if (!ChessRules.hasLegalMoves(this.board, nextIsWhite, this.lastMove, this.castlingRights)) {
            if (this.check) {
                this.gameStatus = 'checkmate';
            } else {
                this.gameStatus = 'stalemate';
            }
        } else if (this.halfMoveClock >= 100) {
            this.gameStatus = 'draw-fifty';
        } else if (this.isThreefoldRepetition()) {
            this.gameStatus = 'draw-repetition';
        }

        const move = {
            from: this.positionToString(fromRow, fromCol),
            to: this.positionToString(toRow, toCol),
            piece: piece,
            capturedPiece: targetPiece,
            isEnPassant: pieceType === 'p' && Math.abs(toCol - fromCol) === 1 && !targetPiece,
            isCheck: this.check,
            isCheckmate: this.gameStatus === 'checkmate',
            isStalemate: this.gameStatus === 'stalemate',
            isDraw: this.gameStatus.startsWith('draw-'),
            promotedTo: promotionPiece
        };

        this.history.push(move);
        return move;
    }

    positionToString(row, col) {
        return String.fromCharCode(97 + col) + (8 - row);
    }

    stringToPosition(pos) {
        if (!pos || typeof pos !== 'string' || pos.length !== 2) return null;
        const col = pos.charCodeAt(0) - 97;
        const row = 8 - parseInt(pos[1]);
        // Validate coordinates are within board bounds
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return [row, col];
    }

    getBoardFEN() {
        // Generate board position part of FEN
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

        // Add turn indicator
        fen += ' ' + this.turn;

        // Add castling rights
        let castling = '';
        if (this.castlingRights.K) castling += 'K';
        if (this.castlingRights.Q) castling += 'Q';
        if (this.castlingRights.k) castling += 'k';
        if (this.castlingRights.q) castling += 'q';
        fen += ' ' + (castling || '-');

        // Add en passant square - properly calculate based on last pawn double move
        let enPassant = '-';
        if (this.lastMove) {
            const [fromRow, fromCol, toRow, toCol] = this.lastMove;
            const piece = this.board[toRow][toCol];
            // Check if it was a pawn moving two squares
            if (Math.abs(toRow - fromRow) === 2 && piece &&
                piece.toLowerCase() === 'p') {
                // En passant square is the square the pawn passed over
                const enPassantRow = fromRow === 1 ? 2 : (fromRow === 6 ? 5 : -1);
                if (enPassantRow !== -1) {
                    enPassant = String.fromCharCode(97 + fromCol) + (8 - enPassantRow);
                }
            }
        }
        fen += ' ' + enPassant;

        // Add halfmove clock and fullmove number
        fen += ' ' + this.halfMoveClock + ' ' + Math.ceil(this.history.length / 2 + 1);

        return fen;
    }

    isThreefoldRepetition() {
        const currentPosition = this.getBoardFEN();
        return this.positions.get(currentPosition) >= 3;
    }

    // Generate Standard Algebraic Notation for a move
    generateSAN(move) {
        if (!move || !move.from || !move.to) return '';

        const fromPos = this.stringToPosition(move.from);
        const toPos = this.stringToPosition(move.to);
        if (!fromPos || !toPos) return '';

        const [fromRow, fromCol] = fromPos;
        const [toRow, toCol] = toPos;
        const piece = move.piece;

        // Determine if this was a capture
        const isCapture = move.capturedPiece !== null || move.isEnPassant;

        let san = '';

        // Handle castling
        if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
            san = toCol > fromCol ? 'O-O' : 'O-O-O';
        } else {
            // Piece symbol (except for pawns)
            if (piece.toLowerCase() !== 'p') {
                san += piece.toUpperCase();
            }

            // For pawns, always include the file when capturing
            if (piece.toLowerCase() === 'p' && isCapture) {
                san += move.from[0]; // file of pawn
            }

            // Check for disambiguation (if multiple pieces of same type can move to same square)
            if (piece.toLowerCase() !== 'p') {
                const samePieces = [];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = this.getPiece(r, c);
                        if (p && p.toLowerCase() === piece.toLowerCase() && p === piece &&
                            !(r === fromRow && c === fromCol) &&
                            this.isValidMove(r, c, toRow, toCol)) {
                            samePieces.push([r, c]);
                        }
                    }
                }

                if (samePieces.length > 0) {
                    // Check if file disambiguation is sufficient
                    const sameFile = samePieces.some(([r, c]) => c === fromCol);
                    const sameRank = samePieces.some(([r, c]) => r === fromRow);

                    if (!sameFile) {
                        san += move.from[0]; // file letter
                    } else if (!sameRank) {
                        san += move.from[1]; // rank number
                    } else {
                        san += move.from; // full coordinate
                    }
                }
            }

            // Capture indicator
            if (isCapture) {
                san += 'x';
            }

            // Destination square
            san += move.to;

            // Pawn promotion
            if (move.promotedTo) {
                san += '=' + move.promotedTo.toUpperCase();
            }
        }

        // Check/checkmate indicators
        if (move.isCheckmate) {
            san += '#';
        } else if (move.isCheck) {
            san += '+';
        }

        return san;
    }

    // Load board state from FEN string
    loadFromFEN(fen) {
        if (!fen || typeof fen !== 'string') return false;

        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) return false;

        const [boardPart, turnPart, castlingPart, enPassantPart] = parts;
        const halfMovePart = parts[4] || '0';
        const fullMovePart = parts[5] || '1';

        // Parse board position
        const rows = boardPart.split('/');
        if (rows.length !== 8) return false;

        this.board = [];
        for (let i = 0; i < 8; i++) {
            const row = [];
            let col = 0;

            for (const char of rows[i]) {
                if (char >= '1' && char <= '8') {
                    // Empty squares
                    const emptyCount = parseInt(char);
                    for (let j = 0; j < emptyCount; j++) {
                        row.push(null);
                        col++;
                    }
                } else {
                    // Piece
                    row.push(char);
                    col++;
                }
            }

            if (col !== 8) return false;
            this.board.push(row);
        }

        // Parse turn
        this.turn = turnPart === 'w' ? 'w' : 'b';

        // Parse castling rights
        this.castlingRights = { K: false, Q: false, k: false, q: false };
        if (castlingPart !== '-') {
            if (castlingPart.includes('K')) this.castlingRights.K = true;
            if (castlingPart.includes('Q')) this.castlingRights.Q = true;
            if (castlingPart.includes('k')) this.castlingRights.k = true;
            if (castlingPart.includes('q')) this.castlingRights.q = true;
        }

        // Parse en passant square
        this.lastMove = null;
        if (enPassantPart !== '-') {
            // We don't need to store en passant for FEN loading, but we could use it for validation
        }

        // Parse halfmove clock
        this.halfMoveClock = parseInt(halfMovePart) || 0;

        // Reset other state
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
