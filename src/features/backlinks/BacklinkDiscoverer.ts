import { App } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { DailyNote } from '../shared-utilities/DailyNote';
import { IBacklinkDiscoverer, BacklinkDiscoveryOptions, BacklinkStatistics } from './types';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';

/**
 * Backlink Discoverer for Backlinks Slice
 * 
 * Handles discovery of files linking to the current note
 * for the vertical slice architecture.
 */
export class BacklinkDiscoverer implements IBacklinkDiscoverer {
    private app: App;
    private logger: Logger;
    private options: BacklinkDiscoveryOptions;
    private statistics: BacklinkStatistics = {
        totalFilesChecked: 0,
        filesWithBacklinks: 0,
        totalBacklinksFound: 0,
        resolvedBacklinks: 0,
        unresolvedBacklinks: 0,
        averageBacklinksPerFile: 0,
        cacheHitRate: 0
    };

    constructor(app: App, logger: Logger, options?: Partial<BacklinkDiscoveryOptions>) {
        this.app = app;
        this.logger = logger.child('BacklinkDiscoverer');
        
        // Set default options
        this.options = {
            includeResolved: true,
            includeUnresolved: true,
            useCache: true,
            cacheTimeout: 30000, // 30 seconds
            onlyDailyNotes: false,
            ...options
        };
        
        this.logger.debug('BacklinkDiscoverer initialized', { options: this.options });
    }

    /**
     * Discover files linking to the current note
     */
    async discoverBacklinks(currentFilePath: string): Promise<string[]> {
        const startTime = Date.now();
        const initialCacheState = {
            resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
            unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
            hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                       Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
        };
        
        this.logger.info('=== CODE PATH: BacklinkDiscoverer.discoverBacklinks ===', {
            currentFilePath,
            timestamp: startTime,
            initialMetadataCacheState: initialCacheState
        });

        try {
            // Wait for metadata cache to be ready
            const waitStartTime = Date.now();
            this.logger.info('Waiting for metadata cache', { currentFilePath });
            await this.waitForMetadataCache();
            const waitDuration = Date.now() - waitStartTime;
            
            const cacheStateAfterWait = {
                resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                           Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
            };
            
            this.logger.info('Metadata cache wait completed', {
                currentFilePath,
                waitDuration,
                metadataCacheStateAfterWait: cacheStateAfterWait
            });

            // Get resolved and unresolved backlinks
            let resolvedBacklinks = this.getResolvedBacklinks(currentFilePath);
            let unresolvedBacklinks = this.getUnresolvedBacklinks(currentFilePath);
            const initialBacklinkCount = resolvedBacklinks.length + unresolvedBacklinks.length;
            
            // Wait for cache to stabilize - the cache might still be indexing even after 'resolved' event
            // We'll check if backlinks increase over time, indicating more indexing is happening
            // Skip stabilization wait in test environment
            if (cacheStateAfterWait.hasContent && process.env.NODE_ENV !== 'test') {
                this.logger.info('Checking if cache is still indexing backlinks...', {
                    currentFilePath,
                    initialBacklinkCount,
                    resolvedLinksCount: cacheStateAfterWait.resolvedLinksCount,
                    unresolvedLinksCount: cacheStateAfterWait.unresolvedLinksCount
                });
                
                // Wait for cache to stabilize - check if backlinks increase
                await new Promise<void>((resolve): void => {
                    let lastBacklinkCount = initialBacklinkCount;
                    let stableCount = 0; // How many times we've seen the same count
                    const stableThreshold = 3; // Need 3 consecutive checks with same count to consider stable
                    let checkInterval: NodeJS.Timeout | null = null;
                    let eventHandler: (() => void) | null = null;
                    let timeoutId: NodeJS.Timeout | null = null;
                    
                    const checkBacklinks = () => {
                        const newResolved = this.getResolvedBacklinks(currentFilePath);
                        const newUnresolved = this.getUnresolvedBacklinks(currentFilePath);
                        const currentBacklinkCount = newResolved.length + newUnresolved.length;
                        
                        this.logger.debug('Checking backlinks during stabilization wait', {
                            currentFilePath,
                            currentBacklinkCount,
                            lastBacklinkCount,
                            stableCount
                        });
                        
                        if (currentBacklinkCount > lastBacklinkCount) {
                            // Backlinks increased - cache is still indexing
                            const previousCount = lastBacklinkCount;
                            lastBacklinkCount = currentBacklinkCount;
                            stableCount = 0; // Reset stability counter
                            resolvedBacklinks = newResolved;
                            unresolvedBacklinks = newUnresolved;
                            this.logger.info('Backlinks increased during wait, cache still indexing', {
                                currentFilePath,
                                newCount: currentBacklinkCount,
                                previousCount: previousCount
                            });
                        } else if (currentBacklinkCount === lastBacklinkCount) {
                            // Count is stable
                            stableCount++;
                            if (stableCount >= stableThreshold) {
                                // Count has been stable for 3 checks, cache is likely done
                                if (checkInterval) clearInterval(checkInterval);
                                if (eventHandler) {
                                    this.app.metadataCache.off('resolved', eventHandler);
                                }
                                if (timeoutId) clearTimeout(timeoutId);
                                resolvedBacklinks = newResolved;
                                unresolvedBacklinks = newUnresolved;
                                this.logger.info('Backlink count stabilized', {
                                    currentFilePath,
                                    finalCount: currentBacklinkCount,
                                    stableChecks: stableCount
                                });
                                resolve();
                                return true;
                            }
                        }
                        
                        return false;
                    };
                    
                    // Check immediately
                    checkBacklinks();
                    
                    // Listen for more resolved events (cache might still be indexing)
                    eventHandler = () => {
                        checkBacklinks();
                    };
                    this.app.metadataCache.on('resolved', eventHandler);
                    
                    // Check periodically (every 300ms) to see if backlinks stabilize
                    checkInterval = setInterval(() => {
                        checkBacklinks();
                    }, 300);
                    
                    // Timeout after 3 seconds max
                    timeoutId = setTimeout(() => {
                        if (checkInterval) clearInterval(checkInterval);
                        if (eventHandler) {
                            this.app.metadataCache.off('resolved', eventHandler);
                        }
                        // Get final count
                        const finalResolved = this.getResolvedBacklinks(currentFilePath);
                        const finalUnresolved = this.getUnresolvedBacklinks(currentFilePath);
                        resolvedBacklinks = finalResolved;
                        unresolvedBacklinks = finalUnresolved;
                        this.logger.info('Backlink stabilization timeout reached', {
                            currentFilePath,
                            finalCount: finalResolved.length + finalUnresolved.length
                        });
                        resolve();
                    }, 3000);
                });
            }

            this.logger.debug('Backlinks retrieved', {
                currentFilePath,
                resolvedCount: resolvedBacklinks.length,
                unresolvedCount: unresolvedBacklinks.length
            });

            // Combine based on options
            let backlinks: string[] = [];

            if (this.options.includeResolved) {
                backlinks = backlinks.concat(resolvedBacklinks);
            }

            if (this.options.includeUnresolved) {
                backlinks = backlinks.concat(unresolvedBacklinks);
            }

            // Remove duplicates
            const uniqueBacklinks = [...new Set(backlinks)];

            this.logger.debug('Backlinks combined and deduplicated', {
                currentFilePath,
                uniqueCount: uniqueBacklinks.length
            });

            // Update statistics
            this.updateStatistics(currentFilePath, uniqueBacklinks, resolvedBacklinks.length, unresolvedBacklinks.length);

            this.logger.debug('Backlinks discovered successfully', {
                currentFilePath,
                backlinkCount: uniqueBacklinks.length,
                resolvedCount: resolvedBacklinks.length,
                unresolvedCount: unresolvedBacklinks.length
            });

            return uniqueBacklinks;
        } catch (error) {
            this.logger.error('Failed to discover backlinks', { currentFilePath, error });
            return [];
        }
    }

    /**
     * Get resolved backlinks (files that link directly)
     */
    getResolvedBacklinks(currentFilePath: string): string[] {
        this.logger.debug('Getting resolved backlinks', { currentFilePath });

        try {
            const resolvedLinks = this.app.metadataCache.resolvedLinks;
            const backlinks: string[] = [];

            this.logger.debug('Checking resolved links', {
                currentFilePath,
                totalSourceFiles: Object.keys(resolvedLinks).length
            });

            // Check resolved links
            for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
                const linkMap = links as Record<string, unknown>;

                if (currentFilePath in linkMap) {
                    this.logger.debug('Found resolved backlink', {
                        sourcePath,
                        targetPath: currentFilePath
                    });
                    backlinks.push(sourcePath);
                }
            }

            this.logger.debug('Resolved backlinks retrieved', {
                currentFilePath,
                backlinkCount: backlinks.length
            });

            this.logger.debug('Resolved backlinks retrieved', {
                currentFilePath,
                count: backlinks.length
            });

            return backlinks;
        } catch (error) {
            this.logger.error('Failed to get resolved backlinks', { currentFilePath, error });
            return [];
        }
    }

    /**
     * Get unresolved backlinks (files that link by name)
     */
    getUnresolvedBacklinks(currentFilePath: string): string[] {
        this.logger.debug('Getting unresolved backlinks', { currentFilePath });

        try {
            const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
            const backlinks: string[] = [];

            this.logger.debug('Checking unresolved links', {
                currentFilePath,
                totalSourceFiles: Object.keys(unresolvedLinks).length
            });

            // Get file info for name matching
            const file = this.app.vault.getAbstractFileByPath(currentFilePath);

            // For testing compatibility, check for required properties instead of instanceof
            if (!file || typeof file !== 'object' || !('basename' in file) || !('name' in file)) {
                this.logger.debug('File not found or invalid file object', { currentFilePath });
                return backlinks;
            }

            // Use type-safe property access
            const fileWithProps = file as { basename: string; name: string };
            const fileName = fileWithProps.basename;
            const fullName = fileWithProps.name;

            this.logger.debug('Searching for unresolved backlinks by name', {
                currentFilePath,
                fileName,
                fullName
            });

            // Check unresolved links
            for (const [sourcePath, links] of Object.entries(unresolvedLinks)) {
                const linkMap = links as Record<string, unknown>;

                // Check for matches by name or basename (case-insensitive)
                const hasMatch = Object.keys(linkMap).some(link => {
                    const matches = link.toLowerCase() === fileName.toLowerCase() ||
                                   link.toLowerCase() === fullName.toLowerCase();
                    if (matches) {
                        this.logger.debug('Found unresolved backlink match', {
                            link,
                            sourcePath,
                            targetFileName: fileName,
                            targetFullName: fullName
                        });
                    }
                    return matches;
                });

                if (hasMatch) {
                    this.logger.debug('Found unresolved backlink', {
                        sourcePath,
                        targetPath: currentFilePath
                    });
                    backlinks.push(sourcePath);
                }
            }

            this.logger.debug('Unresolved backlinks retrieved', {
                currentFilePath,
                backlinkCount: backlinks.length
            });

            this.logger.debug('Unresolved backlinks retrieved', {
                currentFilePath,
                count: backlinks.length,
                fileName,
                fullName
            });

            return backlinks;
        } catch (error) {
            this.logger.error('Failed to get unresolved backlinks', { currentFilePath, error });
            return [];
        }
    }

    /**
     * Check if a file has backlinks
     */
    hasBacklinks(filePath: string): boolean {
        this.logger.debug('Checking if file has backlinks', { filePath });
        
        try {
            const resolvedBacklinks = this.getResolvedBacklinks(filePath);
            const unresolvedBacklinks = this.getUnresolvedBacklinks(filePath);
            
            const hasBacklinks = resolvedBacklinks.length > 0 || unresolvedBacklinks.length > 0;
            
            this.logger.debug('Backlink existence check completed', { 
                filePath, 
                hasBacklinks,
                resolvedCount: resolvedBacklinks.length,
                unresolvedCount: unresolvedBacklinks.length
            });
            
            return hasBacklinks;
        } catch (error) {
            this.logger.error('Failed to check backlink existence', { filePath, error });
            return false;
        }
    }

    /**
     * Get backlink count for a file
     */
    getBacklinkCount(filePath: string): number {
        this.logger.debug('Getting backlink count', { filePath });
        
        try {
            const resolvedBacklinks = this.getResolvedBacklinks(filePath);
            const unresolvedBacklinks = this.getUnresolvedBacklinks(filePath);
            
            const totalCount = resolvedBacklinks.length + unresolvedBacklinks.length;
            
            this.logger.debug('Backlink count retrieved', { 
                filePath, 
                totalCount,
                resolvedCount: resolvedBacklinks.length,
                unresolvedCount: unresolvedBacklinks.length
            });
            
            return totalCount;
        } catch (error) {
            this.logger.error('Failed to get backlink count', { filePath, error });
            return 0;
        }
    }

    /**
     * Filter backlinks based on options
     */
    filterBacklinks(backlinks: string[], options?: {
        excludeDailyNotes?: boolean;
        excludeCurrentFile?: string;
        sortByPath?: boolean;
    }): string[] {
        this.logger.debug('Filtering backlinks', { backlinkCount: backlinks.length, options });
        
        try {
            let filteredBacklinks = [...backlinks];
            
            // Exclude daily notes if requested
            if (options?.excludeDailyNotes) {
                filteredBacklinks = filteredBacklinks.filter(path => 
                    !DailyNote.isDaily(this.app as AppWithInternalPlugins, path)
                );
            }
            
            // Exclude current file if requested
            if (options?.excludeCurrentFile) {
                filteredBacklinks = filteredBacklinks.filter(path => 
                    path !== options.excludeCurrentFile
                );
            }
            
            // Sort by path if requested
            if (options?.sortByPath) {
                filteredBacklinks.sort();
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
     * Update discovery options
     */
    updateOptions(options: Partial<BacklinkDiscoveryOptions>): void {
        this.logger.debug('Updating discovery options', { options });
        
        this.options = { ...this.options, ...options };
        
        this.logger.debug('Discovery options updated successfully', { options: this.options });
    }

    /**
     * Get current options
     */
    getOptions(): BacklinkDiscoveryOptions {
        return { ...this.options };
    }

    /**
     * Update statistics
     */
    private updateStatistics(
        filePath: string, 
        backlinks: string[], 
        resolvedCount: number, 
        unresolvedCount: number
    ): void {
        this.statistics.totalFilesChecked++;
        this.statistics.totalBacklinksFound += backlinks.length;
        this.statistics.resolvedBacklinks += resolvedCount;
        this.statistics.unresolvedBacklinks += unresolvedCount;
        
        if (backlinks.length > 0) {
            this.statistics.filesWithBacklinks++;
        }
        
        // Calculate average
        if (this.statistics.totalFilesChecked > 0) {
            this.statistics.averageBacklinksPerFile = 
                this.statistics.totalBacklinksFound / this.statistics.totalFilesChecked;
        }
        
        this.statistics.lastDiscoveryTime = new Date();
        
        this.logger.debug('Statistics updated', { 
            filePath, 
            backlinkCount: backlinks.length,
            statistics: this.statistics
        });
    }

    /**
     * Get statistics
     */
    getStatistics(): BacklinkStatistics {
        return { ...this.statistics };
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalFilesChecked: 0,
            filesWithBacklinks: 0,
            totalBacklinksFound: 0,
            resolvedBacklinks: 0,
            unresolvedBacklinks: 0,
            averageBacklinksPerFile: 0,
            cacheHitRate: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Wait for metadata cache to be ready using the 'resolved' event
     * This is event-based, not timeout-based
     */
    private async waitForMetadataCache(): Promise<void> {
        // In test environment, don't wait - just return immediately
        if (process.env.NODE_ENV === 'test') {
            return;
        }

        const resolvedCount = Object.keys(this.app.metadataCache.resolvedLinks).length;
        const unresolvedCount = Object.keys(this.app.metadataCache.unresolvedLinks).length;
        const hasContent = resolvedCount > 0 || unresolvedCount > 0;

        // Check if cache already has content
        if (hasContent) {
            this.logger.debug('Metadata cache already has content, no wait needed', {
                resolvedCount,
                unresolvedCount
            });
            return;
        }

        this.logger.info('Metadata cache appears empty, waiting for resolved event', {
            resolvedCount,
            unresolvedCount
        });

        // Wait for the 'resolved' event which fires when metadata cache is fully loaded
        // The event might have already fired, so we check periodically AND listen for the event
        return new Promise<void>((resolve) => {
            const waitStartTime = Date.now();
            let resolved = false;
            
            // Check if cache gets populated (handles case where event already fired)
            const checkCache = () => {
                if (resolved) return;
                
                const currentResolvedCount = Object.keys(this.app.metadataCache.resolvedLinks).length;
                const currentUnresolvedCount = Object.keys(this.app.metadataCache.unresolvedLinks).length;
                const nowHasContent = currentResolvedCount > 0 || currentUnresolvedCount > 0;
                
                if (nowHasContent) {
                    resolved = true;
                    this.app.metadataCache.off('resolved', handleResolved);
                    if (checkInterval) clearInterval(checkInterval);
                    const waitDuration = Date.now() - waitStartTime;
                    this.logger.info('Metadata cache populated (checked during wait)', {
                        waitDuration,
                        resolvedCount: currentResolvedCount,
                        unresolvedCount: currentUnresolvedCount
                    });
                    resolve();
                    return true;
                }
                return false;
            };
            
            // Check immediately - if event already fired, cache might have content now
            if (checkCache()) {
                return; // Already resolved
            }
            
            // Also check periodically (every 50ms) in case cache populates asynchronously
            // This handles the case where the 'resolved' event already fired before we set up the listener
            const checkInterval = setInterval(() => {
                checkCache();
            }, 50);
            
            // Listen for 'resolved' event which indicates metadata cache is fully loaded
            const handleResolved = () => {
                if (resolved) return;
                resolved = true;
                this.app.metadataCache.off('resolved', handleResolved);
                if (checkInterval) clearInterval(checkInterval);
                const waitDuration = Date.now() - waitStartTime;
                const finalResolvedCount = Object.keys(this.app.metadataCache.resolvedLinks).length;
                const finalUnresolvedCount = Object.keys(this.app.metadataCache.unresolvedLinks).length;
                this.logger.info('Metadata cache resolved event received', {
                    waitDuration,
                    resolvedCount: finalResolvedCount,
                    unresolvedCount: finalUnresolvedCount
                });
                resolve();
            };

            this.app.metadataCache.on('resolved', handleResolved);
        });
    }

    /**
     * Cleanup resources used by this backlink discoverer
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinkDiscoverer');

        // Reset statistics
        this.resetStatistics();

        this.logger.debug('BacklinkDiscoverer cleanup completed');
    }
}