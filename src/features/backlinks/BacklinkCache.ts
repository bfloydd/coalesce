import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IBacklinkCache, BacklinkCacheEntry } from './types';

/**
 * Backlink Cache for Backlinks Slice
 * 
 * Handles caching of backlink data for performance
 * for the vertical slice architecture.
 */
export class BacklinkCache implements IBacklinkCache {
    private app: App;
    private logger: Logger;
    private cache: Map<string, BacklinkCacheEntry> = new Map();
    private cacheTimeout = 30000; // 30 seconds
    private maxCacheSize = 100;
    private statistics = {
        totalCachedFiles: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastCleanup: new Date()
    };

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('BacklinkCache');
        
        this.logger.debug('BacklinkCache initialized');
    }

    /**
     * Get cached backlinks for a file
     */
    getCachedBacklinks(filePath: string): string[] | null {
        this.logger.debug('Getting cached backlinks', { filePath });
        
        try {
            const cacheEntry = this.cache.get(filePath);
            
            if (!cacheEntry) {
                this.statistics.cacheMisses++;
                this.logger.debug('Cache miss', { filePath });
                return null;
            }
            
            // Check if cache is still valid
            if (!this.isCacheEntryValid(cacheEntry)) {
                this.cache.delete(filePath);
                this.statistics.cacheMisses++;
                this.logger.debug('Cache entry expired', { filePath });
                return null;
            }
            
            this.statistics.cacheHits++;
            this.logger.debug('Cache hit', { 
                filePath, 
                backlinkCount: cacheEntry.backlinks.length 
            });
            
            return [...cacheEntry.backlinks]; // Return a copy
        } catch (error) {
            this.logger.error('Failed to get cached backlinks', { filePath, error });
            return null;
        }
    }

    /**
     * Cache backlinks for a file
     */
    cacheBacklinks(filePath: string, backlinks: string[]): void {
        this.logger.debug('Caching backlinks', { filePath, backlinkCount: backlinks.length });
        
        try {
            // Get file modification time
            const file = this.app.vault.getAbstractFileByPath(filePath);
            let fileModifiedTime = 0;
            
            if (file && file instanceof TFile) {
                fileModifiedTime = file.stat.mtime;
            }
            
            // Create cache entry
            const cacheEntry: BacklinkCacheEntry = {
                filePath,
                backlinks: [...backlinks], // Store a copy
                timestamp: new Date(),
                fileModifiedTime,
                isValid: true
            };
            
            // Add to cache
            this.cache.set(filePath, cacheEntry);
            
            // Update statistics
            this.statistics.totalCachedFiles = this.cache.size;
            
            // Check if we need to cleanup
            if (this.cache.size > this.maxCacheSize) {
                this.cleanupCache();
            }
            
            this.logger.debug('Backlinks cached successfully', { 
                filePath, 
                backlinkCount: backlinks.length,
                cacheSize: this.cache.size 
            });
        } catch (error) {
            this.logger.error('Failed to cache backlinks', { filePath, error });
        }
    }

    /**
     * Invalidate cache for a file
     */
    invalidateCache(filePath: string): void {
        this.logger.debug('Invalidating cache', { filePath });
        
        try {
            const existed = this.cache.has(filePath);
            this.cache.delete(filePath);
            
            // Update statistics
            this.statistics.totalCachedFiles = this.cache.size;
            
            this.logger.debug('Cache invalidated', { 
                filePath, 
                existed,
                cacheSize: this.cache.size 
            });
        } catch (error) {
            this.logger.error('Failed to invalidate cache', { filePath, error });
        }
    }

    /**
     * Clear all cache
     */
    clearCache(): void {
        this.logger.debug('Clearing all cache');
        
        try {
            const previousSize = this.cache.size;
            this.cache.clear();
            
            // Reset statistics
            this.statistics.totalCachedFiles = 0;
            this.statistics.cacheHits = 0;
            this.statistics.cacheMisses = 0;
            this.statistics.lastCleanup = new Date();
            
            this.logger.debug('All cache cleared', { previousSize });
        } catch (error) {
            this.logger.error('Failed to clear cache', { error });
        }
    }

    /**
     * Check if cache is valid for a file
     */
    isCacheValid(filePath: string): boolean {
        this.logger.debug('Checking cache validity', { filePath });
        
        try {
            const cacheEntry = this.cache.get(filePath);
            
            if (!cacheEntry) {
                this.logger.debug('No cache entry found', { filePath });
                return false;
            }
            
            const isValid = this.isCacheEntryValid(cacheEntry);
            
            this.logger.debug('Cache validity check completed', { 
                filePath, 
                isValid 
            });
            
            return isValid;
        } catch (error) {
            this.logger.error('Failed to check cache validity', { filePath, error });
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStatistics(): {
        totalCachedFiles: number;
        cacheHits: number;
        cacheMisses: number;
        lastCleanup?: Date;
        cacheHitRate: number;
    } {
        // Calculate cache hit rate
        const totalRequests = this.statistics.cacheHits + this.statistics.cacheMisses;
        const cacheHitRate = totalRequests > 0 ? this.statistics.cacheHits / totalRequests : 0;
        
        return {
            ...this.statistics,
            cacheHitRate
        };
    }

    /**
     * Set cache timeout
     */
    setCacheTimeout(timeout: number): void {
        this.logger.debug('Setting cache timeout', { timeout });
        
        this.cacheTimeout = timeout;
        
        this.logger.debug('Cache timeout set successfully', { timeout });
    }

    /**
     * Set maximum cache size
     */
    setMaxCacheSize(size: number): void {
        this.logger.debug('Setting maximum cache size', { size });
        
        this.maxCacheSize = size;
        
        // Cleanup if needed
        if (this.cache.size > this.maxCacheSize) {
            this.cleanupCache();
        }
        
        this.logger.debug('Maximum cache size set successfully', { size });
    }

    /**
     * Check if a cache entry is still valid
     */
    private isCacheEntryValid(cacheEntry: BacklinkCacheEntry): boolean {
        try {
            // Check timestamp
            const now = new Date();
            const age = now.getTime() - cacheEntry.timestamp.getTime();
            
            if (age > this.cacheTimeout) {
                this.logger.debug('Cache entry expired due to age', { 
                    filePath: cacheEntry.filePath,
                    age,
                    timeout: this.cacheTimeout
                });
                return false;
            }
            
            // Check file modification time
            const file = this.app.vault.getAbstractFileByPath(cacheEntry.filePath);
            if (file && file instanceof TFile) {
                if (file.stat.mtime > cacheEntry.fileModifiedTime) {
                    this.logger.debug('Cache entry expired due to file modification', { 
                        filePath: cacheEntry.filePath,
                        cacheModifiedTime: cacheEntry.fileModifiedTime,
                        fileModifiedTime: file.stat.mtime
                    });
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            this.logger.error('Failed to check cache entry validity', { cacheEntry, error });
            return false;
        }
    }

    /**
     * Cleanup expired cache entries
     */
    private cleanupCache(): void {
        this.logger.debug('Cleaning up cache');
        
        try {
            const entriesToRemove: string[] = [];
            const now = new Date();
            
            // Find expired entries
            for (const [filePath, cacheEntry] of this.cache.entries()) {
                if (!this.isCacheEntryValid(cacheEntry)) {
                    entriesToRemove.push(filePath);
                }
            }
            
            // Remove expired entries
            for (const filePath of entriesToRemove) {
                this.cache.delete(filePath);
            }
            
            // If still too many entries, remove oldest ones
            if (this.cache.size > this.maxCacheSize) {
                const entries = Array.from(this.cache.entries());
                entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
                
                const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
                for (const [filePath] of toRemove) {
                    this.cache.delete(filePath);
                }
            }
            
            // Update statistics
            this.statistics.totalCachedFiles = this.cache.size;
            this.statistics.lastCleanup = now;
            
            this.logger.debug('Cache cleanup completed', { 
                removedCount: entriesToRemove.length,
                cacheSize: this.cache.size 
            });
        } catch (error) {
            this.logger.error('Failed to cleanup cache', { error });
        }
    }

    /**
     * Get cache entry for debugging
     */
    getCacheEntry(filePath: string): BacklinkCacheEntry | null {
        return this.cache.get(filePath) || null;
    }

    /**
     * Get all cache entries for debugging
     */
    getAllCacheEntries(): BacklinkCacheEntry[] {
        return Array.from(this.cache.values());
    }

    /**
     * Cleanup resources used by this backlink cache
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinkCache');
        
        // Clear cache
        this.clearCache();
        
        this.logger.debug('BacklinkCache cleanup completed');
    }
}