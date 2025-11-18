import { App } from 'obsidian';
import { Logger } from '../../shared-utilities/Logger';
import { DailyNote } from '../../shared-utilities/DailyNote';
import { BacklinkDiscoverer } from '../BacklinkDiscoverer';
import { BacklinkCache } from '../BacklinkCache';
import {
    BacklinkDiscoveryOptions,
    BacklinkFilterOptions,
    BacklinkStatistics
} from '../types';
import { AppWithInternalPlugins } from '../../shared-contracts/obsidian';
import { BacklinksState } from './BacklinksState';
import { BacklinksEvents } from './BacklinksEvents';
import { CoalesceEvent } from '../../shared-contracts/events';

/**
 * Core/domain service for the Backlinks feature.
 *
 * Responsibilities:
 * - Backlink discovery and cache orchestration
 * - Backlink-related state updates
 * - Emitting backlinks-related events
 *
 * This class is intentionally free of any DOM or view concerns.
 */
export class BacklinksCore {
    private options: BacklinkDiscoveryOptions;
    private backlinkDiscoverer: BacklinkDiscoverer;
    private backlinkCache: BacklinkCache;

    constructor(
        private readonly app: App,
        private readonly logger: Logger,
        options: Partial<BacklinkDiscoveryOptions> | BacklinkDiscoveryOptions,
        private readonly state: BacklinksState,
        private readonly events: BacklinksEvents
    ) {
        // Normalize options with defaults
        this.options = {
            includeResolved: true,
            includeUnresolved: true,
            useCache: true,
            cacheTimeout: 30000, // 30 seconds
            onlyDailyNotes: false,
            ...(options as Partial<BacklinkDiscoveryOptions>)
        };

        this.backlinkDiscoverer = new BacklinkDiscoverer(this.app, this.logger, this.options);
        this.backlinkCache = new BacklinkCache(this.app, this.logger);

        this.logger.debug('BacklinksCore initialized', { options: this.options });
    }

    /**
     * Update backlinks for a file and emit a backlinks:updated event.
     */
    async updateBacklinks(filePath: string, leafId?: string): Promise<string[]> {
        this.logger.debug('Updating backlinks', { filePath, leafId });

        // Check if we should skip daily notes
        if (
            this.options.onlyDailyNotes &&
            DailyNote.isDaily(this.app as AppWithInternalPlugins, filePath)
        ) {
            this.logger.debug('Skipping daily note', { filePath });
            const emptyBacklinks: string[] = [];
            this.state.setBacklinks(filePath, emptyBacklinks);
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

        // Store current backlinks in shared state
        this.state.setBacklinks(filePath, backlinks);

        // Emit event (keeps existing event contract)
        const event: CoalesceEvent = {
            type: 'backlinks:updated',
            payload: {
                files: backlinks,
                leafId: leafId || '',
                count: backlinks.length
            }
        } as any;
        this.events.emitEvent(event);

        this.logger.debug('Backlinks updated successfully', {
            filePath,
            count: backlinks.length,
            fromCache
        });

        return backlinks;
    }

    /**
     * Get current backlinks for a file from state.
     */
    getCurrentBacklinks(filePath: string): string[] {
        this.logger.debug('Getting current backlinks', { filePath });

        try {
            const backlinks = this.state.getBacklinks(filePath);

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
     * Discover backlinks for a given file (wrapper around updateBacklinks).
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
     * Get cached backlinks (from cache only, without discovery).
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
     * Clear cache for a specific file or for all files.
     */
    clearCache(filePath?: string): void {
        this.logger.debug('Clearing cache', { filePath });

        try {
            if (filePath) {
                // Clear cache for specific file
                this.backlinkCache.invalidateCache(filePath);
                this.state.clearBacklinks(filePath);
            } else {
                // Clear all cache
                this.backlinkCache.clearCache();
                this.state.clearBacklinks();
            }

            this.logger.debug('Cache cleared successfully', { filePath });
        } catch (error) {
            this.logger.error('Failed to clear cache', { filePath, error });
        }
    }

    /**
     * Invalidate cache for a file.
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
     * Clear all backlinks in state and cache.
     */
    clearBacklinks(): void {
        this.logger.debug('Clearing all backlinks');

        try {
            this.state.clearBacklinks();
            this.backlinkCache.clearCache();

            this.logger.debug('All backlinks cleared successfully');
        } catch (error) {
            this.logger.error('Failed to clear backlinks', { error });
        }
    }

    /**
     * Get backlink metadata (cache statistics).
     */
    getBacklinkMetadata(): { lastUpdated: Date; cacheSize: number } {
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
     * Check if backlinks have changed compared to the current state.
     */
    haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean {
        this.logger.debug('Checking if backlinks have changed', {
            filePath,
            newBacklinksCount: newBacklinks.length
        });

        try {
            const currentBacklinks = this.state.getBacklinks(filePath);

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
     * Filter backlinks based on criteria.
     */
    filterBacklinks(
        backlinks: string[],
        filePath: string,
        options?: BacklinkFilterOptions
    ): string[] {
        this.logger.debug('Filtering backlinks', {
            backlinkCount: backlinks.length,
            filePath,
            options
        });

        try {
            let filteredBacklinks = [...backlinks];

            // Apply discoverer filtering
            filteredBacklinks = this.backlinkDiscoverer.filterBacklinks(filteredBacklinks, {
                excludeDailyNotes: options?.excludeDailyNotes,
                excludeCurrentFile: options?.excludeCurrentFile ? filePath : undefined,
                sortByPath: options?.sortByPath
            });

            // Apply alias filtering if specified (not yet implemented)
            if (options?.filterByAlias) {
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
     * Update discovery options.
     */
    updateOptions(options: Partial<BacklinkDiscoveryOptions>): void {
        this.logger.debug('Updating options', { options });

        this.options = { ...this.options, ...options };

        // Update discoverer options
        this.backlinkDiscoverer.updateOptions(options);

        this.logger.debug('Options updated successfully', { options: this.options });
    }

    /**
     * Get current discovery options.
     */
    getOptions(): BacklinkDiscoveryOptions {
        return { ...this.options };
    }

    /**
     * Get backlink discovery statistics.
     */
    getStatistics(): BacklinkStatistics {
        return this.backlinkDiscoverer.getStatistics();
    }

    /**
     * Expose discoverer for callers that still need low-level access.
     */
    getBacklinkDiscoverer(): BacklinkDiscoverer {
        return this.backlinkDiscoverer;
    }

    /**
     * Expose cache for callers that still need low-level access.
     */
    getBacklinkCache(): BacklinkCache {
        return this.backlinkCache;
    }

    /**
     * Cleanup resources used by this core service.
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinksCore');

        try {
            this.backlinkDiscoverer.cleanup();
            this.backlinkCache.cleanup();

            this.logger.debug('BacklinksCore cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BacklinksCore', { error });
        }
    }
}