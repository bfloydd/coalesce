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
        this.logger.debug('Discovering backlinks', { currentFilePath });

        try {
            // Wait for metadata cache to be ready
            await this.waitForMetadataCache();

            // Get resolved and unresolved backlinks
            const resolvedBacklinks = this.getResolvedBacklinks(currentFilePath);
            const unresolvedBacklinks = this.getUnresolvedBacklinks(currentFilePath);

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

            const fileName = (file as any).basename;
            const fullName = (file as any).name;

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
     * Wait for metadata cache to be ready
     * This helps handle timing issues where metadata cache isn't immediately available
     */
    private async waitForMetadataCache(): Promise<void> {
        // In test environment, don't wait - just return immediately
        if (process.env.NODE_ENV === 'test') {
            return;
        }

        // Check if cache already has content
        if (Object.keys(this.app.metadataCache.resolvedLinks).length > 0 ||
            Object.keys(this.app.metadataCache.unresolvedLinks).length > 0) {
            return;
        }

        // In production, wait for potential updates
        return new Promise((resolve) => {
            // Listen for 'resolved' event which indicates metadata cache updates
            const handleResolved = () => {
                this.app.metadataCache.off('resolved', handleResolved);
                resolve();
            };

            this.app.metadataCache.on('resolved', handleResolved);

            // Timeout fallback (1 second for production)
            setTimeout(() => {
                this.app.metadataCache.off('resolved', handleResolved);
                resolve();
            }, 1000);
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