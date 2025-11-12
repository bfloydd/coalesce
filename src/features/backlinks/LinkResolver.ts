import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { ILinkResolver, BacklinkResolutionResult } from './types';

/**
 * Link Resolver for Backlinks Slice
 * 
 * Handles link resolution and path normalization
 * for the vertical slice architecture.
 */
export class LinkResolver implements ILinkResolver {
    private app: App;
    private logger: Logger;
    private resolutionCache: Map<string, string | null> = new Map();
    private cacheTimeout = 30000; // 30 seconds

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('LinkResolver');
        
        this.logger.debug('LinkResolver initialized');
    }

    /**
     * Resolve a link path to an actual file path
     */
    resolveLink(linkPath: string, sourceFilePath: string): string | null {
        this.logger.debug('Resolving link', { linkPath, sourceFilePath });
        
        try {
            // Check cache first
            const cacheKey = `${linkPath}|${sourceFilePath}`;
            const cached = this.resolutionCache.get(cacheKey);
            
            if (cached !== undefined) {
                this.logger.debug('Link resolved from cache', { linkPath, sourceFilePath, resolved: cached });
                return cached;
            }
            
            let resolvedPath: string | null = null;
            let resolutionMethod: BacklinkResolutionResult['resolutionMethod'] = 'failed';
            
            // Try different resolution methods
            resolvedPath = this.tryDirectResolution(linkPath);
            if (resolvedPath) {
                resolutionMethod = 'direct';
            } else {
                resolvedPath = this.tryNameResolution(linkPath);
                if (resolvedPath) {
                    resolutionMethod = 'name';
                } else {
                    resolvedPath = this.tryAliasResolution(linkPath);
                    if (resolvedPath) {
                        resolutionMethod = 'alias';
                    }
                }
            }
            
            // Cache the result
            this.resolutionCache.set(cacheKey, resolvedPath);
            
            this.logger.debug('Link resolution completed', { 
                linkPath, 
                sourceFilePath, 
                resolvedPath, 
                resolutionMethod 
            });
            
            return resolvedPath;
        } catch (error) {
            this.logger.error('Failed to resolve link', { linkPath, sourceFilePath, error });
            return null;
        }
    }

    /**
     * Check if a link is resolved
     */
    isLinkResolved(linkPath: string, sourceFilePath: string): boolean {
        this.logger.debug('Checking if link is resolved', { linkPath, sourceFilePath });
        
        try {
            const resolvedPath = this.resolveLink(linkPath, sourceFilePath);
            const isResolved = resolvedPath !== null;
            
            this.logger.debug('Link resolution check completed', { 
                linkPath, 
                sourceFilePath, 
                isResolved 
            });
            
            return isResolved;
        } catch (error) {
            this.logger.error('Failed to check link resolution', { linkPath, sourceFilePath, error });
            return false;
        }
    }

    /**
     * Get all possible resolutions for a link
     */
    getPossibleResolutions(linkPath: string): string[] {
        this.logger.debug('Getting possible resolutions', { linkPath });
        
        try {
            const resolutions: string[] = [];
            
            // Try direct resolution
            const direct = this.tryDirectResolution(linkPath);
            if (direct) {
                resolutions.push(direct);
            }
            
            // Try name resolution
            const name = this.tryNameResolution(linkPath);
            if (name && !resolutions.includes(name)) {
                resolutions.push(name);
            }
            
            // Try alias resolution
            const alias = this.tryAliasResolution(linkPath);
            if (alias && !resolutions.includes(alias)) {
                resolutions.push(alias);
            }
            
            this.logger.debug('Possible resolutions retrieved', { 
                linkPath, 
                resolutionCount: resolutions.length,
                resolutions
            });
            
            return resolutions;
        } catch (error) {
            this.logger.error('Failed to get possible resolutions', { linkPath, error });
            return [];
        }
    }

    /**
     * Normalize a link path
     */
    normalizeLinkPath(linkPath: string): string {
        this.logger.debug('Normalizing link path', { linkPath });
        
        try {
            // Remove any leading ./ or ./
            let normalized = linkPath.replace(/^\.?\//, '');
            
            // Remove any leading # (for heading links)
            normalized = normalized.replace(/^#/, '');
            
            // Remove any trailing #heading (for heading links)
            normalized = normalized.replace(/#.*$/, '');
            
            // Remove any .md extension if present
            if (normalized.endsWith('.md')) {
                normalized = normalized.slice(0, -3);
            }
            
            // Trim whitespace
            normalized = normalized.trim();
            
            this.logger.debug('Link path normalized', { 
                original: linkPath, 
                normalized 
            });
            
            return normalized;
        } catch (error) {
            this.logger.error('Failed to normalize link path', { linkPath, error });
            return linkPath;
        }
    }

    /**
     * Try direct resolution (exact path match)
     */
    private tryDirectResolution(linkPath: string): string | null {
        this.logger.debug('Trying direct resolution', { linkPath });
        
        try {
            // Normalize the link path
            const normalizedPath = this.normalizeLinkPath(linkPath);
            
            // Try with .md extension
            const withExtension = normalizedPath.endsWith('.md') 
                ? normalizedPath 
                : `${normalizedPath}.md`;
            
            // Check if file exists
            const file = this.app.vault.getAbstractFileByPath(withExtension);
            if (file && file instanceof TFile) {
                this.logger.debug('Direct resolution successful', { linkPath, resolved: withExtension });
                return withExtension;
            }
            
            // Try without .md extension
            const withoutExtension = normalizedPath.endsWith('.md') 
                ? normalizedPath.slice(0, -3) 
                : normalizedPath;
            
            const fileWithoutExt = this.app.vault.getAbstractFileByPath(withoutExtension);
            if (fileWithoutExt && fileWithoutExt instanceof TFile) {
                this.logger.debug('Direct resolution successful (without extension)', { 
                    linkPath, 
                    resolved: withoutExtension 
                });
                return withoutExtension;
            }
            
            this.logger.debug('Direct resolution failed', { linkPath });
            return null;
        } catch (error) {
            this.logger.error('Direct resolution failed', { linkPath, error });
            return null;
        }
    }

    /**
     * Try name resolution (match by file name)
     */
    private tryNameResolution(linkPath: string): string | null {
        this.logger.debug('Trying name resolution', { linkPath });
        
        try {
            // Normalize the link path
            const normalizedPath = this.normalizeLinkPath(linkPath);
            
            // Get all markdown files
            const markdownFiles = this.app.vault.getMarkdownFiles();
            
            // Look for exact name match
            for (const file of markdownFiles) {
                if (file.basename === normalizedPath || file.name === normalizedPath) {
                    this.logger.debug('Name resolution successful', { 
                        linkPath, 
                        resolved: file.path 
                    });
                    return file.path;
                }
            }
            
            // Look for case-insensitive match
            for (const file of markdownFiles) {
                if (file.basename.toLowerCase() === normalizedPath.toLowerCase() || 
                    file.name.toLowerCase() === normalizedPath.toLowerCase()) {
                    this.logger.debug('Name resolution successful (case-insensitive)', { 
                        linkPath, 
                        resolved: file.path 
                    });
                    return file.path;
                }
            }
            
            this.logger.debug('Name resolution failed', { linkPath });
            return null;
        } catch (error) {
            this.logger.error('Name resolution failed', { linkPath, error });
            return null;
        }
    }

    /**
     * Try alias resolution (match by aliases in frontmatter)
     */
    private tryAliasResolution(linkPath: string): string | null {
        this.logger.debug('Trying alias resolution', { linkPath });
        
        try {
            // Normalize the link path
            const normalizedPath = this.normalizeLinkPath(linkPath);
            
            // Get all markdown files
            const markdownFiles = this.app.vault.getMarkdownFiles();
            
            // Look for files with matching aliases
            for (const file of markdownFiles) {
                const cache = this.app.metadataCache.getCache(file.path);
                const aliases = cache?.frontmatter?.aliases;
                
                if (aliases) {
                    const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
                    
                    for (const alias of aliasArray) {
                        if (typeof alias === 'string' && alias === normalizedPath) {
                            this.logger.debug('Alias resolution successful', { 
                                linkPath, 
                                resolved: file.path,
                                alias
                            });
                            return file.path;
                        }
                    }
                }
            }
            
            this.logger.debug('Alias resolution failed', { linkPath });
            return null;
        } catch (error) {
            this.logger.error('Alias resolution failed', { linkPath, error });
            return null;
        }
    }

    /**
     * Clear resolution cache
     */
    clearCache(): void {
        this.logger.debug('Clearing resolution cache');
        
        this.resolutionCache.clear();
        
        this.logger.debug('Resolution cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStatistics(): {
        cacheSize: number;
        cacheTimeout: number;
    } {
        return {
            cacheSize: this.resolutionCache.size,
            cacheTimeout: this.cacheTimeout
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
     * Cleanup resources used by this link resolver
     */
    cleanup(): void {
        this.logger.debug('Cleaning up LinkResolver');
        
        // Clear cache
        this.clearCache();
        
        this.logger.debug('LinkResolver cleanup completed');
    }
}