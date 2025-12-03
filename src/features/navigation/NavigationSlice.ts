import { App, TFile, WorkspaceLeaf } from 'obsidian';
import { INavigationSlice } from '../shared-contracts/slice-interfaces';
import { IPluginSlice, SliceDependencies } from '../../orchestrator/types';
import { NavigationService } from './NavigationService';
import { LinkHandler } from './LinkHandler';
import { FileOpener } from './FileOpener';
import { getSharedNavigation } from './NavigationFacade';
import { Logger } from '../shared-utilities/Logger';
import { PerformanceMonitor } from '../shared-utilities/PerformanceMonitor';
import { CommonHelpers } from '../shared-utilities/CommonHelpers';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';

/**
 * Navigation Slice Implementation
 * 
 * This slice handles file opening, link handling, and navigation events
 * for the vertical slice architecture.
 */
export class NavigationSlice implements IPluginSlice, INavigationSlice {
    // Index signature to satisfy IPluginSlice interface
    [key: string]: unknown;
    private app: App;
    private logger: Logger;
    private navigationService: NavigationService;
    private linkHandler: LinkHandler;
    private fileOpener: FileOpener;
    private performanceMonitor: PerformanceMonitor;
    private navigationHistory: string[] = [];
    private maxHistorySize = 50;

    constructor(app: App) {
        this.app = app;
        this.logger = new Logger('NavigationSlice');

        // Components will be initialized in initialize()
    }

    /**
     * Initialize the slice
     */
    async initialize(dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing NavigationSlice');

        const shared = getSharedNavigation(this.app, this.logger);
        this.fileOpener = shared.fileOpener;
        this.linkHandler = shared.linkHandler;
        this.navigationService = shared.navigationService;

        this.performanceMonitor = new PerformanceMonitor(
            this.logger.child('Performance'),
            () => Logger.getGlobalLogging().enabled
        );

        this.setupNavigationListeners();

        this.logger.debug('Navigation slice initialized');
    }

    /**
     * Start the slice
     */
    async start(): Promise<void> {
        this.logger.debug('Starting NavigationSlice');
    }

    /**
     * Stop the slice
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping NavigationSlice');
    }

    /**
     * Open a file path in the current tab or new tab
     */
    async openPath(path: string, openInNewTab: boolean = false): Promise<void> {
        return this.performanceMonitor.measureAsync(
            'navigation.openPath',
            async () => {
                this.logger.debug('Opening path', { path, openInNewTab });

                try {
                    // Validate the path
                    if (!this.isValidPath(path)) {
                        throw new Error(`Invalid file path: ${path}`);
                    }

                    await this.navigationService.openPath(path, openInNewTab);
                    this.addToNavigationHistory(path);

                    this.logger.debug('Path opened successfully', { path, openInNewTab });
                } catch (error) {
                    this.logger.error('Failed to open path', { path, openInNewTab, error });
                    throw error;
                }
            },
            { path, openInNewTab }
        );
    }

    /**
     * Handle a navigation event
     */
    handleNavigationEvent(event: CoalesceEvent): void {
        this.logger.debug('Handling navigation event', { event });

        // Handle navigation events asynchronously
        if (event.type === 'navigation:open') {
            this.openPath(event.payload.path, event.payload.openInNewTab).catch(error => {
                this.logger.error('Failed to handle navigation event', { event, error });
            });
        } else {
            this.logger.warn('Unknown navigation event type', { type: event.type });
        }
    }

    /**
     * Handle a link click
     */
    async handleLinkClick(
        linkPath: string,
        openInNewTab: boolean = false,
        source: string = 'unknown'
    ): Promise<void> {
        return this.performanceMonitor.measureAsync(
            'navigation.handleLinkClick',
            async () => {
                this.logger.debug('Handling link click', { linkPath, openInNewTab, source });

                try {
                    // Process the link
                    const processedLink = await this.linkHandler.processLink(linkPath, source);

                    // Open the processed link
                    await this.fileOpener.openFile(processedLink.path, openInNewTab, processedLink.line);

                    this.addToNavigationHistory(processedLink.path);

                    this.logger.debug('Link click handled successfully', {
                        originalLink: linkPath,
                        processedLink,
                        openInNewTab,
                        source
                    });
                } catch (error) {
                    this.logger.error('Failed to handle link click', { linkPath, openInNewTab, source, error });
                    throw error;
                }
            },
            { linkPath, openInNewTab, source }
        );
    }

    /**
     * Navigate back in history
     */
    async navigateBack(): Promise<void> {
        this.logger.debug('Navigating back', {
            currentHistory: this.navigationHistory,
            historySize: this.navigationHistory.length
        });

        if (this.navigationHistory.length <= 1) {
            this.logger.debug('No navigation history to go back to');
            return;
        }

        // Remove current path from history
        this.navigationHistory.pop();

        // Get previous path
        const previousPath = this.navigationHistory[this.navigationHistory.length - 1];

        if (previousPath) {
            await this.openPath(previousPath, false);
            this.logger.debug('Navigated back successfully', { previousPath });
        }
    }

    /**
     * Navigate forward in history
     */
    async navigateForward(): Promise<void> {
        this.logger.debug('Navigating forward');

        // For simplicity, we don't implement forward navigation in this basic version
        // A full implementation would maintain a forward stack
        this.logger.debug('Forward navigation not implemented in basic version');
    }

    /**
     * Get navigation history
     */
    getNavigationHistory(): string[] {
        return [...this.navigationHistory];
    }

    /**
     * Clear navigation history
     */
    clearNavigationHistory(): void {
        this.logger.debug('Clearing navigation history', {
            previousSize: this.navigationHistory.length
        });

        this.navigationHistory = [];

        this.logger.debug('Navigation history cleared');
    }

    /**
     * Get navigation service
     */
    getNavigationService(): NavigationService {
        return this.navigationService;
    }

    /**
     * Get link handler
     */
    getLinkHandler(): LinkHandler {
        return this.linkHandler;
    }

    /**
     * Get file opener
     */
    getFileOpener(): FileOpener {
        return this.fileOpener;
    }

    /**
     * Get navigation statistics
     */
    getStatistics(): {
        historySize: number;
        maxHistorySize: number;
        canNavigateBack: boolean;
        canNavigateForward: boolean;
    } {
        return {
            historySize: this.navigationHistory.length,
            maxHistorySize: this.maxHistorySize,
            canNavigateBack: this.navigationHistory.length > 1,
            canNavigateForward: false // Basic implementation doesn't support forward navigation
        };
    }

    /**
     * Cleanup resources used by this slice
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up Navigation slice');

        this.navigationService.cleanup();
        this.linkHandler.cleanup();
        this.fileOpener.cleanup();

        // Remove event listeners
        this.removeNavigationListeners();

        this.navigationHistory = [];

        this.logger.debug('Navigation slice cleanup completed');
    }

    /**
     * Setup navigation event listeners
     */
    private setupNavigationListeners(): void {
        this.logger.debug('Setting up navigation listeners');

        // Listen for workspace changes to update navigation history
        this.app.workspace.on('file-open', (file) => {
            if (file) {
                this.addToNavigationHistory(file.path);
            }
        });

        this.logger.debug('Navigation listeners setup completed');
    }

    /**
     * Remove navigation event listeners
     */
    private removeNavigationListeners(): void {
        this.logger.debug('Removing navigation listeners');

        // Event listeners are automatically cleaned up when the plugin is unloaded
        // This method is for completeness and future enhancements

        this.logger.debug('Navigation listeners removed');
    }

    /**
     * Add path to navigation history
     */
    private addToNavigationHistory(path: string): void {
        this.logger.debug('Adding path to navigation history', {
            path,
            currentHistory: this.navigationHistory
        });

        // Don't add if it's the same as the current path
        if (this.navigationHistory.length > 0 &&
            this.navigationHistory[this.navigationHistory.length - 1] === path) {
            this.logger.debug('Path already in history, skipping', { path });
            return;
        }

        // Add to history
        this.navigationHistory.push(path);

        // Trim history if it exceeds max size
        if (this.navigationHistory.length > this.maxHistorySize) {
            const removed = this.navigationHistory.splice(0, this.navigationHistory.length - this.maxHistorySize);
            this.logger.debug('Trimmed navigation history', { removed, newSize: this.navigationHistory.length });
        }

        this.logger.debug('Path added to navigation history', {
            path,
            historySize: this.navigationHistory.length
        });
    }
    /**
     * Get navigation options
     */
    getNavigationOptions(): {
        defaultOpenInNewTab: boolean;
    } {
        return {
            defaultOpenInNewTab: false
        };
    }

    /**
     * Validate a file path
     */
    private isValidPath(path: string): boolean {
        // Basic validation
        return Boolean(path &&
            path.length > 0 &&
            !path.includes('<') &&
            !path.includes('>') &&
            !path.includes('|') &&
            !path.includes('?') &&
            !path.includes('*'));
    }
}

// Export the interface for external use
export type { INavigationSlice } from '../shared-contracts/slice-interfaces';
