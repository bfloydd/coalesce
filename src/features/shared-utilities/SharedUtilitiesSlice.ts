import { ISharedUtilitiesSlice } from '../shared-contracts/slice-interfaces';
import { Logger } from './Logger';
import { DailyNote } from './DailyNote';
import { CommonHelpers } from './CommonHelpers';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';

/**
 * Shared Utilities Slice Implementation
 * 
 * This slice provides shared utilities and helper functions
 * used across multiple vertical slices in the architecture.
 */
export class SharedUtilitiesSlice implements ISharedUtilitiesSlice {
    private logger: Logger;
    private dailyNote: typeof DailyNote;
    private commonHelpers: typeof CommonHelpers;

    constructor() {
        this.logger = new Logger('SharedUtilities');
        this.dailyNote = DailyNote;
        this.commonHelpers = CommonHelpers;
        
        this.logger.debug('SharedUtilities slice initialized');
    }

    /**
     * Get logger instance for debugging and error reporting
     */
    getLogger(): (prefix?: string) => {
        debug(message?: unknown, ...optionalParams: unknown[]): void;
        info(message?: unknown, ...optionalParams: unknown[]): void;
        warn(message?: unknown, ...optionalParams: unknown[]): void;
        error(message?: unknown, ...optionalParams: unknown[]): void;
        on(level?: any): void;
        off(): void;
        isEnabled(): boolean;
    } {
        return (prefix?: string) => {
            const logger = new Logger(prefix ? `SharedUtilities-${prefix}` : 'SharedUtilities');
            return {
                debug: (message?: unknown, ...optionalParams: unknown[]) => 
                    logger.debug(message, ...optionalParams),
                info: (message?: unknown, ...optionalParams: unknown[]) => 
                    logger.info(message, ...optionalParams),
                warn: (message?: unknown, ...optionalParams: unknown[]) => 
                    logger.warn(message, ...optionalParams),
                error: (message?: unknown, ...optionalParams: unknown[]) => 
                    logger.error(message, ...optionalParams),
                on: (level?: any) => logger.on(level),
                off: () => logger.off(),
                isEnabled: () => logger.isEnabled()
            };
        };
    }

    /**
     * Get daily note detection and helper functions
     */
    getDailyNote(): {
        isDaily(app: AppWithInternalPlugins, filePath: string): boolean;
        getDailyNotePath(app: AppWithInternalPlugins, date?: Date): string | null;
    } {
        return {
            isDaily: (app: AppWithInternalPlugins, filePath: string) => {
                this.logger.debug('Checking if file is daily note', { filePath });
                const result = this.dailyNote.isDaily(app, filePath);
                this.logger.debug('Daily note check result', { filePath, isDaily: result });
                return result;
            },
            getDailyNotePath: (app: AppWithInternalPlugins, date?: Date) => {
                this.logger.debug('Getting daily note path', { date });
                const result = this.dailyNote.getDailyNotePath(app, date);
                this.logger.debug('Daily note path result', { date, path: result });
                return result;
            }
        };
    }

    /**
     * Get common helper functions used across slices
     */
    getHelpers(): {
        escapeRegexChars(text: string): string;
        debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;
    } {
        return {
            escapeRegexChars: (text: string) => {
                this.logger.debug('Escaping regex characters', { textLength: text.length });
                return this.commonHelpers.escapeRegexChars(text);
            },
            debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => {
                this.logger.debug('Creating debounced function', { wait });
                return this.commonHelpers.debounce(func, wait);
            }
        };
    }

    /**
     * Get extended helper functions for advanced use cases
     */
    getExtendedHelpers(): typeof CommonHelpers {
        this.logger.debug('Providing extended helpers');
        return this.commonHelpers;
    }

    /**
     * Get performance monitoring utilities
     */
    getPerformanceUtils(): {
        createTimer(label: string): () => number;
        measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T>;
    } {
        return {
            createTimer: (label: string) => {
                this.logger.debug('Creating performance timer', { label });
                return this.logger.createTimer(label);
            },
            measureAsync: async <T>(label: string, fn: () => Promise<T>) => {
                this.logger.debug('Starting async measurement', { label });
                const timer = this.getPerformanceUtils().createTimer(label);
                try {
                    const result = await fn();
                    timer();
                    this.logger.debug('Async measurement completed', { label });
                    return result;
                } catch (error) {
                    timer();
                    this.logger.error('Async measurement failed', { label, error });
                    throw error;
                }
            }
        };
    }

    /**
     * Get validation utilities
     */
    getValidationUtils(): {
        isValidFilePath(path: string): boolean;
        isValidMarkdownPath(path: string): boolean;
        sanitizeFileName(name: string): string;
    } {
        return {
            isValidFilePath: (path: string) => {
                this.logger.debug('Validating file path', { path });
                // Basic validation - non-empty, no invalid characters
                const isValid = Boolean(path &&
                    path.length > 0 &&
                    !path.includes('<') &&
                    !path.includes('>') &&
                    !path.includes('|') &&
                    !path.includes('?') &&
                    !path.includes('*'));
                
                this.logger.debug('File path validation result', { path, isValid });
                return isValid;
            },
            isValidMarkdownPath: (path: string) => {
                this.logger.debug('Validating markdown path', { path });
                const isValid = this.getValidationUtils().isValidFilePath(path) && 
                    path.toLowerCase().endsWith('.md');
                
                this.logger.debug('Markdown path validation result', { path, isValid });
                return isValid;
            },
            sanitizeFileName: (name: string) => {
                this.logger.debug('Sanitizing file name', { name });
                const sanitized = name
                    .replace(/[<>:"|?*]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                this.logger.debug('File name sanitization result', { name, sanitized });
                return sanitized;
            }
        };
    }

    /**
     * Get error handling utilities
     */
    getErrorUtils(): {
        createError(context: string, message: string, data?: any): Error;
        logError(error: Error, context: string, data?: any): void;
        isRetryableError(error: Error): boolean;
    } {
        return {
            createError: (context: string, message: string, data?: any) => {
                this.logger.debug('Creating error', { context, message });
                const error = new Error(`${context}: ${message}`);
                (error as any).context = context;
                (error as any).data = data;
                return error;
            },
            logError: (error: Error, context: string, data?: any) => {
                this.logger.logErrorWithContext(error, context, data);
            },
            isRetryableError: (error: Error) => {
                // Define which errors are retryable
                const retryableErrors = [
                    'NetworkError',
                    'TimeoutError',
                    'ConnectionError'
                ];
                
                const isRetryable = retryableErrors.includes(error.name) ||
                    error.message.includes('timeout') ||
                    error.message.includes('network');
                
                this.logger.debug('Checking if error is retryable', { 
                    errorName: error.name, 
                    errorMessage: error.message, 
                    isRetryable 
                });
                
                return isRetryable;
            }
        };
    }

    /**
     * Cleanup resources used by this slice
     */
    cleanup(): void {
        this.logger.debug('Cleaning up SharedUtilities slice');
        // No specific cleanup needed for this slice currently
        this.logger.debug('SharedUtilities slice cleanup completed');
    }

    /**
     * Get slice statistics for monitoring
     */
    getStatistics(): {
        loggerEnabled: boolean;
        loggerLevel: string;
        dailyNotesConfigured: boolean;
    } {
        return {
            loggerEnabled: this.logger.isEnabled(),
            loggerLevel: 'INFO', // Could be enhanced to track actual level
            dailyNotesConfigured: true // Could be enhanced to check actual configuration
        };
    }
}

// Export the interface for external use
export type { ISharedUtilitiesSlice } from '../shared-contracts/slice-interfaces';