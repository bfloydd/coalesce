/**
 * Common Helper Functions for Vertical Slice Architecture
 * 
 * Provides utility functions used across multiple slices
 * to avoid code duplication and maintain consistency.
 */
export class CommonHelpers {
    /**
     * Escape special characters in a string for use in regex
     * 
     * @param text The text to escape
     * @returns The escaped text safe for use in regex patterns
     */
    static escapeRegexChars(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Debounce function calls to improve performance
     * 
     * @param func The function to debounce
     * @param wait The delay in milliseconds
     * @returns A debounced version of the function
     */
    static debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
        let timeout: NodeJS.Timeout;
        
        return ((...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        }) as T;
    }

    /**
     * Throttle function calls to limit execution frequency
     * 
     * @param func The function to throttle
     * @param limit The time limit in milliseconds
     * @returns A throttled version of the function
     */
    static throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
        let inThrottle: boolean;
        
        return ((...args: Parameters<T>) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }) as T;
    }

    /**
     * Deep clone an object to avoid reference issues
     *
     * @param obj The object to clone
     * @returns A deep copy of the object
     */
    static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => CommonHelpers.deepClone(item)) as unknown as T;
        }

        if (typeof obj === 'object') {
            const clonedObj = {} as { [key: string]: any };
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    clonedObj[key] = CommonHelpers.deepClone((obj as any)[key]);
                }
            }
            return clonedObj as T;
        }

        return obj;
    }

    /**
     * Generate a unique ID for elements or tracking
     * 
     * @param prefix Optional prefix for the ID
     * @returns A unique ID string
     */
    static generateUniqueId(prefix: string = 'id'): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if a value is empty or null/undefined
     * 
     * @param value The value to check
     * @returns True if the value is empty, null, or undefined
     */
    static isEmpty(value: any): boolean {
        if (value === null || value === undefined) {
            return true;
        }
        
        if (typeof value === 'string') {
            return value.trim().length === 0;
        }
        
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        
        if (typeof value === 'object') {
            return Object.keys(value).length === 0;
        }
        
        return false;
    }

    /**
     * Format file size in human-readable format
     * 
     * @param bytes The size in bytes
     * @returns Formatted file size string
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Truncate text to a specified length with ellipsis
     * 
     * @param text The text to truncate
     * @param maxLength The maximum length
     * @param suffix The suffix to add when truncated (default: '...')
     * @returns The truncated text
     */
    static truncateText(text: string, maxLength: number, suffix: string = '...'): string {
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Sanitize a string for use in HTML attributes
     * 
     * @param text The text to sanitize
     * @returns Sanitized text safe for HTML attributes
     */
    static sanitizeHtmlAttribute(text: string): string {
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;');
    }

    /**
     * Extract filename from a file path
     * 
     * @param filePath The file path
     * @param includeExtension Whether to include the file extension
     * @returns The filename
     */
    static getFilename(filePath: string, includeExtension: boolean = true): string {
        const filename = filePath.split(/[\\/]/).pop() || '';
        
        if (!includeExtension) {
            const lastDotIndex = filename.lastIndexOf('.');
            return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
        }
        
        return filename;
    }

    /**
     * Extract directory path from a file path
     * 
     * @param filePath The file path
     * @returns The directory path
     */
    static getDirectoryPath(filePath: string): string {
        const pathSeparator = filePath.includes('/') ? '/' : '\\';
        const parts = filePath.split(pathSeparator);
        return parts.slice(0, -1).join(pathSeparator);
    }

    /**
     * Normalize a file path to use forward slashes
     * 
     * @param filePath The file path to normalize
     * @returns Normalized file path
     */
    static normalizePath(filePath: string): string {
        return filePath.replace(/\\/g, '/');
    }

    /**
     * Check if a string matches a pattern (supports wildcards)
     * 
     * @param text The text to check
     * @param pattern The pattern (supports * and ? wildcards)
     * @returns True if the text matches the pattern
     */
    static matchesPattern(text: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(text);
    }

    /**
     * Create a retry wrapper for async functions
     * 
     * @param func The async function to retry
     * @param maxAttempts Maximum number of retry attempts
     * @param delay Delay between attempts in milliseconds
     * @returns A function that will retry on failure
     */
    static async withRetry<T>(
        func: () => Promise<T>,
        maxAttempts: number = 3,
        delay: number = 1000
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await func();
            } catch (error) {
                lastError = error as Error;
                
                if (attempt === maxAttempts) {
                    throw lastError;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
        
        throw lastError!;
    }

    /**
     * Create a timeout wrapper for async functions
     * 
     * @param func The async function to wrap
     * @param timeoutMs Timeout in milliseconds
     * @returns A function that will timeout after the specified duration
     */
    static async withTimeout<T>(
        func: () => Promise<T>,
        timeoutMs: number
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
        });
        
        return Promise.race([func(), timeoutPromise]);
    }

    /**
     * Batch process an array of items
     * 
     * @param items The items to process
     * @param processor The async processing function
     * @param batchSize The size of each batch
     * @param delayBetweenBatches Delay between batches in milliseconds
     * @returns Promise that resolves when all items are processed
     */
    static async batchProcess<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        batchSize: number = 10,
        delayBetweenBatches: number = 0
    ): Promise<R[]> {
        const results: R[] = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(processor));
            results.push(...batchResults);
            
            // Add delay between batches (except for the last batch)
            if (delayBetweenBatches > 0 && i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        
        return results;
    }

    /**
     * Create a simple memoization cache
     * 
     * @param func The function to memoize
     * @returns A memoized version of the function
     */
    static memoize<T extends (...args: any[]) => any>(func: T): T {
        const cache = new Map<string, ReturnType<T>>();
        
        return ((...args: Parameters<T>) => {
            const key = JSON.stringify(args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = func(...args);
            cache.set(key, result);
            return result;
        }) as T;
    }

    /**
     * Get a nested property from an object safely
     * 
     * @param obj The object to get property from
     * @param path The property path (e.g., 'a.b.c')
     * @param defaultValue Default value if property doesn't exist
     * @returns The property value or default
     */
    static getNestedProperty<T>(
        obj: any,
        path: string,
        defaultValue: T
    ): T {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current as T;
    }

    /**
     * Set a nested property on an object safely
     * 
     * @param obj The object to set property on
     * @param path The property path (e.g., 'a.b.c')
     * @param value The value to set
     */
    static setNestedProperty(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
}