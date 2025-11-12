// ============================
// Common Data Structures
// ============================
// These interfaces define common data structures used across slices

// ============================
// Backlink Data Structures
// ============================

export interface BacklinkData {
    /**
     * Path to the file containing the backlink
     */
    sourcePath: string;

    /**
     * Path to the target file (the file being linked to)
     */
    targetPath: string;

    /**
     * The link text used in the source file
     */
    linkText: string;

    /**
     * Whether the link is resolved (file exists) or unresolved
     */
    isResolved: boolean;

    /**
     * Line number where the backlink occurs
     */
    lineNumber?: number;

    /**
     * Context around the backlink (surrounding text)
     */
    context?: string;

    /**
     * Alias used if different from the target filename
     */
    alias?: string;

    /**
     * Timestamp when this backlink was discovered
     */
    discoveredAt: Date;
}

// ============================
// Block Data Structures
// ============================

export interface BlockData {
    /**
     * Unique identifier for this block
     */
    id: string;

    /**
     * Path to the source file containing this block
     */
    sourcePath: string;

    /**
     * The raw content of the block
     */
    content: string;

    /**
     * The processed content ready for rendering
     */
    processedContent: string;

    /**
     * Start line number in the source file
     */
    startLine: number;

    /**
     * End line number in the source file
     */
    endLine: number;

    /**
     * The note name this block is referencing
     */
    noteName: string;

    /**
     * Strategy used to extract this block
     */
    strategy: string;

    /**
     * Whether this block is currently collapsed
     */
    isCollapsed: boolean;

    /**
     * Whether this block is currently visible (after filtering)
     */
    isVisible: boolean;

    /**
     * Block metadata
     */
    metadata: {
        hasHeaders: boolean;
        headerCount: number;
        wordCount: number;
        charCount: number;
    };

    /**
     * Aliases found in this block
     */
    aliases: string[];

    /**
     * Timestamp when this block was extracted
     */
    extractedAt: Date;
}

// ============================
// Block Render Options
// ============================

export interface BlockRenderOptions {
    /**
     * Header style to use for block titles
     */
    headerStyle: string;

    /**
     * Block boundary strategy used
     */
    strategy: string;

    /**
     * Whether to hide the backlink line in rendered content
     */
    hideBacklinkLine: boolean;

    /**
     * Whether to hide the first header in rendered content
     */
    hideFirstHeader: boolean;

    /**
     * Theme to apply to rendered blocks
     */
    theme: string;

    /**
     * Callback for when links are clicked
     */
    onLinkClick: (path: string, openInNewTab?: boolean) => void;

    /**
     * Whether to show full path in titles
     */
    showFullPathTitle: boolean;

    /**
     * Maximum content length to render (for performance)
     */
    maxContentLength?: number;

    /**
     * Whether to enable syntax highlighting
     */
    enableSyntaxHighlighting: boolean;
}

// ============================
// Navigation Options
// ============================

export interface NavigationOptions {
    /**
     * Whether to open files in new tabs by default
     */
    defaultOpenInNewTab: boolean;

    /**
     * Whether to close current tab when opening in new tab
     */
    closeCurrentTab: boolean;

    /**
     * Navigation animation duration in milliseconds
     */
    animationDuration: number;

    /**
     * Whether to enable navigation history
     */
    enableHistory: boolean;

    /**
     * Maximum navigation history size
     */
    maxHistorySize: number;

    /**
     * Custom navigation handlers
     */
    customHandlers: Array<{
        pattern: RegExp;
        handler: (path: string, options: NavigationOptions) => boolean;
    }>;
}

// ============================
// Filter Options
// ============================

export interface FilterOptions {
    /**
     * Text to filter by (searches content and titles)
     */
    text?: string;

    /**
     * Alias to filter by (shows only blocks with this alias)
     */
    alias?: string | null;

    /**
     * Whether to show all blocks regardless of filters
     */
    showAll?: boolean;

    /**
     * Case sensitivity for text filtering
     */
    caseSensitive?: boolean;

    /**
     * Whether to use regex for text filtering
     */
    useRegex?: boolean;

    /**
     * File path patterns to include
     */
    includePatterns?: string[];

    /**
     * File path patterns to exclude
     */
    excludePatterns?: string[];

    /**
     * Date range filter
     */
    dateRange?: {
        start?: Date;
        end?: Date;
    };
}

// ============================
// Sort Options
// ============================

export interface SortOptions {
    /**
     * Whether to sort in descending order
     */
    descending: boolean;

    /**
     * Whether to sort by full path or just filename
     */
    sortByFullPath: boolean;

    /**
     * Primary sort field
     */
    primaryField: 'path' | 'filename' | 'modified' | 'created' | 'size' | 'content';

    /**
     * Secondary sort field (used when primary field values are equal)
     */
    secondaryField?: 'path' | 'filename' | 'modified' | 'created' | 'size' | 'content';

    /**
     * Custom sort comparator
     */
    customComparator?: (a: any, b: any) => number;

    /**
     * Whether sorting is stable (preserves original order for equal elements)
     */
    stable: boolean;
}

// ============================
// Cache Options
// ============================

export interface CacheOptions {
    /**
     * Maximum number of items to cache
     */
    maxSize: number;

    /**
     * Time-to-live for cache items in milliseconds
     */
    ttl: number;

    /**
     * Whether to enable cache compression
     */
    enableCompression: boolean;

    /**
     * Cache eviction strategy ('lru', 'fifo', 'lfu')
     */
    evictionStrategy: 'lru' | 'fifo' | 'lfu';

    /**
     * Whether to persist cache to disk
     */
    persistToDisk: boolean;

    /**
     * Cache key prefix
     */
    keyPrefix: string;
}

// ============================
// Performance Options
// ============================

export interface PerformanceOptions {
    /**
     * Whether to enable lazy loading
     */
    enableLazyLoading: boolean;

    /**
     * Debounce delay for user input in milliseconds
     */
    debounceDelay: number;

    /**
     * Throttle delay for scroll events in milliseconds
     */
    throttleDelay: number;

    /**
     * Maximum number of concurrent operations
     */
    maxConcurrentOperations: number;

    /**
     * Whether to enable virtual scrolling
     */
    enableVirtualScrolling: boolean;

    /**
     * Virtual scroll item height in pixels
     */
    virtualScrollItemHeight: number;

    /**
     * Whether to enable performance monitoring
     */
    enablePerformanceMonitoring: boolean;
}

// ============================
// Validation Options
// ============================

export interface ValidationOptions {
    /**
     * Whether to validate file paths
     */
    validateFilePaths: boolean;

    /**
     * Whether to validate content encoding
     */
    validateContentEncoding: boolean;

    /**
     * Maximum file size in bytes
     */
    maxFileSize: number;

    /**
     * Allowed file extensions
     */
    allowedExtensions: string[];

    /**
     * Whether to sanitize content
     */
    sanitizeContent: boolean;

    /**
     * Custom validation rules
     */
    customRules: Array<{
        name: string;
        validator: (value: any) => boolean;
        errorMessage: string;
    }>;
}

// ============================
// Error Handling Options
// ============================

export interface ErrorHandlingOptions {
    /**
     * Whether to retry failed operations
     */
    enableRetry: boolean;

    /**
     * Maximum number of retry attempts
     */
    maxRetryAttempts: number;

    /**
     * Delay between retry attempts in milliseconds
     */
    retryDelay: number;

    /**
     * Whether to log errors
     */
    logErrors: boolean;

    /**
     * Whether to show error notifications to user
     */
    showErrorNotifications: boolean;

    /**
     * Custom error handlers
     */
    customErrorHandlers: Array<{
        errorType: string;
        handler: (error: Error) => void;
    }>;
}