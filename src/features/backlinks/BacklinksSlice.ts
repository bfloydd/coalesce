import { App } from 'obsidian';
import { IBacklinksSlice } from '../shared-contracts/slice-interfaces';
import { BacklinkDiscoverer } from './BacklinkDiscoverer';
import { LinkResolver } from './LinkResolver';
import { BacklinkCache } from './BacklinkCache';
import { Logger } from '../shared-utilities/Logger';
import { DailyNote } from '../shared-utilities/DailyNote';
import { BacklinkDiscoveryOptions, BacklinkFilterOptions, BacklinkStatistics } from './types';
import { CoalesceEvent, EventHandler, BacklinksUpdatedEvent } from '../shared-contracts/events';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';

/**
 * Backlinks Slice Implementation
 * 
 * This slice handles backlink discovery, link resolution, and cache management
 * for the vertical slice architecture.
 */
export class BacklinksSlice implements IBacklinksSlice {
    private app: App;
    private logger: Logger;
    private backlinkDiscoverer: BacklinkDiscoverer;
    private linkResolver: LinkResolver;
    private backlinkCache: BacklinkCache;
    private options: BacklinkDiscoveryOptions;
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private currentBacklinks: Map<string, string[]> = new Map();

    constructor(app: App, options?: Partial<BacklinkDiscoveryOptions>) {
        this.app = app;
        this.logger = new Logger('BacklinksSlice');
        
        // Set default options
        this.options = {
            includeResolved: true,
            includeUnresolved: true,
            useCache: true,
            cacheTimeout: 30000, // 30 seconds
            onlyDailyNotes: false,
            ...options
        };
        
        // Initialize components
        this.backlinkDiscoverer = new BacklinkDiscoverer(app, this.logger, this.options);
        this.linkResolver = new LinkResolver(app, this.logger);
        this.backlinkCache = new BacklinkCache(app, this.logger);
        
        this.logger.debug('BacklinksSlice initialized', { options: this.options });
    }

    /**
     * Update backlinks for a file
     */
    async updateBacklinks(filePath: string, leafId?: string): Promise<string[]> {
        this.logger.debug('Updating backlinks', { filePath, leafId });
        
        try {
            // Check if we should skip daily notes
            if (this.options.onlyDailyNotes && 
                DailyNote.isDaily(this.app as AppWithInternalPlugins, filePath)) {
                this.logger.debug('Skipping daily note', { filePath });
                const emptyBacklinks: string[] = [];
                this.currentBacklinks.set(filePath, emptyBacklinks);
                return emptyBacklinks;
            }
            
            // Try to get from cache first
            let backlinks: string[] = [];
            let fromCache = false;
            
            if (this.options.useCache) {
                const cachedBacklinks = this.backlinkCache.getCachedBacklinks(filePath);
                if (cachedBacklinks) {
                    backlinks = cachedBacklinks;
                    fromCache = true;
                    this.logger.debug('Backlinks retrieved from cache', { 
                        filePath, 
                        count: backlinks.length 
                    });
                }
            }
            
            // If not from cache, discover backlinks
            if (!fromCache) {
                backlinks = await this.backlinkDiscoverer.discoverBacklinks(filePath);
                
                // Cache the results
                if (this.options.useCache) {
                    this.backlinkCache.cacheBacklinks(filePath, backlinks);
                }
                
                this.logger.debug('Backlinks discovered', { 
                    filePath, 
                    count: backlinks.length 
                });
            }
            
            // Store current backlinks
            this.currentBacklinks.set(filePath, backlinks);
            
            // Emit event
            this.emitEvent({
                type: 'backlinks:updated',
                payload: {
                    files: backlinks,
                    leafId: leafId || '',
                    count: backlinks.length
                }
            });
            
            this.logger.debug('Backlinks updated successfully', { 
                filePath, 
                count: backlinks.length,
                fromCache 
            });
            
            return backlinks;
        } catch (error) {
            this.logger.error('Failed to update backlinks', { filePath, error });
            return [];
        }
    }

    /**
     * Get current backlinks for a file
     */
    getCurrentBacklinks(filePath: string): string[] {
        this.logger.debug('Getting current backlinks', { filePath });
        
        try {
            const backlinks = this.currentBacklinks.get(filePath) || [];
            
            this.logger.debug('Current backlinks retrieved', { 
                filePath, 
                count: backlinks.length 
            });
            
            return backlinks;
        } catch (error) {
            this.logger.error('Failed to get current backlinks', { filePath, error });
            return [];
        }
    }

    /**
     * Discover backlinks for a given file (required by interface)
     */
    async discoverBacklinks(filePath: string): Promise<string[]> {
        this.logger.debug('Discovering backlinks', { filePath });

        try {
            const backlinks = await this.updateBacklinks(filePath);

            this.logger.debug('Backlinks discovered successfully', {
                filePath,
                count: backlinks.length
            });

            return backlinks;
        } catch (error) {
            this.logger.error('Failed to discover backlinks', { filePath, error });
            return [];
        }
    }

    /**
     * Get cached backlinks (required by interface)
     */
    getCachedBacklinks(filePath: string): string[] | null {
        this.logger.debug('Getting cached backlinks', { filePath });

        try {
            const cachedBacklinks = this.backlinkCache.getCachedBacklinks(filePath);

            this.logger.debug('Cached backlinks retrieved', {
                filePath,
                found: cachedBacklinks !== null,
                count: cachedBacklinks?.length || 0
            });

            return cachedBacklinks;
        } catch (error) {
            this.logger.error('Failed to get cached backlinks', { filePath, error });
            return null;
        }
    }

    /**
     * Clear cache (required by interface)
     */
    clearCache(filePath?: string): void {
        this.logger.debug('Clearing cache', { filePath });

        try {
            if (filePath) {
                // Clear cache for specific file
                this.backlinkCache.invalidateCache(filePath);
                this.currentBacklinks.delete(filePath);
            } else {
                // Clear all cache
                this.backlinkCache.clearCache();
                this.currentBacklinks.clear();
            }

            this.logger.debug('Cache cleared successfully', { filePath });
        } catch (error) {
            this.logger.error('Failed to clear cache', { filePath, error });
        }
    }

    /**
     * Get backlink metadata (required by interface)
     */
    getBacklinkMetadata(): { lastUpdated: Date; cacheSize: number; } {
        this.logger.debug('Getting backlink metadata');

        try {
            const cacheStats = this.backlinkCache.getCacheStatistics();
            const metadata = {
                lastUpdated: cacheStats.lastCleanup || new Date(),
                cacheSize: cacheStats.totalCachedFiles
            };

            this.logger.debug('Backlink metadata retrieved', metadata);

            return metadata;
        } catch (error) {
            this.logger.error('Failed to get backlink metadata', { error });

            // Return default metadata on error
            return {
                lastUpdated: new Date(),
                cacheSize: 0
            };
        }
    }

    /**
     * Check if backlinks have changed
     */
    haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean {
        this.logger.debug('Checking if backlinks have changed', { filePath, newBacklinksCount: newBacklinks.length });

        try {
            const currentBacklinks = this.currentBacklinks.get(filePath) || [];

            // Check if counts are different
            if (currentBacklinks.length !== newBacklinks.length) {
                this.logger.debug('Backlinks count changed', {
                    filePath,
                    oldCount: currentBacklinks.length,
                    newCount: newBacklinks.length
                });
                return true;
            }

            // Check if content is different
            const currentSorted = [...currentBacklinks].sort();
            const newSorted = [...newBacklinks].sort();

            for (let i = 0; i < currentSorted.length; i++) {
                if (currentSorted[i] !== newSorted[i]) {
                    this.logger.debug('Backlinks content changed', {
                        filePath,
                        oldBacklink: currentSorted[i],
                        newBacklink: newSorted[i]
                    });
                    return true;
                }
            }

            this.logger.debug('Backlinks unchanged', { filePath });
            return false;
        } catch (error) {
            this.logger.error('Failed to check if backlinks changed', { filePath, error });
            return true; // Assume changed on error
        }
    }

    /**
     * Invalidate cache for a file
     */
    invalidateCache(filePath: string): void {
        this.logger.debug('Invalidating cache', { filePath });
        
        try {
            this.backlinkCache.invalidateCache(filePath);
            
            this.logger.debug('Cache invalidated successfully', { filePath });
        } catch (error) {
            this.logger.error('Failed to invalidate cache', { filePath, error });
        }
    }

    /**
     * Clear all backlinks
     */
    clearBacklinks(): void {
        this.logger.debug('Clearing all backlinks');
        
        try {
            // Clear current backlinks
            this.currentBacklinks.clear();
            
            // Clear cache
            this.backlinkCache.clearCache();
            
            this.logger.debug('All backlinks cleared successfully');
        } catch (error) {
            this.logger.error('Failed to clear backlinks', { error });
        }
    }

    /**
     * Get backlink discoverer
     */
    getBacklinkDiscoverer(): BacklinkDiscoverer {
        return this.backlinkDiscoverer;
    }

    /**
     * Get link resolver
     */
    getLinkResolver(): LinkResolver {
        return this.linkResolver;
    }

    /**
     * Get backlink cache
     */
    getBacklinkCache(): BacklinkCache {
        return this.backlinkCache;
    }

    /**
     * Get statistics
     */
    getStatistics(): BacklinkStatistics {
        return this.backlinkDiscoverer.getStatistics();
    }

    /**
     * Update options
     */
    updateOptions(options: Partial<BacklinkDiscoveryOptions>): void {
        this.logger.debug('Updating options', { options });
        
        this.options = { ...this.options, ...options };
        
        // Update discoverer options
        this.backlinkDiscoverer.updateOptions(options);
        
        this.logger.debug('Options updated successfully', { options: this.options });
    }

    /**
     * Get current options
     */
    getOptions(): BacklinkDiscoveryOptions {
        return { ...this.options };
    }

    /**
     * Filter backlinks based on criteria
     */
    filterBacklinks(backlinks: string[], filePath: string, options?: BacklinkFilterOptions): string[] {
        this.logger.debug('Filtering backlinks', { backlinkCount: backlinks.length, filePath, options });
        
        try {
            let filteredBacklinks = [...backlinks];
            
            // Apply discoverer filtering
            filteredBacklinks = this.backlinkDiscoverer.filterBacklinks(filteredBacklinks, {
                excludeDailyNotes: options?.excludeDailyNotes,
                excludeCurrentFile: options?.excludeCurrentFile ? filePath : undefined,
                sortByPath: options?.sortByPath
            });
            
            // Apply alias filtering if specified
            if (options?.filterByAlias) {
                // This would need more complex implementation for alias filtering
                // For now, just log that alias filtering is requested
                this.logger.debug('Alias filtering requested but not implemented', { 
                    alias: options.filterByAlias 
                });
            }
            
            this.logger.debug('Backlinks filtered successfully', { 
                originalCount: backlinks.length,
                filteredCount: filteredBacklinks.length
            });
            
            return filteredBacklinks;
        } catch (error) {
            this.logger.error('Failed to filter backlinks', { backlinks, options, error });
            return backlinks;
        }
    }

    /**
     * Emit an event
     */
    private emitEvent(event: CoalesceEvent): void {
        this.logger.debug('Emitting event', { event });
        
        try {
            const handlers = this.eventHandlers.get(event.type) || [];
            
            for (const handler of handlers) {
                try {
                    handler(event);
                } catch (error) {
                    this.logger.error('Event handler failed', { event, error });
                }
            }
            
            this.logger.debug('Event emitted successfully', { event });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Add event listener
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Adding event listener', { eventType });
        
        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            handlers.push(handler as EventHandler);
            this.eventHandlers.set(eventType, handlers);
            
            this.logger.debug('Event listener added successfully', { eventType });
        } catch (error) {
            this.logger.error('Failed to add event listener', { eventType, error });
        }
    }

    /**
     * Remove event listener
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Removing event listener', { eventType });
        
        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);
            
            if (index !== -1) {
                handlers.splice(index, 1);
                this.eventHandlers.set(eventType, handlers);
                
                this.logger.debug('Event listener removed successfully', { eventType });
            } else {
                this.logger.debug('Event listener not found', { eventType });
            }
        } catch (error) {
            this.logger.error('Failed to remove event listener', { eventType, error });
        }
    }

    /**
     * Cleanup resources used by this slice
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinksSlice');
        
        try {
            // Cleanup components
            this.backlinkDiscoverer.cleanup();
            this.linkResolver.cleanup();
            this.backlinkCache.cleanup();
            
            // Clear data
            this.currentBacklinks.clear();
            this.eventHandlers.clear();
            
            this.logger.debug('BacklinksSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BacklinksSlice', { error });
        }
    }
}

// Export the interface for external use
export type { IBacklinksSlice } from '../shared-contracts/slice-interfaces';