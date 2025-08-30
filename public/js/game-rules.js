// Chess piece movement rules and validation
class ChessRules {
    static isValidMove(piece, fromRow, fromCol, toRow, toCol, board, lastMove = null, castlingRights = null) {
        const pieceType = piece.toLowerCase();
        const isWhite = piece === piece.toUpperCase();
        const deltaRow = toRow - fromRow;
        const deltaCol = toCol - fromCol;
        const absDeltaRow = Math.abs(deltaRow);
        const absDeltaCol = Math.abs(deltaCol);

        // Check castling
        if (pieceType === 'k' && absDeltaCol === 2 && deltaRow === 0) {
            if (!castlingRights) return false;
            const castlingSide = deltaCol > 0 ? 'kingside' : 'queenside';
            const row = isWhite ? 7 : 0;

            if (!ChessRules.canCastle(isWhite, castlingSide, board, castlingRights)) {
                return false;
            }

            // Check if king passes through check
            const intermediateCol = fromCol + (deltaCol > 0 ? 1 : -1);
            const tempBoard = board.map(row => [...row]);
            tempBoard[row][intermediateCol] = piece;
            tempBoard[row][fromCol] = null;
            if (ChessRules.isInCheck(tempBoard, isWhite)) {
                return false;
            }

            return true;
        }

        // Basic validation for all pieces
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

        const targetPiece = board[toRow][toCol];
        if (targetPiece && (isWhite === (targetPiece === targetPiece.toUpperCase()))) {
            return false; // Can't capture own piece
        }

        switch (pieceType) {
            case 'p': // Pawn
                if (isWhite) {
                    // White pawns move up (negative row direction)
                    if (deltaCol === 0 && !targetPiece) {
                        if (deltaRow === -1) return true;
                        if (fromRow === 6 && deltaRow === -2 && !board[fromRow - 1][fromCol]) return true;
                    }
                    // Regular capture diagonally
                    if (absDeltaCol === 1 && deltaRow === -1 && targetPiece) return true;
                    // En passant capture
                    if (absDeltaCol === 1 && deltaRow === -1 && !targetPiece && lastMove) {
                        const [lFromRow, lFromCol, lToRow, lToCol] = lastMove;
                        if (board[toRow + 1][toCol] === 'p' && // Black pawn
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
                        if (fromRow === 1 && deltaRow === 2 && !board[fromRow + 1][fromCol]) return true;
                    }
                    // Regular capture diagonally
                    if (absDeltaCol === 1 && deltaRow === 1 && targetPiece) return true;
                    // En passant capture
                    if (absDeltaCol === 1 && deltaRow === 1 && !targetPiece && lastMove) {
                        const [lFromRow, lFromCol, lToRow, lToCol] = lastMove;
                        if (board[toRow - 1][toCol] === 'P' && // White pawn
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
                    ChessRules.isPathClear(fromRow, fromCol, toRow, toCol, board);

            case 'n': // Knight
                return (absDeltaRow === 2 && absDeltaCol === 1) ||
                    (absDeltaRow === 1 && absDeltaCol === 2);

            case 'b': // Bishop
                return absDeltaRow === absDeltaCol &&
                    ChessRules.isPathClear(fromRow, fromCol, toRow, toCol, board);

            case 'q': // Queen
                return (deltaRow === 0 || deltaCol === 0 || absDeltaRow === absDeltaCol) &&
                    ChessRules.isPathClear(fromRow, fromCol, toRow, toCol, board);

            case 'k': // King
                return absDeltaRow <= 1 && absDeltaCol <= 1;
        }
        return false;
    }

    static isPathClear(fromRow, fromCol, toRow, toCol, board) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;

        while (currentRow !== toRow || currentCol !== toCol) {
            if (board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        return true;
    }

    static isInCheck(board, isWhiteKing) {
        // Find the king
        let kingRow, kingCol;
        const kingPiece = isWhiteKing ? 'K' : 'k';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (board[row][col] === kingPiece) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== undefined) break;
        }

        // Check if any opponent's piece can capture the king
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (!piece || (isWhiteKing === (piece === piece.toUpperCase()))) continue;

                if (ChessRules.isValidMove(piece, row, col, kingRow, kingCol, board)) {
                    return true;
                }
            }
        }
        return false;
    }

    static canCastle(isWhite, side, board, castlingRights) {
        const row = isWhite ? 7 : 0;
        const king = isWhite ? 'K' : 'k';
        const rook = isWhite ? 'R' : 'r';

        // Check if the king and rook are in their original positions
        if (board[row][4] !== king) return false;

        if (side === 'kingside') {
            if (!castlingRights[isWhite ? 'K' : 'k']) return false;
            if (board[row][7] !== rook) return false;
            // Check if squares between king and rook are empty
            return !board[row][5] && !board[row][6] &&
                !ChessRules.isInCheck(board, isWhite) &&
                !ChessRules.isSquareAttacked(row, 5, board, isWhite) &&
                !ChessRules.isSquareAttacked(row, 6, board, isWhite);
        } else {
            if (!castlingRights[isWhite ? 'Q' : 'q']) return false;
            if (board[row][0] !== rook) return false;
            // Check if squares between king and rook are empty
            return !board[row][1] && !board[row][2] && !board[row][3] &&
                !ChessRules.isInCheck(board, isWhite) &&
                !ChessRules.isSquareAttacked(row, 2, board, isWhite) &&
                !ChessRules.isSquareAttacked(row, 3, board, isWhite);
        }
    }

    static isSquareAttacked(row, col, board, isWhiteKing) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece || (isWhiteKing === (piece === piece.toUpperCase()))) continue;
                if (ChessRules.isValidMove(piece, r, c, row, col, board)) {
                    return true;
                }
            }
        }
        return false;
    }

    static hasLegalMoves(board, isWhiteTurn) {
        // Check if the current player has any legal moves
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = board[fromRow][fromCol];
                if (!piece || (isWhiteTurn !== (piece === piece.toUpperCase()))) continue;

                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (ChessRules.isValidMove(piece, fromRow, fromCol, toRow, toCol, board)) {
                            // Make temporary move
                            const tempPiece = board[toRow][toCol];
                            board[toRow][toCol] = piece;
                            board[fromRow][fromCol] = null;

                            // Check if move leaves king in check
                            const inCheck = ChessRules.isInCheck(board, isWhiteTurn);

                            // Undo move
                            board[fromRow][fromCol] = piece;
                            board[toRow][toCol] = tempPiece;

                            if (!inCheck) return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ChessRules = ChessRules;
}
