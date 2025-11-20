import { App } from 'obsidian';
import { FileOpener, IFileOpener } from './FileOpener';
import { LinkHandler, ILinkHandler } from './LinkHandler';
import { Logger } from '../shared-utilities/Logger';

/**
 * Navigation Service for Navigation Slice
 * 
 * Coordinates navigation operations between file opener and link handler
 * for the vertical slice architecture.
 */
export class NavigationService {
    private app: App;
    private fileOpener: IFileOpener;
    private linkHandler: ILinkHandler;
    private logger: Logger;

    constructor(
        app: App, 
        fileOpener: IFileOpener, 
        linkHandler: ILinkHandler, 
        logger: Logger
    ) {
        this.app = app;
        this.fileOpener = fileOpener;
        this.linkHandler = linkHandler;
        this.logger = logger.child('NavigationService');
        
        this.logger.debug('NavigationService initialized');
    }

    /**
     * Open a path using the file opener
     */
    async openPath(path: string, openInNewTab: boolean = false): Promise<void> {
        this.logger.debug('Opening path via navigation service', { path, openInNewTab });
        
        try {
            await this.fileOpener.openFile(path, openInNewTab);
            this.logger.debug('Path opened successfully via navigation service', { path, openInNewTab });
        } catch (error) {
            this.logger.error('Failed to open path via navigation service', { path, openInNewTab, error });
            throw error;
        }
    }

    /**
     * Open a wiki-style link (e.g. [[path]] or [[path#^block]]) using Obsidian's workspace.
     * This centralizes openLinkText usage so feature slices don't touch App.workspace directly.
     */
    async openWikiLink(linkText: string, openInNewTab: boolean = false): Promise<void> {
        this.logger.debug('Opening wiki link via navigation service', { linkText, openInNewTab });

        try {
            // Use empty source path to let Obsidian resolve from the current context
            (this.app.workspace as any).openLinkText(linkText, '', openInNewTab);
            this.logger.debug('Wiki link navigation initiated', { linkText, openInNewTab });
        } catch (error) {
            this.logger.error('Failed to open wiki link via navigation service', {
                linkText,
                openInNewTab,
                error
            });
            throw error;
        }
    }

    /**
     * Process and open a link
     */
    async openLink(linkPath: string, openInNewTab: boolean = false, source: string = 'unknown'): Promise<void> {
        this.logger.debug('Opening link via navigation service', { linkPath, openInNewTab, source });
        
        try {
            // Process the link
            const processedLink = await this.linkHandler.processLink(linkPath, source);
            
            // Open the processed link
            await this.fileOpener.openFile(processedLink.path, openInNewTab, processedLink.line);
            
            this.logger.debug('Link opened successfully via navigation service', { 
                originalLink: linkPath, 
                processedLink, 
                openInNewTab, 
                source 
            });
        } catch (error) {
            this.logger.error('Failed to open link via navigation service', { linkPath, openInNewTab, source, error });
            throw error;
        }
    }

    /**
     * Navigate to a specific line in a file
     */
    async navigateToLine(path: string, line: number, openInNewTab: boolean = false): Promise<void> {
        this.logger.debug('Navigating to line via navigation service', { path, line, openInNewTab });
        
        try {
            await this.fileOpener.openFile(path, openInNewTab, line);
            this.logger.debug('Navigation to line successful', { path, line, openInNewTab });
        } catch (error) {
            this.logger.error('Failed to navigate to line', { path, line, openInNewTab, error });
            throw error;
        }
    }

    /**
     * Validate a link
     */
    validateLink(linkPath: string): {
        isValid: boolean;
        errors: string[];
    } {
        this.logger.debug('Validating link via navigation service', { linkPath });
        
        const result = this.linkHandler.validateLink(linkPath);
        
        this.logger.debug('Link validation completed', { 
            linkPath, 
            isValid: result.isValid, 
            errors: result.errors 
        });
        
        return result;
    }

    /**
     * Check if a file exists
     */
    fileExists(path: string): boolean {
        this.logger.debug('Checking file existence via navigation service', { path });
        
        const exists = this.fileOpener.fileExists(path);
        
        this.logger.debug('File existence check completed', { path, exists });
        
        return exists;
    }

    /**
     * Get file information
     */
    getFileInfo(path: string): {
        exists: boolean;
        isFile: boolean;
        size?: number;
        modified?: Date;
    } {
        this.logger.debug('Getting file info via navigation service', { path });
        
        const fileInfo = this.fileOpener.getFileInfo(path);
        
        this.logger.debug('File info retrieved', { path, fileInfo });
        
        return fileInfo;
    }

    /**
     * Parse a link into its components
     */
    parseLink(linkPath: string): {
        path: string;
        line?: number;
        alias?: string;
    } {
        this.logger.debug('Parsing link via navigation service', { linkPath });
        
        const parsedLink = this.linkHandler.parseLink(linkPath);
        
        this.logger.debug('Link parsed successfully', { 
            originalLink: linkPath, 
            parsedLink 
        });
        
        return parsedLink;
    }

    /**
     * Resolve a path to an absolute file path
     */
    async resolvePath(path: string, source: string = 'unknown'): Promise<string> {
        this.logger.debug('Resolving path via navigation service', { path, source });
        
        const resolvedPath = await this.linkHandler.resolvePath(path, source);
        
        this.logger.debug('Path resolved successfully', { 
            originalPath: path, 
            resolvedPath, 
            source 
        });
        
        return resolvedPath;
    }

    /**
     * Get combined statistics from all navigation components
     */
    getStatistics(): {
        navigationService: {
            totalOperations: number;
            successfulOperations: number;
            failedOperations: number;
        };
    } {
        // Navigation service statistics would need actual tracking
        // For now, return basic statistics
        const navigationServiceStats = {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0
        };
        
        return {
            navigationService: navigationServiceStats
        };
    }

    /**
     * Cleanup resources used by this navigation service
     */
    cleanup(): void {
        this.logger.debug('Cleaning up NavigationService');
        
        // Cleanup components if they have cleanup methods
        if ('cleanup' in this.fileOpener) {
            (this.fileOpener as any).cleanup();
        }
        if ('cleanup' in this.linkHandler) {
            (this.linkHandler as any).cleanup();
        }
        
        this.logger.debug('NavigationService cleanup completed');
    }
}

// Export the interface for external use
export interface INavigationService {
    openPath(path: string, openInNewTab?: boolean): Promise<void>;
    openLink(linkPath: string, openInNewTab?: boolean, source?: string): Promise<void>;
    navigateToLine(path: string, line: number, openInNewTab?: boolean): Promise<void>;
    validateLink(linkPath: string): {
        isValid: boolean;
        errors: string[];
    };
    fileExists(path: string): boolean;
    getFileInfo(path: string): {
        exists: boolean;
        isFile: boolean;
        size?: number;
        modified?: Date;
    };
    parseLink(linkPath: string): {
        path: string;
        line?: number;
        alias?: string;
    };
    resolvePath(path: string, source?: string): Promise<string>;
}