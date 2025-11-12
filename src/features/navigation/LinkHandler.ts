import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { CommonHelpers } from '../shared-utilities/CommonHelpers';

/**
 * Link Handler for Navigation Slice
 * 
 * Processes and resolves different types of links
 * for the vertical slice architecture.
 */
export class LinkHandler {
    private app: App;
    private logger: Logger;

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('LinkHandler');
        
        this.logger.debug('LinkHandler initialized');
    }

    /**
     * Process a link and return resolved path and line information
     */
    async processLink(linkPath: string, source: string = 'unknown'): Promise<{
        path: string;
        line?: number;
        alias?: string;
    }> {
        this.logger.debug('Processing link', { linkPath, source });
        
        try {
            // Parse the link
            const parsedLink = this.parseLink(linkPath);
            
            // Resolve the path
            const resolvedPath = await this.resolvePath(parsedLink.path, source);
            
            // Extract line number if present
            const line = parsedLink.line;
            
            // Extract alias if present
            const alias = parsedLink.alias;
            
            const result = {
                path: resolvedPath,
                line,
                alias
            };
            
            this.logger.debug('Link processed successfully', { 
                originalLink: linkPath, 
                result,
                source 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to process link', { linkPath, source, error });
            throw error;
        }
    }

    /**
     * Parse a link into its components
     */
    parseLink(linkPath: string): {
        path: string;
        line?: number;
        alias?: string;
    } {
        this.logger.debug('Parsing link', { linkPath });
        
        try {
            // Remove any surrounding brackets
            let cleanLink = linkPath.replace(/^\[\[|\]\]$/g, '');
            
            // Extract alias (text after |)
            let alias: string | undefined;
            const aliasMatch = cleanLink.match(/^(.+?)\|(.+)$/);
            if (aliasMatch) {
                cleanLink = aliasMatch[1];
                alias = aliasMatch[2];
            }
            
            // Extract line number (text after #)
            let line: number | undefined;
            const lineMatch = cleanLink.match(/^(.+?)#(\d+)$/);
            if (lineMatch) {
                cleanLink = lineMatch[1];
                line = parseInt(lineMatch[2], 10);
            }
            
            // Extract heading (text after #)
            const headingMatch = cleanLink.match(/^(.+?)#([^#\d]+)$/);
            if (headingMatch) {
                cleanLink = headingMatch[1];
                // For now, we don't resolve heading to line number
                // This could be enhanced in the future
            }
            
            const result = {
                path: cleanLink,
                line,
                alias
            };
            
            this.logger.debug('Link parsed successfully', { 
                originalLink: linkPath, 
                result 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to parse link', { linkPath, error });
            
            // Return basic parsing result on error
            return {
                path: linkPath
            };
        }
    }

    /**
     * Resolve a path to an absolute file path
     */
    async resolvePath(path: string, source: string = 'unknown'): Promise<string> {
        this.logger.debug('Resolving path', { path, source });
        
        try {
            // If path is already absolute and exists, return it
            if (this.isAbsolutePath(path) && this.fileExists(path)) {
                this.logger.debug('Path is absolute and exists', { path });
                return path;
            }
            
            // Try to resolve as relative to source
            if (source && source !== 'unknown') {
                const sourceDir = this.getDirectoryPath(source);
                const relativePath = this.normalizePath(`${sourceDir}/${path}`);
                
                if (this.fileExists(relativePath)) {
                    this.logger.debug('Path resolved as relative path', { 
                        originalPath: path, 
                        source, 
                        resolvedPath: relativePath 
                    });
                    return relativePath;
                }
            }
            
            // Try to resolve as relative to vault root
            const vaultRelativePath = this.normalizePath(path);
            if (this.fileExists(vaultRelativePath)) {
                this.logger.debug('Path resolved as vault-relative path', { 
                    originalPath: path, 
                    resolvedPath: vaultRelativePath 
                });
                return vaultRelativePath;
            }
            
            // Try to resolve with .md extension
            const withExtension = vaultRelativePath.endsWith('.md') ? 
                vaultRelativePath : 
                `${vaultRelativePath}.md`;
                
            if (this.fileExists(withExtension)) {
                this.logger.debug('Path resolved with .md extension', { 
                    originalPath: path, 
                    resolvedPath: withExtension 
                });
                return withExtension;
            }
            
            // If no resolution found, return the original path
            this.logger.debug('Could not resolve path, returning original', { 
                originalPath: path,
                source
            });
            
            return path;
        } catch (error) {
            this.logger.error('Failed to resolve path', { path, source, error });
            return path;
        }
    }

    /**
     * Check if a path is absolute
     */
    isAbsolutePath(path: string): boolean {
        return path.startsWith('/') || path.includes(':\\') || path.includes(':/');
    }

    /**
     * Check if a file exists
     */
    fileExists(path: string): boolean {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            return file !== null && file instanceof TFile;
        } catch (error) {
            this.logger.error('Failed to check file existence', { path, error });
            return false;
        }
    }

    /**
     * Get directory path from file path
     */
    getDirectoryPath(filePath: string): string {
        const pathSeparator = filePath.includes('/') ? '/' : '\\';
        const parts = filePath.split(pathSeparator);
        return parts.slice(0, -1).join(pathSeparator);
    }

    /**
     * Normalize a file path
     */
    normalizePath(path: string): string {
        return path.replace(/\\/g, '/');
    }

    /**
     * Validate a link
     */
    validateLink(linkPath: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];
        
        // Check if link is empty
        if (!linkPath || linkPath.trim().length === 0) {
            errors.push('Link cannot be empty');
        }
        
        // Check for invalid characters
        const invalidChars = ['<', '>', '|', '?', '*'];
        for (const char of invalidChars) {
            if (linkPath.includes(char)) {
                errors.push(`Link contains invalid character: ${char}`);
            }
        }
        
        // Check for malformed brackets
        const openBrackets = (linkPath.match(/\[\[/g) || []).length;
        const closeBrackets = (linkPath.match(/\]\]/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
            errors.push('Link has mismatched brackets');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get statistics about link processing
     */
    getStatistics(): {
        processedLinksCount: number;
        resolvedLinksCount: number;
        failedResolutionsCount: number;
    } {
        // This would need to be enhanced with actual tracking
        // For now, return basic statistics
        return {
            processedLinksCount: 0,
            resolvedLinksCount: 0,
            failedResolutionsCount: 0
        };
    }

    /**
     * Cleanup resources used by this link handler
     */
    cleanup(): void {
        this.logger.debug('Cleaning up LinkHandler');
        
        // No specific cleanup needed for this component currently
        
        this.logger.debug('LinkHandler cleanup completed');
    }
}

// Export the interface for external use
export interface ILinkHandler {
    processLink(linkPath: string, source?: string): Promise<{
        path: string;
        line?: number;
        alias?: string;
    }>;
    parseLink(linkPath: string): {
        path: string;
        line?: number;
        alias?: string;
    };
    resolvePath(path: string, source?: string): Promise<string>;
    validateLink(linkPath: string): {
        isValid: boolean;
        errors: string[];
    };
}