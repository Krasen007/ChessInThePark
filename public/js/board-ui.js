
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

    // Add event listeners
    setupEventListeners();

    // Initialize game mode specific functionality
    if (gameMode === 'multiplayer') {
        document.getElementById('player-info').style.display = 'none';
        setBoardEnabled(false);
        initMultiplayer();
    } else {
        initSinglePlayer();
    }
}

// Setup event listeners for UI elements
function setupEventListeners() {
    document.getElementById('home-btn').addEventListener('click', goHome);
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

    // Add rank labels (1-8) on the left
    for (let row = 0; row < 8; row++) {
        const rankLabel = document.createElement('div');
        rankLabel.className = 'rank-label';
        rankLabel.textContent = shouldRotate ? row + 1 : 8 - row;
        rankLabel.style.gridColumn = '1';
        rankLabel.style.gridRow = `${row + 2}`;
        board.appendChild(rankLabel);
    }

    // Add squares
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;

            // Add rotated class to squares if needed
            if (shouldRotate) {
                square.classList.add('rotated');
            }

            // Store the actual game board coordinates in data attributes
            // These remain consistent regardless of rotation
            square.dataset.row = row;
            square.dataset.col = col;
            square.style.gridColumn = `${col + 2}`;
            square.style.gridRow = `${row + 2}`;
            square.addEventListener('click', onSquareClick);

            // Get piece from game board using actual coordinates
            const piece = game.getPiece(row, col);
            if (piece) {
                square.textContent = pieceSymbols[piece] || piece;
            } else {
                square.textContent = '';
            }

            board.appendChild(square);
        }
    }

    // Add file labels (a-h) at the bottom
    for (let col = 0; col < 8; col++) {
        const fileLabel = document.createElement('div');
        fileLabel.className = 'file-label';
        fileLabel.textContent = String.fromCharCode(97 + (shouldRotate ? 7 - col : col));
        fileLabel.style.gridColumn = `${col + 2}`;
        fileLabel.style.gridRow = '10';
        board.appendChild(fileLabel);
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

    // Get the actual board coordinates from data attributes
    // These are always the real game board coordinates regardless of rotation
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

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
            const san = game.generateSAN(move);
            addToHistory(san);

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
                    promotedTo: move.promotedTo,
                    capturedPiece: move.capturedPiece,
                    isEnPassant: move.isEnPassant
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
    const squares = document.querySelectorAll('.chess-square');
    squares.forEach((square) => {
        // Get the actual board coordinates from data attributes
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        // Get piece directly using the stored coordinates
        const piece = game.getPiece(row, col);
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

        // Recreate the board with proper orientation for the player color
        createBoard();
        setBoardEnabled(true);
        updateStatus();
    });

    socket.on('move-update', (moveData) => {
        if (!moveData || !moveData.from || !moveData.to) return;

        // Convert coordinates and validate
        const fromPos = game.stringToPosition(moveData.from);
        const toPos = game.stringToPosition(moveData.to);

        if (!fromPos || !toPos) return;

        // Use coordinates directly - no transformation needed
        // The game logic always uses the same coordinate system
        const [fromRow, fromCol] = fromPos;
        const [toRow, toCol] = toPos;

        // Validate that there is a piece at the from position
        if (!game.getPiece(fromRow, fromCol)) return;

        // Make the move using the actual game coordinates
        const move = game.makeMove(fromRow, fromCol, toRow, toCol, moveData.promotedTo);
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
        const receivedMove = {
            from: moveData.from,
            to: moveData.to,
            piece: moveData.piece,
            capturedPiece: moveData.capturedPiece,
            isEnPassant: moveData.isEnPassant,
            isCheck: moveData.isCheck,
            isCheckmate: moveData.isCheckmate,
            isStalemate: moveData.isStalemate,
            isDraw: moveData.isDraw,
            promotedTo: moveData.promotedTo
        };
        const san = game.generateSAN(receivedMove);
        addToHistory(san);
        updateStatus(move);
    });

    socket.on('opponent-left', () => {
        document.getElementById('game-status').textContent = t.opponentLeft;
        document.getElementById('game-status').className = 'game-status status-ended';
        gameStarted = false;
    });

    socket.on('game-over', (gameResult) => {
        gameStarted = false;
        let message = '';
        if (gameResult.type === 'checkmate') {
            message = gameResult.winner === playerColor ?
                t.you + ' ' + t.whiteWins.replace('White', gameResult.winner === 'white' ? t.white : t.black) :
                t.opponent + ' ' + t.whiteWins.replace('White', gameResult.winner === 'white' ? t.white : t.black);
        } else if (gameResult.type === 'stalemate') {
            message = t.stalemate;
        } else {
            message = t.drawRepetition; // Default to draw
        }

        document.getElementById('game-status').textContent = message;
        document.getElementById('game-status').className = 'game-status status-ended';
        document.getElementById('game-over-message').textContent = message;
        document.getElementById('game-over-overlay').style.display = 'flex';
    });

    socket.on('game-reset', () => {
        // Reset local game state
        game.reset();
        clearSelection();
        document.getElementById('history-list').innerHTML = '';
        document.getElementById('game-over-overlay').style.display = 'none';
        createBoard();

        // Reset UI state
        gameStarted = false;
        playerColor = null;
        document.getElementById('game-status').textContent = t.waitingForOpponent;
        document.getElementById('game-status').className = 'game-status status-waiting';
        document.getElementById('player-info').style.display = 'none';
        setBoardEnabled(false);
    });

    socket.on('lobby-full', () => {
        document.getElementById('game-status').textContent = t.lobbyFull;
        document.getElementById('game-status').className = 'game-status status-ended';
    });

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let connectionTimeout = null;

    // Enhanced connection error handling
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reconnectAttempts++;

        const statusElement = document.getElementById('game-status');
        const overlay = document.getElementById('game-over-overlay');
        const messageEl = document.getElementById('game-over-message');

        if (reconnectAttempts < maxReconnectAttempts) {
            statusElement.textContent = `${t.connectionError} Retrying... (${reconnectAttempts}/${maxReconnectAttempts})`;
            statusElement.className = 'game-status status-waiting';

            // Clear any existing timeout
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
            }

            // Set a timeout to show more detailed error if connection doesn't recover
            connectionTimeout = setTimeout(() => {
                if (!socket.connected) {
                    statusElement.textContent = 'Connection unstable. Please check your internet connection.';
                    statusElement.className = 'game-status status-ended';
                }
            }, 10000);

        } else {
            statusElement.textContent = `${t.connectionError} Please refresh the page when the server is back online.`;
            statusElement.className = 'game-status status-ended';

            socket.close();
            gameStarted = false;

            messageEl.textContent = 'Server connection lost. Please refresh the page to reconnect.';
            overlay.style.display = 'flex';
        }
    });

    socket.on('connect', () => {
        console.log('Successfully connected to server');
        reconnectAttempts = 0;

        // Clear any pending timeout
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }

        // Only join lobby if not already in a game
        if (!gameStarted) {
            socket.emit('join-lobby');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);

        const statusElement = document.getElementById('game-status');
        if (reason === 'io server disconnect') {
            // Server disconnected us
            statusElement.textContent = 'Server disconnected. Please refresh the page.';
            statusElement.className = 'game-status status-ended';
            gameStarted = false;
        } else if (reason === 'io client disconnect') {
            // We disconnected ourselves
            statusElement.textContent = 'Disconnected from server.';
            statusElement.className = 'game-status status-ended';
        } else {
            // Other disconnection reasons (network issues, etc.)
            statusElement.textContent = 'Connection lost. Attempting to reconnect...';
            statusElement.className = 'game-status status-waiting';
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`);
        document.getElementById('game-status').textContent = `Reconnecting... (${attemptNumber}/${maxReconnectAttempts})`;
    });

    socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect to server');
        document.getElementById('game-status').textContent = 'Failed to reconnect. Please refresh the page.';
        document.getElementById('game-status').className = 'game-status status-ended';
        gameStarted = false;
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log(`Successfully reconnected on attempt ${attemptNumber}`);
        document.getElementById('game-status').textContent = 'Reconnected! Resuming game...';
        document.getElementById('game-status').className = 'game-status status-playing';

        // Rejoin lobby if we were in a game
        if (!gameStarted) {
            socket.emit('join-lobby');
        }
    });

    // Do not emit join-lobby here; it is handled in the 'connect' event
}

// Update game status
function updateStatus(moveResult) {
    const statusElement = document.getElementById('game-status');
    const overlay = document.getElementById('game-over-overlay');
    const messageEl = document.getElementById('game-over-message');

    // Determine status based on game state
    const gameState = getGameState(moveResult);
    const { status, statusClass, showOverlay, overlayMessage } = gameState;

    // Update status display
    statusElement.textContent = status;
    statusElement.className = `game-status ${statusClass}`;

    // Handle game over overlay
    if (showOverlay) {
        messageEl.textContent = overlayMessage;
        overlay.style.display = 'flex';
    }

    // Update active player highlight
    if (gameStarted) {
        document.getElementById('white-player').classList.toggle('active', game.turn === 'w');
        document.getElementById('black-player').classList.toggle('active', game.turn === 'b');
    }
}

// Get current game state information
function getGameState(moveResult) {
    // Game end conditions
    if (moveResult?.isCheckmate) {
        const winner = game.turn === 'b' ? t.white : t.black;
        return {
            status: `${winner} ${t.whiteWins.replace('White', winner)}`,
            statusClass: 'status-ended',
            showOverlay: true,
            overlayMessage: `${winner} ${t.whiteWins.replace('White', winner)}`
        };
    }

    if (moveResult?.isStalemate) {
        return {
            status: t.stalemate,
            statusClass: 'status-ended',
            showOverlay: true,
            overlayMessage: t.stalemate
        };
    }

    if (moveResult?.isDraw) {
        const drawType = moveResult.gameStatus === 'draw-repetition' ? t.drawRepetition : t.drawFifty;
        return {
            status: drawType,
            statusClass: 'status-ended',
            showOverlay: true,
            overlayMessage: drawType
        };
    }

    // Check conditions
    if (moveResult?.isCheck || game.check) {
        const colorInCheck = game.turn === 'w' ? t.black : t.white;
        return {
            status: `${t.check} (${colorInCheck} called)`,
            statusClass: 'status-check',
            showOverlay: false,
            overlayMessage: ''
        };
    }

    // Regular gameplay
    return {
        status: getTurnStatus(),
        statusClass: 'status-playing',
        showOverlay: false,
        overlayMessage: ''
    };
}

// Get current turn status
function getTurnStatus() {
    if (gameMode === 'single') {
        return t.yourTurn;
    }

    if (gameMode === 'multiplayer' && gameStarted && playerColor) {
        const isMyTurn = (game.turn === 'w' && playerColor === 'white') ||
            (game.turn === 'b' && playerColor === 'black');
        return isMyTurn ? t.yourTurn : t.opponentTurn;
    }

    // Fallback for multiplayer when not fully initialized
    return gameMode === 'multiplayer' ? t.opponentTurn : t.yourTurn;
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
