/**
 * Performance Monitoring and Metrics Collection Module
 * Tracks connections, games, errors, and performance metrics
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            connections: {
                total: 0,
                active: 0,
                peak: 0,
                failed: 0,
                reconnections: 0
            },
            games: {
                total: 0,
                active: 0,
                completed: 0,
                abandoned: 0,
                averageDuration: 0,
                totalDuration: 0
            },
            moves: {
                total: 0,
                invalid: 0,
                averageProcessingTime: 0,
                totalProcessingTime: 0
            },
            errors: {
                total: 0,
                byType: new Map(),
                byEndpoint: new Map(),
                last24Hours: []
            },
            performance: {
                responseTime: {
                    average: 0,
                    min: Infinity,
                    max: 0,
                    samples: []
                },
                throughput: {
                    requestsPerSecond: 0,
                    movesPerSecond: 0,
                    connectionsPerSecond: 0
                },
                system: {
                    cpuUsage: 0,
                    memoryUsage: process.memoryUsage(),
                    uptime: process.uptime()
                }
            }
        };

        this.startTime = Date.now();
        this.lastMetricsUpdate = Date.now();
        this.requestTimestamps = [];
        this.moveTimestamps = [];
        this.connectionTimestamps = [];

        // Start periodic metrics collection
        this.startPeriodicCollection();
    }

    /**
     * Record a new connection
     */
    recordConnection(success = true) {
        this.metrics.connections.total++;
        if (success) {
            this.metrics.connections.active++;
            this.metrics.connections.peak = Math.max(
                this.metrics.connections.peak,
                this.metrics.connections.active
            );
            this.connectionTimestamps.push(Date.now());
        } else {
            this.metrics.connections.failed++;
        }
    }

    /**
     * Record a disconnection
     */
    recordDisconnection() {
        this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);
    }

    /**
     * Record a reconnection attempt
     */
    recordReconnection() {
        this.metrics.connections.reconnections++;
    }

    /**
     * Record a new game start
     */
    recordGameStart(gameId) {
        this.metrics.games.total++;
        this.metrics.games.active++;
        
        // Store game start time for duration calculation
        if (!this.gameStartTimes) {
            this.gameStartTimes = new Map();
        }
        this.gameStartTimes.set(gameId, Date.now());
    }

    /**
     * Record a game end
     */
    recordGameEnd(gameId, reason = 'completed') {
        this.metrics.games.active = Math.max(0, this.metrics.games.active - 1);
        
        if (reason === 'completed') {
            this.metrics.games.completed++;
        } else {
            this.metrics.games.abandoned++;
        }

        // Calculate game duration
        if (this.gameStartTimes && this.gameStartTimes.has(gameId)) {
            const duration = Date.now() - this.gameStartTimes.get(gameId);
            this.metrics.games.totalDuration += duration;
            this.metrics.games.averageDuration = 
                this.metrics.games.totalDuration / (this.metrics.games.completed + this.metrics.games.abandoned);
            this.gameStartTimes.delete(gameId);
        }
    }

    /**
     * Record a move with processing time
     */
    recordMove(processingTimeMs, valid = true) {
        this.metrics.moves.total++;
        if (!valid) {
            this.metrics.moves.invalid++;
        }

        this.metrics.moves.totalProcessingTime += processingTimeMs;
        this.metrics.moves.averageProcessingTime = 
            this.metrics.moves.totalProcessingTime / this.metrics.moves.total;

        this.moveTimestamps.push(Date.now());
    }

    /**
     * Record an error
     */
    recordError(error, endpoint = 'unknown', context = {}) {
        this.metrics.errors.total++;
        
        const errorType = error.name || 'UnknownError';
        const currentCount = this.metrics.errors.byType.get(errorType) || 0;
        this.metrics.errors.byType.set(errorType, currentCount + 1);

        const endpointCount = this.metrics.errors.byEndpoint.get(endpoint) || 0;
        this.metrics.errors.byEndpoint.set(endpoint, endpointCount + 1);

        // Store error for 24-hour tracking
        const errorRecord = {
            timestamp: Date.now(),
            type: errorType,
            endpoint,
            message: error.message,
            context
        };
        
        this.metrics.errors.last24Hours.push(errorRecord);
        
        // Clean up old errors (older than 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.metrics.errors.last24Hours = this.metrics.errors.last24Hours.filter(
            err => err.timestamp > oneDayAgo
        );
    }

    /**
     * Record response time
     */
    recordResponseTime(timeMs) {
        this.metrics.performance.responseTime.min = Math.min(
            this.metrics.performance.responseTime.min,
            timeMs
        );
        this.metrics.performance.responseTime.max = Math.max(
            this.metrics.performance.responseTime.max,
            timeMs
        );

        // Keep last 100 samples for average calculation
        this.metrics.performance.responseTime.samples.push(timeMs);
        if (this.metrics.performance.responseTime.samples.length > 100) {
            this.metrics.performance.responseTime.samples.shift();
        }

        this.metrics.performance.responseTime.average = 
            this.metrics.performance.responseTime.samples.reduce((a, b) => a + b, 0) / 
            this.metrics.performance.responseTime.samples.length;

        this.requestTimestamps.push(Date.now());
    }

    /**
     * Calculate throughput metrics
     */
    calculateThroughput() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        const oneMinuteAgo = now - 60000;

        // Requests per second (based on last minute, averaged)
        const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
        this.metrics.performance.throughput.requestsPerSecond = recentRequests.length / 60;

        // Moves per second
        const recentMoves = this.moveTimestamps.filter(ts => ts > oneMinuteAgo);
        this.metrics.performance.throughput.movesPerSecond = recentMoves.length / 60;

        // Connections per second
        const recentConnections = this.connectionTimestamps.filter(ts => ts > oneMinuteAgo);
        this.metrics.performance.throughput.connectionsPerSecond = recentConnections.length / 60;

        // Clean up old timestamps
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
        this.moveTimestamps = this.moveTimestamps.filter(ts => ts > oneMinuteAgo);
        this.connectionTimestamps = this.connectionTimestamps.filter(ts => ts > oneMinuteAgo);
    }

    /**
     * Update system performance metrics
     */
    updateSystemMetrics() {
        this.metrics.performance.system.memoryUsage = process.memoryUsage();
        this.metrics.performance.system.uptime = process.uptime();

        // CPU usage calculation (simplified)
        if (this.lastCpuUsage) {
            const cpuUsage = process.cpuUsage(this.lastCpuUsage);
            const totalUsage = cpuUsage.user + cpuUsage.system;
            const elapsedTime = Date.now() - this.lastMetricsUpdate;
            this.metrics.performance.system.cpuUsage = (totalUsage / 1000) / elapsedTime * 100;
        }
        this.lastCpuUsage = process.cpuUsage();
        this.lastMetricsUpdate = Date.now();
    }

    /**
     * Start periodic metrics collection
     */
    startPeriodicCollection() {
        // Update throughput and system metrics every 10 seconds
        setInterval(() => {
            this.calculateThroughput();
            this.updateSystemMetrics();
        }, 10000);

        console.log('Performance monitoring started (updates every 10 seconds)');
    }

    /**
     * Get current metrics snapshot
     */
    getMetrics() {
        this.calculateThroughput();
        this.updateSystemMetrics();

        return {
            ...this.metrics,
            uptime: Date.now() - this.startTime,
            timestamp: Date.now()
        };
    }

    /**
     * Get metrics summary for monitoring endpoints
     */
    getMetricsSummary() {
        const metrics = this.getMetrics();
        
        return {
            connections: {
                active: metrics.connections.active,
                total: metrics.connections.total,
                peak: metrics.connections.peak,
                failureRate: metrics.connections.total > 0 ? 
                    (metrics.connections.failed / metrics.connections.total * 100).toFixed(2) + '%' : '0%'
            },
            games: {
                active: metrics.games.active,
                total: metrics.games.total,
                completionRate: metrics.games.total > 0 ? 
                    (metrics.games.completed / metrics.games.total * 100).toFixed(2) + '%' : '0%',
                averageDuration: this.formatDuration(metrics.games.averageDuration)
            },
            performance: {
                responseTime: `${metrics.performance.responseTime.average.toFixed(2)}ms`,
                throughput: `${metrics.performance.throughput.requestsPerSecond.toFixed(2)} req/s`,
                memoryUsage: `${(metrics.performance.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                uptime: this.formatDuration(metrics.uptime)
            },
            errors: {
                total: metrics.errors.total,
                last24Hours: metrics.errors.last24Hours.length,
                errorRate: metrics.moves.total > 0 ? 
                    (metrics.errors.total / metrics.moves.total * 100).toFixed(2) + '%' : '0%'
            }
        };
    }

    /**
     * Get detailed error breakdown
     */
    getErrorBreakdown() {
        const errorsByType = {};
        for (const [type, count] of this.metrics.errors.byType.entries()) {
            errorsByType[type] = count;
        }

        const errorsByEndpoint = {};
        for (const [endpoint, count] of this.metrics.errors.byEndpoint.entries()) {
            errorsByEndpoint[endpoint] = count;
        }

        return {
            total: this.metrics.errors.total,
            byType: errorsByType,
            byEndpoint: errorsByEndpoint,
            recent: this.metrics.errors.last24Hours.slice(-10) // Last 10 errors
        };
    }

    /**
     * Get performance alerts
     */
    getPerformanceAlerts() {
        const alerts = [];
        const metrics = this.getMetrics();

        // High response time alert
        if (metrics.performance.responseTime.average > 1000) {
            alerts.push({
                type: 'warning',
                message: `High response time: ${metrics.performance.responseTime.average.toFixed(2)}ms`,
                threshold: '1000ms'
            });
        }

        // High memory usage alert
        const memoryUsageMB = metrics.performance.system.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryUsageMB > 100) {
            alerts.push({
                type: 'warning',
                message: `High memory usage: ${memoryUsageMB.toFixed(2)}MB`,
                threshold: '100MB'
            });
        }

        // High error rate alert
        const errorRate = metrics.moves.total > 0 ? 
            (metrics.errors.total / metrics.moves.total * 100) : 0;
        if (errorRate > 5) {
            alerts.push({
                type: 'error',
                message: `High error rate: ${errorRate.toFixed(2)}%`,
                threshold: '5%'
            });
        }

        // Too many active connections alert
        if (metrics.connections.active > 1000) {
            alerts.push({
                type: 'warning',
                message: `High connection count: ${metrics.connections.active}`,
                threshold: '1000'
            });
        }

        return alerts;
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    }

    /**
     * Reset all metrics (useful for testing)
     */
    reset() {
        this.metrics = {
            connections: { total: 0, active: 0, peak: 0, failed: 0, reconnections: 0 },
            games: { total: 0, active: 0, completed: 0, abandoned: 0, averageDuration: 0, totalDuration: 0 },
            moves: { total: 0, invalid: 0, averageProcessingTime: 0, totalProcessingTime: 0 },
            errors: { total: 0, byType: new Map(), byEndpoint: new Map(), last24Hours: [] },
            performance: {
                responseTime: { average: 0, min: Infinity, max: 0, samples: [] },
                throughput: { requestsPerSecond: 0, movesPerSecond: 0, connectionsPerSecond: 0 },
                system: { cpuUsage: 0, memoryUsage: process.memoryUsage(), uptime: process.uptime() }
            }
        };
        
        this.startTime = Date.now();
        this.requestTimestamps = [];
        this.moveTimestamps = [];
        this.connectionTimestamps = [];
        
        if (this.gameStartTimes) {
            this.gameStartTimes.clear();
        }
    }
}

module.exports = PerformanceMonitor;