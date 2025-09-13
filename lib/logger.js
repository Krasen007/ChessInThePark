/**
 * Centralized Logging System
 * Captures all server logs and provides API access for monitoring dashboard
 */

class Logger {
    constructor(maxLogs = 1000) {
        this.logs = [];
        this.maxLogs = maxLogs;
        this.logLevels = {
            ERROR: { priority: 0, color: '#F44336', icon: '❌' },
            WARN: { priority: 1, color: '#FF9800', icon: '⚠️' },
            INFO: { priority: 2, color: '#2196F3', icon: 'ℹ️' },
            DEBUG: { priority: 3, color: '#4CAF50', icon: '🐛' },
            TRACE: { priority: 4, color: '#9E9E9E', icon: '🔍' }
        };
        
        // Override console methods to capture logs
        this.interceptConsole();
        
        // Log startup
        this.info('Logger initialized', { maxLogs: this.maxLogs });
    }

    /**
     * Add a log entry
     */
    addLog(level, message, context = {}, source = 'server') {
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: String(message),
            context: context,
            source: source,
            ...this.logLevels[level.toUpperCase()]
        };

        this.logs.unshift(logEntry);
        
        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        // Also log to original console for development
        this.originalConsole[level.toLowerCase()]?.(
            `[${new Date().toLocaleTimeString()}] ${level.toUpperCase()}: ${message}`,
            context
        );

        return logEntry;
    }

    /**
     * Log levels
     */
    error(message, context = {}, source = 'server') {
        return this.addLog('ERROR', message, context, source);
    }

    warn(message, context = {}, source = 'server') {
        return this.addLog('WARN', message, context, source);
    }

    info(message, context = {}, source = 'server') {
        return this.addLog('INFO', message, context, source);
    }

    debug(message, context = {}, source = 'server') {
        return this.addLog('DEBUG', message, context, source);
    }

    trace(message, context = {}, source = 'server') {
        return this.addLog('TRACE', message, context, source);
    }

    /**
     * Intercept console methods to capture all logs
     */
    interceptConsole() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug,
            trace: console.trace
        };

        // Override console methods
        console.log = (...args) => {
            this.addLog('INFO', this.formatArgs(args), {}, 'console');
        };

        console.error = (...args) => {
            this.addLog('ERROR', this.formatArgs(args), {}, 'console');
        };

        console.warn = (...args) => {
            this.addLog('WARN', this.formatArgs(args), {}, 'console');
        };

        console.info = (...args) => {
            this.addLog('INFO', this.formatArgs(args), {}, 'console');
        };

        console.debug = (...args) => {
            this.addLog('DEBUG', this.formatArgs(args), {}, 'console');
        };

        console.trace = (...args) => {
            this.addLog('TRACE', this.formatArgs(args), {}, 'console');
        };
    }

    /**
     * Format console arguments into a string
     */
    formatArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    /**
     * Get logs with filtering options
     */
    getLogs(options = {}) {
        let filteredLogs = [...this.logs];

        // Filter by level
        if (options.level) {
            const levelPriority = this.logLevels[options.level.toUpperCase()]?.priority;
            if (levelPriority !== undefined) {
                filteredLogs = filteredLogs.filter(log => 
                    this.logLevels[log.level]?.priority <= levelPriority
                );
            }
        }

        // Filter by source
        if (options.source) {
            filteredLogs = filteredLogs.filter(log => 
                log.source === options.source
            );
        }

        // Filter by time range
        if (options.since) {
            const sinceTime = new Date(options.since);
            filteredLogs = filteredLogs.filter(log => 
                new Date(log.timestamp) >= sinceTime
            );
        }

        // Filter by search term
        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            filteredLogs = filteredLogs.filter(log => 
                log.message.toLowerCase().includes(searchTerm) ||
                JSON.stringify(log.context).toLowerCase().includes(searchTerm)
            );
        }

        // Limit results
        const limit = options.limit || 100;
        return filteredLogs.slice(0, limit);
    }

    /**
     * Get log statistics
     */
    getLogStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            bySource: {},
            last24Hours: 0,
            lastHour: 0
        };

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        this.logs.forEach(log => {
            // Count by level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            // Count by source
            stats.bySource[log.source] = (stats.bySource[log.source] || 0) + 1;
            
            // Count recent logs
            const logTime = new Date(log.timestamp);
            if (logTime >= oneDayAgo) {
                stats.last24Hours++;
            }
            if (logTime >= oneHourAgo) {
                stats.lastHour++;
            }
        });

        return stats;
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        const clearedCount = this.logs.length;
        this.logs = [];
        this.info(`Cleared ${clearedCount} log entries`);
        return clearedCount;
    }

    /**
     * Export logs as JSON
     */
    exportLogs(options = {}) {
        const logs = this.getLogs(options);
        return {
            exportTime: new Date().toISOString(),
            totalLogs: logs.length,
            filters: options,
            logs: logs
        };
    }

    /**
     * Log connection events
     */
    logConnection(socketId, event, data = {}) {
        this.info(`Connection ${event}`, {
            socketId,
            event,
            ...data
        }, 'connection');
    }

    /**
     * Log game events
     */
    logGame(gameId, event, data = {}) {
        this.info(`Game ${event}`, {
            gameId,
            event,
            ...data
        }, 'game');
    }

    /**
     * Log move events
     */
    logMove(playerId, moveData, result = {}) {
        this.info('Move processed', {
            playerId,
            from: moveData.from,
            to: moveData.to,
            piece: moveData.piece,
            valid: result.valid !== false,
            processingTime: result.processingTime
        }, 'move');
    }

    /**
     * Log error events with stack trace
     */
    logError(error, context = {}) {
        this.error(error.message || String(error), {
            name: error.name,
            stack: error.stack,
            ...context
        }, 'error');
    }

    /**
     * Log performance events
     */
    logPerformance(metric, value, context = {}) {
        this.debug(`Performance: ${metric} = ${value}`, {
            metric,
            value,
            ...context
        }, 'performance');
    }

    /**
     * Log memory events
     */
    logMemory(event, data = {}) {
        this.debug(`Memory: ${event}`, data, 'memory');
    }

    /**
     * Restore original console (for cleanup)
     */
    restoreConsole() {
        Object.assign(console, this.originalConsole);
        this.info('Console methods restored');
    }
}

module.exports = Logger;