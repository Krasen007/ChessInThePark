
// Language translations
const translations = {
    en: {
        gameTitle: 'Chess Game',
        singlePlayerTitle: 'Single Player Chess',
        multiplayerTitle: 'Multiplayer Chess',
        waitingForOpponent: 'Waiting for opponent...',
        gameStarted: 'Game started! Your turn.',
        opponentTurn: "Opponent's turn",
        yourTurn: 'Your turn',
        whitesTurn: "White's turn",
        blacksTurn: "Black's turn",
        whiteWins: 'White wins by checkmate!',
        blackWins: 'Black wins by checkmate!',
        stalemate: 'Game drawn by stalemate!',
        drawRepetition: 'Game drawn by threefold repetition!',
        drawFifty: 'Game drawn by fifty-move rule!',
        check: 'Check!',
        opponentLeft: 'Opponent left the game',
        newGame: 'New Game',
        you: 'You',
        opponent: 'Opponent',
        home: 'Home',
        white: 'White',
        black: 'Black',
        historyTitle: 'Move History',
        lobbyFull: 'Game lobby is full. Please try again later.',
        connectionError: 'Connection error. Please refresh the page.'
    },
    bg: {
        gameTitle: 'Шахматна игра',
        singlePlayerTitle: 'Шахмат за един играч',
        multiplayerTitle: 'Шахмат за много играчи',
        waitingForOpponent: 'Чакане на противник...',
        gameStarted: 'Играта започна! Вашият ред.',
        opponentTurn: 'Ред на противника',
        yourTurn: 'Вашият ред',
        whitesTurn: 'Ред на белите',
        blacksTurn: 'Ред на черните',
        whiteWins: 'Белите печелят!',
        blackWins: 'Черните печелят!',
        opponentLeft: 'Противникът напусна играта',
        newGame: 'Нова игра',
        you: 'Ти',
        opponent: 'Противник',
        home: 'Начало',
        white: 'Бели',
        black: 'Черни',
        historyTitle: 'История на ходовете',
        lobbyFull: 'Лобито е пълно. Моля, опитайте отново по-късно.',
        connectionError: 'Грешка във връзката. Моля, обновете страницата.',
        check: 'Шах!'
    }
};

// Piece symbols for display
const pieceSymbols = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const gameMode = urlParams.get('mode') || 'single';
const currentLang = urlParams.get('lang') || 'en';
const t = translations[currentLang];

// Game variables
let game = new SimpleChess();
let socket = null;
let playerColor = null;
let gameStarted = false;
let selectedSquare = null;

// Initialize the application
function init() {
    updateLanguage();
    createBoard();

    // Initialize game mode specific functionality
    if (gameMode === 'multiplayer') {
        document.getElementById('player-info').style.display = 'none';
        setBoardEnabled(false);
        initMultiplayer();
    } else {
        initSinglePlayer();
    }
}

// Update page language
function updateLanguage() {
    document.documentElement.lang = currentLang;
document.getElementById('game-title').textContent = t.gameTitle;
    document.getElementById('home-text').textContent = t.home;
    document.getElementById('white-label').textContent = t.white;
    document.getElementById('black-label').textContent = t.black;
    document.getElementById('history-title').textContent = t.historyTitle;
}

// Create the chess board
function createBoard() {
    const board = document.getElementById('chessboard');
    board.innerHTML = '';

    // Check if we need to rotate the board (for black player in multiplayer)
    const shouldRotate = gameMode === 'multiplayer' && playerColor === 'black';

    // Add rotated class to board if needed
    if (shouldRotate) {
        board.classList.add('rotated');
    } else {
        board.classList.remove('rotated');
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;

            // Add rotated class to squares if needed
            if (shouldRotate) {
                square.classList.add('rotated');
            }

            // For rotated board, we need to adjust the coordinates
            const displayRow = shouldRotate ? 7 - row : row;
            const displayCol = shouldRotate ? 7 - col : col;

            square.dataset.row = displayRow;
            square.dataset.col = displayCol;
            square.addEventListener('click', onSquareClick);

            const piece = game.getPiece(row, col);
            if (piece) {
                square.textContent = pieceSymbols[piece] || piece;
            } else {
                square.textContent = '';
            }

            board.appendChild(square);
        }
    }
}

// Enable or disable the chessboard (for multiplayer waiting state)
function setBoardEnabled(enabled) {
    const squares = document.querySelectorAll('.chess-square');
    squares.forEach(square => {
        square.style.pointerEvents = enabled ? 'auto' : 'none';
        square.style.opacity = enabled ? '1' : '0.5';
    });
}

// Handle square clicks
function onSquareClick(event) {
    if (!gameStarted) return;

    // Get the actual board coordinates considering rotation
    const displayRow = parseInt(event.target.dataset.row);
    const displayCol = parseInt(event.target.dataset.col);

    // Transform coordinates back to game logic coordinates if board is rotated
    const shouldRotate = gameMode === 'multiplayer' && playerColor === 'black';
    const row = shouldRotate ? 7 - displayRow : displayRow;
    const col = shouldRotate ? 7 - displayCol : displayCol;

    // In multiplayer, check if it's our turn
    if (gameMode === 'multiplayer' && playerColor) {
        const isWhiteTurn = game.turn === 'w';
        const isMyTurn = (isWhiteTurn && playerColor === 'white') || (!isWhiteTurn && playerColor === 'black');
        if (!isMyTurn) return;
    }

    if (selectedSquare) {
        // Try to make a move
        const fromRow = selectedSquare.row;
        const fromCol = selectedSquare.col;

        if (fromRow === row && fromCol === col) {
            // Clicked same square - deselect
            clearSelection();
            return;
        }

        const move = game.makeMove(fromRow, fromCol, row, col);
        if (move) {
            updateBoard();
            addToHistory(`${move.from}-${move.to}`);

            // Send move in multiplayer
            if (gameMode === 'multiplayer' && socket) {
                socket.emit('make-move', {
                    from: move.from,
                    to: move.to,
                    piece: game.getPiece(row, col),
                    isCheck: move.isCheck,
                    isCheckmate: game.gameStatus === 'checkmate',
                    isStalemate: game.gameStatus === 'stalemate',
                    isDraw: game.gameStatus.startsWith('draw-'),
                    gameStatus: game.gameStatus,
                    fen: game.getBoardFEN(),
                    promotedTo: move.promotedTo
                });
                // Update status locally after sending the move
                updateStatus(move);
            } else {
                // Only update status in single player mode or if not in multiplayer
                updateStatus();
            }
        }

        clearSelection();
    } else {
        // Select a piece
        const piece = game.getPiece(row, col);
        if (piece) {
            selectedSquare = { row, col };
            event.target.classList.add('selected');
        }
    }
}

// Clear selection
function clearSelection() {
    document.querySelectorAll('.chess-square').forEach(square => {
        square.classList.remove('selected', 'highlight');
    });
    selectedSquare = null;
}

// Update board display
function updateBoard() {
    const boardElement = document.getElementById('chessboard');
    const shouldRotate = gameMode === 'multiplayer' && playerColor === 'black';

    const squares = document.querySelectorAll('.chess-square');
    squares.forEach((square, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;

        // For rotated board, we need to adjust the coordinates when getting pieces
        // The game board array is never rotated, so we need to transform the coordinates
        // to get the correct piece for display
        const gameRow = shouldRotate ? 7 - row : row;
        const gameCol = shouldRotate ? 7 - col : col;

        const piece = game.getPiece(gameRow, gameCol);
        if (piece) {
            square.textContent = pieceSymbols[piece] || piece;
        } else {
            square.textContent = '';
        }
    });
}

// Initialize single player mode
function initSinglePlayer() {
    document.getElementById('game-status').textContent = t.yourTurn;
    document.getElementById('game-status').className = 'game-status status-playing';
    document.getElementById('player-info').style.display = 'flex';
    gameStarted = true;
    updateStatus();
}

// Initialize multiplayer mode
function initMultiplayer() {
    document.getElementById('game-status').textContent = t.waitingForOpponent;
    document.getElementById('game-status').className = 'game-status status-waiting';

    // Connect to server with specific configuration
    socket = io({
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 5000
    });

    // Socket event handlers
    socket.on('waiting-for-opponent', () => {
        document.getElementById('game-status').textContent = t.waitingForOpponent;
        document.getElementById('game-status').className = 'game-status status-waiting';
        setBoardEnabled(false);
        document.getElementById('player-info').style.display = 'none';
    });

    socket.on('game-start', (data) => {
        gameStarted = true;
        playerColor = data.players.find(p => p.id === socket.id).color;

        document.getElementById('player-info').style.display = 'flex';
        document.getElementById('white-name').textContent = playerColor === 'white' ? t.you : t.opponent;
        document.getElementById('black-name').textContent = playerColor === 'black' ? t.you : t.opponent;

        setBoardEnabled(true);
        updateStatus();
    });

    socket.on('move-update', (moveData) => {
        if (!moveData || !moveData.from || !moveData.to) return;

        // Convert coordinates and validate
        const fromPos = game.stringToPosition(moveData.from);
        const toPos = game.stringToPosition(moveData.to);

        if (!fromPos || !toPos) return;

        // Transform coordinates for rotated board if needed
        const shouldRotate = gameMode === 'multiplayer' && playerColor === 'black';
        let [fromRow, fromCol] = fromPos;
        let [toRow, toCol] = toPos;

        if (shouldRotate) {
            fromRow = 7 - fromRow;
            fromCol = 7 - fromCol;
            toRow = 7 - toRow;
            toCol = 7 - toCol;
        }

        // Validate that there is a piece at the from position
        // We need to transform back to game coordinates for validation
        const gameFromRow = shouldRotate ? 7 - fromRow : fromRow;
        const gameFromCol = shouldRotate ? 7 - fromCol : fromCol;
        if (!game.getPiece(gameFromRow, gameFromCol)) return;

        // Make the move and get the result
        // Transform back to game coordinates for the move
        const gameFromPos = shouldRotate ? [7 - fromRow, 7 - fromCol] : [fromRow, fromCol];
        const gameToPos = shouldRotate ? [7 - toRow, 7 - toCol] : [toRow, toCol];

        const move = game.makeMove(gameFromPos[0], gameFromPos[1], gameToPos[0], gameToPos[1], moveData.promotedTo);
        if (!move) return;

        // Synchronize game state with server
        move.isCheck = moveData.isCheck;
        move.isCheckmate = moveData.isCheckmate;
        move.isStalemate = moveData.isStalemate;
        move.isDraw = moveData.isDraw;
        move.gameStatus = moveData.gameStatus;

        // Update the game state
        game.check = moveData.isCheck;
        game.gameStatus = moveData.isCheckmate ? 'checkmate' :
            moveData.isStalemate ? 'stalemate' :
                moveData.isDraw ? moveData.gameStatus :
                    'active';

        // Update the UI
        updateBoard();
        addToHistory(`${moveData.from}-${moveData.to}`);
        updateStatus(move);
    });

    socket.on('opponent-left', () => {
        document.getElementById('game-status').textContent = t.opponentLeft;
        document.getElementById('game-status').className = 'game-status status-ended';
        gameStarted = false;
    });

    socket.on('lobby-full', () => {
        document.getElementById('game-status').textContent = t.lobbyFull;
        document.getElementById('game-status').className = 'game-status status-ended';
    });

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    socket.on('connect_error', () => {
        reconnectAttempts++;
        document.getElementById('game-status').textContent = reconnectAttempts < maxReconnectAttempts ?
            `${t.connectionError} Retrying... (${reconnectAttempts}/${maxReconnectAttempts})` :
            `${t.connectionError} Please refresh the page when the server is back online.`;
        document.getElementById('game-status').className = 'game-status status-ended';

        if (reconnectAttempts >= maxReconnectAttempts) {
            socket.close();
            gameStarted = false;
            document.getElementById('game-over-overlay').style.display = 'flex';
            document.getElementById('game-over-message').textContent = 'Server connection lost. Please refresh when the server is back online.';
        }
    });

    socket.on('connect', () => {
        reconnectAttempts = 0;
        // Only join lobby if not already in a game
        if (!gameStarted) {
            socket.emit('join-lobby');
        }
    });

    // Do not emit join-lobby here; it is handled in the 'connect' event
}

// Update game status
function updateStatus(moveResult) {
    let status = '';
    let statusClass = 'status-playing';
    const overlay = document.getElementById('game-over-overlay');
    const messageEl = document.getElementById('game-over-message');

    // Handle game end conditions first
    if (moveResult && moveResult.isCheckmate) {
        status = game.turn === 'b' ? t.whiteWins : t.blackWins;
        statusClass = 'status-ended';
        messageEl.textContent = status;
        overlay.style.display = 'flex';
    } else if (moveResult && moveResult.isStalemate) {
        status = t.stalemate;
        statusClass = 'status-ended';
        messageEl.textContent = status;
        overlay.style.display = 'flex';
    } else if (moveResult && moveResult.isDraw) {
        status = moveResult.gameStatus === 'draw-repetition' ?
            t.drawRepetition : t.drawFifty;
        statusClass = 'status-ended';
        messageEl.textContent = status;
        overlay.style.display = 'flex';
    } else if (moveResult && moveResult.isCheck) {
        // Determine which color is in check
        const colorInCheck = game.turn === 'w' ? 'black' : 'white';
        status = `${t.check} (${colorInCheck} called)`;
        statusClass = 'status-check';
    } else if (game.check) {
        // Check if the current player is in check (ongoing status)
        const colorInCheck = game.turn === 'w' ? 'black' : 'white';
        status = `${t.check} (${colorInCheck} called)`;
        statusClass = 'status-check';
    } else {
        // Regular turn status
        if (gameMode === 'multiplayer' && gameStarted && playerColor) {
            const isMyTurn = (game.turn === 'w' && playerColor === 'white') ||
                (game.turn === 'b' && playerColor === 'black');
            status = isMyTurn ? t.yourTurn : t.opponentTurn;
        } else if (gameMode === 'single') {
            status = t.yourTurn;
        } else if (gameMode === 'multiplayer') {
            // Fallback for multiplayer when playerColor not set
            status = t.opponentTurn;
        }
    }

    // Update the status display
    const statusElement = document.getElementById('game-status');
    statusElement.textContent = status;
    statusElement.className = `game-status ${statusClass}`;

    // Update active player highlight
    if (gameStarted) {
        document.getElementById('white-player').classList.toggle('active', game.turn === 'w');
        document.getElementById('black-player').classList.toggle('active', game.turn === 'b');
    }
}


// Add move to history
function addToHistory(move) {
    const historyList = document.getElementById('history-list');
    const moveNumber = Math.ceil(game.history.length / 2);
    const isWhiteMove = game.turn === 'b';

    if (isWhiteMove) {
        const moveElement = document.createElement('div');
        moveElement.textContent = `${moveNumber}. ${move}`;
        moveElement.style.padding = '2px 5px';
        moveElement.style.borderBottom = '1px solid #eee';
        historyList.appendChild(moveElement);
    } else {
        const lastMoveElement = historyList.lastElementChild;
        if (lastMoveElement) {
            lastMoveElement.textContent += ` ${move}`;
        }
    }
    historyList.scrollTop = historyList.scrollHeight;
}

// Start new game
function startNewGame() {
    game.reset();
    clearSelection();
    document.getElementById('history-list').innerHTML = '';
    document.getElementById('game-over-overlay').style.display = 'none';
    createBoard();

    if (gameMode === 'multiplayer') {
        if (socket) {
            socket.emit('leave-game');  // Explicitly tell server we're leaving
            socket.disconnect();
            socket = null;
        }
        // Reset game state
        gameStarted = false;
        playerColor = null;
        // Hide player info and disable board until game starts
        document.getElementById('player-info').style.display = 'none';
        setBoardEnabled(false);
        // Create new socket connection
        socket = io({
            reconnectionAttempts: 3,
            reconnectionDelay: 1000,
            timeout: 5000,
            forceNew: true  // Force a new connection
        });
        initMultiplayer();
    } else {
        gameStarted = true;
        updateStatus();
    }
}

// Go to home page
function goHome() {
    if (socket) {
        socket.emit('leave-game');  // Explicitly tell server we're leaving
        socket.disconnect();
        socket = null;
    }
    window.location.href = `/?lang=${currentLang}`;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.emit('leave-game');  // Explicitly tell server we're leaving
        socket.disconnect();
        socket = null;
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
