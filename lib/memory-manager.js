/**
 * Memory Management and Resource Cleanup Module
 * Handles cleanup for disconnected players, ended games, and memory monitoring
 */

class MemoryManager {
    constructor() {
        this.games = new Map(); // gameId -> game data
        this.players = new Map(); // playerId -> player data
        this.cleanupIntervals = new Map();
        this.memoryStats = {
            gamesCreated: 0,
            gamesEnded: 0,
            playersConnected: 0,
            playersDisconnected: 0,
            lastCleanup: null,
            memoryUsage: process.memoryUsage()
        };
        
        // Start periodic cleanup
        this.startPeriodicCleanup();
        this.startMemoryMonitoring();
    }

    /**
     * Register a new game
     */
    registerGame(gameId, gameData) {
        this.games.set(gameId, {
            ...gameData,
            createdAt: new Date(),
            lastActivity: new Date(),
            players: new Set()
        });
        this.memoryStats.gamesCreated++;
        console.log(`Game registered: ${gameId}, Total games: ${this.games.size}`);
    }

    /**
     * Register a new player
     */
    registerPlayer(playerId, playerData) {
        this.players.set(playerId, {
            ...playerData,
            connectedAt: new Date(),
            lastActivity: new Date(),
            gameId: playerData.gameId || null
        });
        
        // Add player to game if gameId exists
        if (playerData.gameId && this.games.has(playerData.gameId)) {
            this.games.get(playerData.gameId).players.add(playerId);
        }
        
        this.memoryStats.playersConnected++;
        console.log(`Player registered: ${playerId}, Total players: ${this.players.size}`);
    }

    /**
     * Update player activity timestamp
     */
    updatePlayerActivity(playerId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).lastActivity = new Date();
            
            // Update game activity if player is in a game
            const player = this.players.get(playerId);
            if (player.gameId && this.games.has(player.gameId)) {
                this.games.get(player.gameId).lastActivity = new Date();
            }
        }
    }

    /**
     * Update game activity timestamp
     */
    updateGameActivity(gameId) {
        if (this.games.has(gameId)) {
            this.games.get(gameId).lastActivity = new Date();
        }
    }

    /**
     * Remove a player and cleanup associated resources
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return false;

        // Remove player from game
        if (player.gameId && this.games.has(player.gameId)) {
            const game = this.games.get(player.gameId);
            game.players.delete(playerId);
            
            // If game has no players left, mark it for cleanup
            if (game.players.size === 0) {
                this.markGameForCleanup(player.gameId);
            }
        }

        this.players.delete(playerId);
        this.memoryStats.playersDisconnected++;
        console.log(`Player removed: ${playerId}, Remaining players: ${this.players.size}`);
        return true;
    }

    /**
     * Remove a game and cleanup associated resources
     */
    removeGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return false;

        // Remove all players from this game
        for (const playerId of game.players) {
            if (this.players.has(playerId)) {
                this.players.get(playerId).gameId = null;
            }
        }

        this.games.delete(gameId);
        this.memoryStats.gamesEnded++;
        console.log(`Game removed: ${gameId}, Remaining games: ${this.games.size}`);
        return true;
    }

    /**
     * Mark a game for cleanup (delayed removal)
     */
    markGameForCleanup(gameId, delayMs = 30000) { // 30 seconds delay
        if (this.cleanupIntervals.has(gameId)) {
            clearTimeout(this.cleanupIntervals.get(gameId));
        }

        const timeoutId = setTimeout(() => {
            this.removeGame(gameId);
            this.cleanupIntervals.delete(gameId);
        }, delayMs);

        this.cleanupIntervals.set(gameId, timeoutId);
        console.log(`Game marked for cleanup: ${gameId} in ${delayMs}ms`);
    }

    /**
     * Cancel game cleanup (if players reconnect)
     */
    cancelGameCleanup(gameId) {
        if (this.cleanupIntervals.has(gameId)) {
            clearTimeout(this.cleanupIntervals.get(gameId));
            this.cleanupIntervals.delete(gameId);
            console.log(`Game cleanup cancelled: ${gameId}`);
            return true;
        }
        return false;
    }

    /**
     * Clean up stale games and players
     */
    cleanupStaleResources() {
        const now = new Date();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        let cleanedGames = 0;
        let cleanedPlayers = 0;

        // Clean up stale games
        for (const [gameId, game] of this.games.entries()) {
            if (now - game.lastActivity > staleThreshold) {
                this.removeGame(gameId);
                cleanedGames++;
            }
        }

        // Clean up stale players
        for (const [playerId, player] of this.players.entries()) {
            if (now - player.lastActivity > staleThreshold) {
                this.removePlayer(playerId);
                cleanedPlayers++;
            }
        }

        this.memoryStats.lastCleanup = now;
        
        if (cleanedGames > 0 || cleanedPlayers > 0) {
            console.log(`Cleanup completed: ${cleanedGames} games, ${cleanedPlayers} players removed`);
        }

        return { cleanedGames, cleanedPlayers };
    }

    /**
     * Start periodic cleanup process
     */
    startPeriodicCleanup() {
        // Run cleanup every 2 minutes
        setInterval(() => {
            this.cleanupStaleResources();
        }, 2 * 60 * 1000);
        
        console.log('Periodic cleanup started (every 2 minutes)');
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        // Update memory stats every 30 seconds
        setInterval(() => {
            this.memoryStats.memoryUsage = process.memoryUsage();
            
            // Log memory warning if usage is high
            const heapUsedMB = this.memoryStats.memoryUsage.heapUsed / 1024 / 1024;
            if (heapUsedMB > 100) { // Warning if heap usage > 100MB
                console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB heap used`);
            }
        }, 30 * 1000);
        
        console.log('Memory monitoring started (every 30 seconds)');
    }

    /**
     * Get current memory statistics
     */
    getMemoryStats() {
        return {
            ...this.memoryStats,
            currentGames: this.games.size,
            currentPlayers: this.players.size,
            pendingCleanups: this.cleanupIntervals.size,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Get detailed game information
     */
    getGameInfo(gameId) {
        return this.games.get(gameId) || null;
    }

    /**
     * Get detailed player information
     */
    getPlayerInfo(playerId) {
        return this.players.get(playerId) || null;
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            console.log('Forced garbage collection completed');
            return true;
        } else {
            console.warn('Garbage collection not available. Start Node.js with --expose-gc flag');
            return false;
        }
    }

    /**
     * Get memory usage summary
     */
    getMemoryUsageSummary() {
        const usage = process.memoryUsage();
        return {
            heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
            rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
            games: this.games.size,
            players: this.players.size,
            pendingCleanups: this.cleanupIntervals.size
        };
    }

    /**
     * Shutdown cleanup - clear all intervals and cleanup resources
     */
    shutdown() {
        // Clear all cleanup intervals
        for (const timeoutId of this.cleanupIntervals.values()) {
            clearTimeout(timeoutId);
        }
        this.cleanupIntervals.clear();

        // Clear all games and players
        this.games.clear();
        this.players.clear();

        console.log('Memory manager shutdown completed');
    }
}

module.exports = MemoryManager;