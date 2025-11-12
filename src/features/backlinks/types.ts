// ============================
// Backlinks Slice Types
// ============================

import { App, TFile } from 'obsidian';

// ============================
// Backlink Discoverer Interface
// ============================

export interface IBacklinkDiscoverer {
    /**
     * Discover files linking to the current note
     */
    discoverBacklinks(currentFilePath: string): Promise<string[]>;
    
    /**
     * Get resolved backlinks (files that link directly)
     */
    getResolvedBacklinks(currentFilePath: string): string[];
    
    /**
     * Get unresolved backlinks (files that link by name)
     */
    getUnresolvedBacklinks(currentFilePath: string): string[];
    
    /**
     * Check if a file has backlinks
     */
    hasBacklinks(filePath: string): boolean;
    
    /**
     * Get backlink count for a file
     */
    getBacklinkCount(filePath: string): number;
}

// ============================
// Link Resolver Interface
// ============================

export interface ILinkResolver {
    /**
     * Resolve a link path to an actual file path
     */
    resolveLink(linkPath: string, sourceFilePath: string): string | null;
    
    /**
     * Check if a link is resolved
     */
    isLinkResolved(linkPath: string, sourceFilePath: string): boolean;
    
    /**
     * Get all possible resolutions for a link
     */
    getPossibleResolutions(linkPath: string): string[];
    
    /**
     * Normalize a link path
     */
    normalizeLinkPath(linkPath: string): string;
}

// ============================
// Backlink Cache Interface
// ============================

export interface IBacklinkCache {
    /**
     * Get cached backlinks for a file
     */
    getCachedBacklinks(filePath: string): string[] | null;
    
    /**
     * Cache backlinks for a file
     */
    cacheBacklinks(filePath: string, backlinks: string[]): void;
    
    /**
     * Invalidate cache for a file
     */
    invalidateCache(filePath: string): void;
    
    /**
     * Clear all cache
     */
    clearCache(): void;
    
    /**
     * Check if cache is valid for a file
     */
    isCacheValid(filePath: string): boolean;
    
    /**
     * Get cache statistics
     */
    getCacheStatistics(): {
        totalCachedFiles: number;
        cacheHits: number;
        cacheMisses: number;
        lastCleanup?: Date;
    };
}

// ============================
// Backlink Data Structure
// ============================

export interface BacklinkData {
    filePath: string;
    backlinks: string[];
    resolvedBacklinks: string[];
    unresolvedBacklinks: string[];
    lastUpdated: Date;
    cacheValid: boolean;
}

// ============================
// Backlink Discovery Options
// ============================

export interface BacklinkDiscoveryOptions {
    includeResolved: boolean;
    includeUnresolved: boolean;
    useCache: boolean;
    cacheTimeout: number; // in milliseconds
    onlyDailyNotes: boolean;
}

// ============================
// Backlink Resolution Result
// ============================

export interface BacklinkResolutionResult {
    originalLink: string;
    resolvedPath: string | null;
    isResolved: boolean;
    possibleResolutions: string[];
    resolutionMethod: 'direct' | 'name' | 'alias' | 'failed';
}

// ============================
// Backlink Cache Entry
// ============================

export interface BacklinkCacheEntry {
    filePath: string;
    backlinks: string[];
    timestamp: Date;
    fileModifiedTime: number;
    isValid: boolean;
}

// ============================
// Backlink Statistics
// ============================

export interface BacklinkStatistics {
    totalFilesChecked: number;
    filesWithBacklinks: number;
    totalBacklinksFound: number;
    resolvedBacklinks: number;
    unresolvedBacklinks: number;
    averageBacklinksPerFile: number;
    cacheHitRate: number;
    lastDiscoveryTime?: Date;
}

// ============================
// Backlink Event Data
// ============================

export interface BacklinkEventData {
    filePath: string;
    backlinks: string[];
    count: number;
    leafId?: string;
    timestamp: Date;
}

// ============================
// Backlink Filter Options
// ============================

export interface BacklinkFilterOptions {
    includeResolved: boolean;
    includeUnresolved: boolean;
    excludeDailyNotes: boolean;
    excludeCurrentFile: boolean;
    sortByPath: boolean;
    filterByAlias?: string;
}