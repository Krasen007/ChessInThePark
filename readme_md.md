# Multiplayer Chess Application

A simple, stateless multiplayer chess game with English and Bulgarian language support.

## Features

- **Single Player Mode**: Play chess against yourself
- **Multiplayer Mode**: One global lobby where any two players can join and play
- **Bilingual Support**: English and Bulgarian interface
- **Static Links**: Direct access via URLs with language parameters
- **Real-time Sync**: Moves synchronized instantly between players
- **Stateless**: No storage - fresh start every time

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   - Home page: `http://localhost:3000`
   - English single player: `http://localhost:3000/game?mode=single&lang=en`
   - English multiplayer: `http://localhost:3000/game?mode=multiplayer&lang=en`
   - Bulgarian multiplayer: `http://localhost:3000/game?mode=multiplayer&lang=bg`

## How It Works

### Single Player
- Click "Single Player" to start a local chess game
- Play both white and black pieces
- All standard chess rules apply

### Multiplayer
- Click "Multiplayer" or use direct link
- First player sees "Waiting for opponent..."
- Second player joins automatically when they open the same link
- Game starts immediately with both players
- If anyone disconnects, the game resets and waits for new players

### Language Support
- Add `?lang=en` or `?lang=bg` to any URL
- Language is preserved when navigating between modes
- No storage - language is only active for current session

## File Structure

```
chess-app/
├── server.js              # Main server file
├── package.json           # Dependencies
└── public/
    ├── index.html         # Home page
    ├── game.html          # Game page
    └── css/
        └── styles.css     # All styles
```

## Technologies Used

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript
- **Chess Logic**: chess.js
- **Chess Board**: chessboard.js
- **Real-time**: WebSocket via Socket.io

## Static Links

Share these links directly:

- `http://localhost:3000/game?mode=multiplayer&lang=en` - English multiplayer
- `http://localhost:3000/game?mode=multiplayer&lang=bg` - Bulgarian multiplayer
- `http://localhost:3000/game?mode=single&lang=en` - English single player
- `http://localhost:3000/game?mode=single&lang=bg` - Bulgarian single player

## Development

- The server maintains one global game lobby
- Maximum 2 players at any time
- Game state resets when players disconnect
- No persistence - everything is stateless
- All moves are validated server-side using chess.js

## Deployment

For production, consider:
- Setting `NODE_ENV=production`
- Using PM2 for process management
- Adding NGINX reverse proxy
- Using HTTPS for secure WebSocket connections

## License

MIT