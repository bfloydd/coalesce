import { LogLevel } from '../shared-contracts/plugin';

// Re-export LogLevel for external use
export { LogLevel };

/**
 * Enhanced Logger for Vertical Slice Architecture
 * 
 * Usage:
 *    const logger = new Logger('SliceName');
 *    logger.debug("Debug message");
 *    logger.info("Info message");
 *    logger.warn("Warning message");
 *    logger.error("Error message");
 *    
 *    // Enable/disable logging
 *    logger.on();
 *    logger.on(LogLevel.DEBUG);
 *    logger.off();
 */
export class Logger {
    private enabled: boolean = false;
    private level: LogLevel = LogLevel.INFO;
    private prefix: string;

    /**
     * Creates a new logger instance
     * @param prefix Optional prefix for log messages to identify the source
     */
    constructor(prefix?: string) {
        this.prefix = prefix ? `[${prefix}] ` : '';
    }

    /**
     * Check if logging is enabled
     * @returns True if logging is enabled, false otherwise
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Enable logging with specified level
     * @param level Log level to set
     */
    on(level: LogLevel | keyof typeof LogLevel | number = LogLevel.INFO): void {
        this.enabled = true;
        this.setLevel(level);
        this.info(`Logging enabled at level: ${LogLevel[this.level]}`);
    }

    /**
     * Disable logging
     */
    off(): void {
        this.enabled = false;
        this.level = LogLevel.NONE;
        this.info('Logging disabled');
    }

    private setLevel(level: LogLevel | keyof typeof LogLevel | number): void {
        if (typeof level === 'string') {
            this.level = LogLevel[level] as number;
        } else {
            this.level = level;
        }
    }

    /**
     * Parse a log level from string or boolean
     */
    static parseLogLevel(level: string | boolean): LogLevel | boolean {
        if (typeof level === 'boolean') {
            return level;
        }

        const normalizedLevel = level.toUpperCase();
        switch (normalizedLevel) {
            case 'DEBUG': return LogLevel.DEBUG;
            case 'INFO': return LogLevel.INFO;
            case 'WARN': return LogLevel.WARN;
            case 'ERROR': return LogLevel.ERROR;
            case 'NONE': return LogLevel.NONE;
            default: return LogLevel.INFO;
        }
    }

    /**
     * Set logging level from string or boolean
     */
    setLogging(level: string | boolean): void {
        this.debug('setLogging called with:', level);
        const parsedLevel = Logger.parseLogLevel(level);
        this.debug('parsed level:', parsedLevel);

        if (typeof parsedLevel === 'boolean') {
            this.setLoggingFromBoolean(parsedLevel);
        } else {
            this.setLoggingFromLevel(parsedLevel);
        }
    }

    private setLoggingFromBoolean(enabled: boolean): void {
        this.enabled = enabled;
        this.level = LogLevel.INFO;
        this.debug(`Logging ${enabled ? 'enabled' : 'disabled'} (level: ${LogLevel[this.level]})`);
        this.debug('Current state:', { enabled: this.enabled, level: this.level });
    }

    private setLoggingFromLevel(level: LogLevel): void {
        this.enabled = true;
        this.level = level;
        this.debug(`Logging level set to ${LogLevel[this.level]}`);
        this.debug('Current state:', { enabled: this.enabled, level: this.level });
    }

    /**********************************************************
     * Primary debug levels
     *********************************************************/

    debug(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        console.debug(this.prefix + message, ...optionalParams);
    }

    info(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        console.log(this.prefix + message, ...optionalParams);
    }

    warn(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        console.warn(this.prefix + message, ...optionalParams);
    }

    error(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        console.error(this.prefix + message, ...optionalParams);
    }

    private shouldLog(level: LogLevel): boolean {
        return this.enabled && this.level <= level;
    }

    /**********************************************************
     * Enhanced logging methods for vertical slice architecture
     *********************************************************/

    /**
     * Log slice lifecycle events
     */
    logSliceEvent(sliceName: string, event: string, data?: any): void {
        this.debug(`[${sliceName}] ${event}`, data);
    }

    /**
     * Log inter-slice communication
     */
    logSliceCommunication(fromSlice: string, toSlice: string, eventType: string, data?: any): void {
        this.debug(`[Slice Communication] ${fromSlice} -> ${toSlice}: ${eventType}`, data);
    }

    /**
     * Log performance metrics
     */
    logPerformance(operation: string, duration: number, data?: any): void {
        this.debug(`[Performance] ${operation}: ${duration}ms`, data);
    }

    /**
     * Log error with context
     */
    logErrorWithContext(error: Error, context: string, data?: any): void {
        this.error(`[Error] ${context}: ${error.message}`, {
            error: error.name,
            stack: error.stack,
            data
        });
    }

    /**
     * Log user interaction
     */
    logUserInteraction(action: string, element: string, data?: any): void {
        this.debug(`[User Interaction] ${action} on ${element}`, data);
    }

    /**********************************************************
     * Extras
     *********************************************************/

    trace(message?: unknown, ...optionalParams: unknown[]): void {
        if (this.enabled) {
            console.trace(this.prefix + message, ...optionalParams);
        }
    }

    group(label?: string): void {
        if (this.enabled) {
            console.group(this.prefix + (label || ''));
        }
    }

    groupEnd(): void {
        if (this.enabled) {
            console.groupEnd();
        }
    }

    table(tabularData: unknown, properties?: string[]): void {
        if (this.enabled) {
            console.table(tabularData, properties);
        }
    }

    time(label: string): void {
        if (this.enabled) {
            console.time(this.prefix + label);
        }
    }

    timeEnd(label: string): void {
        if (this.enabled) {
            console.timeEnd(this.prefix + label);
        }
    }

    /**
     * Create a child logger with additional prefix
     */
    child(childPrefix: string): Logger {
        const newPrefix = this.prefix ? `${this.prefix}[${childPrefix}]` : `[${childPrefix}]`;
        const childLogger = new Logger();
        childLogger.prefix = newPrefix;
        childLogger.enabled = this.enabled;
        childLogger.level = this.level;
        return childLogger;
    }

    /**
     * Create a performance timer
     */
    createTimer(label: string): () => number {
        const startTime = performance.now();
        this.time(label);
        
        return () => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            this.timeEnd(label);
            return duration;
        };
    }

    /**
     * Log with structured data for better debugging
     */
    structured(level: 'debug' | 'info' | 'warn' | 'error', message: string, data: Record<string, any>): void {
        const logData = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...data
        };
        
        this[level](message, logData);
    }
}