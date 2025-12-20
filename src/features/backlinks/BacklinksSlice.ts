import { App, MarkdownView } from 'obsidian';
import { IBacklinksSlice } from '../shared-contracts/slice-interfaces';
import { IPluginSlice, SliceDependencies } from '../../orchestrator/types';
import { BacklinkDiscoverer } from './BacklinkDiscoverer';
import { LinkResolver } from './LinkResolver';
import { BacklinkCache } from './BacklinkCache';
import { Logger } from '../shared-utilities/Logger';
import { BacklinkDiscoveryOptions, BacklinkFilterOptions, BacklinkStatistics } from './types';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';
import { BacklinksState } from './core/BacklinksState';
import { BacklinksEvents } from './core/BacklinksEvents';
import { BacklinksCore } from './core/BacklinksCore';
import { BacklinksViewController } from './ui/BacklinksViewController';
import { BlockExtractor } from './BlockExtractor';
import { BlockRenderer } from './BlockRenderer';
import { StrategyManager } from './StrategyManager';
import { HeaderUI } from './HeaderUI';
import { FilterControls } from './FilterControls';
import { SettingsControls } from './SettingsControls';
import { NavigationService } from '../navigation/NavigationService';
import { getSharedNavigation } from '../navigation/NavigationFacade';
import type { INoteEditingSlice } from '../shared-contracts/slice-interfaces';

/**
 * BacklinksSlice
 *
 * Thin orchestrator for the backlinks feature.
 *
 * Responsibilities:
 * - Wire core/domain services (BacklinksCore, BacklinksState, BacklinksEvents).
 * - Expose the IBacklinksSlice API expected by the plugin orchestrator.
 * - Delegate discovery/cache/metadata operations to BacklinksCore.
 * - Delegate all DOM and header/block UI behaviour to BacklinksViewController.
 * - Own construction/cleanup of supporting components (discoverer, cache, renderer, header UI).
 */
export class BacklinksSlice implements IPluginSlice, IBacklinksSlice {
    private readonly app: App;
    private readonly logger: Logger;
    
    // Index signature to satisfy IPluginSlice interface
    [key: string]: unknown;

    // Core/domain services
    private state: BacklinksState;
    private events: BacklinksEvents;
    private core: BacklinksCore;

    // Backlink components exposed for backward compatibility
    private backlinkDiscoverer: BacklinkDiscoverer;
    private linkResolver: LinkResolver;
    private backlinkCache: BacklinkCache;

    // Navigation service used for link-based navigation (shared with navigation slice pattern)
    private navigationService: NavigationService;

    private options: BacklinkDiscoveryOptions;

    // View-layer dependencies (owned by this slice, used by the controller)
    private blockExtractor: BlockExtractor;
    private blockRenderer: BlockRenderer;
    private strategyManager: StrategyManager;
    private headerUI: HeaderUI;
    private filterControls: FilterControls;
    private settingsControls: SettingsControls;

    // View controller (UI layer)
    private viewController: BacklinksViewController;

    // Settings slice reference for restoring persisted settings
    private settingsSlice: any;

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

        // Components will be initialized in initialize()
    }

    /**
     * Initialize the slice
     */
    async initialize(dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing BacklinksSlice');

        // Initialize shared navigation service used for link-style navigation
        const sharedNavigation = getSharedNavigation(this.app, this.logger);
        this.navigationService = sharedNavigation.navigationService;

        // Initialize core/domain services
        this.state = new BacklinksState();
        this.events = new BacklinksEvents(this.logger);
        this.core = new BacklinksCore(this.app, this.logger, this.options, this.state, this.events);

        // Use core-owned components for backward compatible methods
        this.backlinkDiscoverer = this.core.getBacklinkDiscoverer();
        this.backlinkCache = this.core.getBacklinkCache();
        this.linkResolver = new LinkResolver(this.app, this.logger);

        // Initialize block and header UI components used by the view controller
        this.blockExtractor = new BlockExtractor(this.app, this.logger);
        this.blockRenderer = new BlockRenderer(this.app, this.logger);
        this.strategyManager = new StrategyManager(this.logger, 'default');

        this.settingsControls = new SettingsControls(this.logger);
        this.headerUI = new HeaderUI(this.app, this.logger, this.settingsControls);
        this.filterControls = new FilterControls(this.logger);

        // Initialize view controller (UI layer)
        const noteEditingSlice = dependencies.noteEditing as INoteEditingSlice | undefined;
        this.viewController = new BacklinksViewController(
            this.app,
            this.logger,
            this.core,
            this.blockExtractor,
            this.blockRenderer,
            this.strategyManager,
            this.headerUI,
            this.filterControls,
            this.settingsControls,
            noteEditingSlice
        );

        this.logger.debug('BacklinksSlice initialized', { options: this.options });

        // Store settings slice reference for restoring persisted settings
        this.settingsSlice = dependencies.settings;

        // Subscribe to events via EventBus
        if (dependencies.eventBus) {
            dependencies.eventBus.on('noteEditing:headingAdded', (data: any) => {
                this.logger.debug('Received noteEditing:headingAdded event', { data });
                // Handle the event - e.g., refresh backlinks for the file
                if (data && data.filePath) {
                    this.updateBacklinks(data.filePath).catch(err =>
                        this.logger.error('Failed to update backlinks on heading added', { error: err })
                    );
                }
            });
        }
    }

    /**
     * Start the slice
     * Restores persisted settings (e.g., header style) from the settings slice.
     */
    async start(): Promise<void> {
        this.logger.debug('Starting BacklinksSlice');

        // Restore settings from settings slice if available
        if (this.settingsSlice && typeof this.settingsSlice.getSettings === 'function') {
            try {
                const settings = this.settingsSlice.getSettings();
                if (settings) {
                    this.logger.debug('Restoring settings', { 
                        headerStyle: settings.headerStyle,
                        hideBacklinkLine: settings.hideBacklinkLine,
                        hideFirstHeader: settings.hideFirstHeader
                    });
                    this.setOptions({ 
                        headerStyle: settings.headerStyle,
                        hideBacklinkLine: settings.hideBacklinkLine,
                        hideFirstHeader: settings.hideFirstHeader
                    });
                }
            } catch (error) {
                this.logger.error('Failed to restore settings', { error });
            }
        }
    }

    /**
     * Stop the slice
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping BacklinksSlice');
    }

    /**
     * Update backlinks for a file.
     *
     * Delegates to BacklinksCore for discovery, caching, state updates,
     * and event emission, while keeping the error boundary at slice level.
     */
    async updateBacklinks(filePath: string, leafId?: string): Promise<string[]> {
        return this.withErrorBoundary(
            () => this.core.updateBacklinks(filePath, leafId),
            `updateBacklinks(${filePath})`
        );
    }

    /**
     * Get current backlinks for a file (from shared state via BacklinksCore).
     */
    getCurrentBacklinks(filePath: string): string[] {
        this.logger.debug('Getting current backlinks', { filePath });

        try {
            const backlinks = this.core.getCurrentBacklinks(filePath);

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
     * Discover backlinks for a given file (required by interface).
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
     * Get cached backlinks (required by interface).
     * Delegates to BacklinksCore/cache.
     */
    getCachedBacklinks(filePath: string): string[] | null {
        this.logger.debug('Getting cached backlinks', { filePath });
        return this.core.getCachedBacklinks(filePath);
    }

    /**
     * Clear cache (required by interface).
     * Delegates to BacklinksCore.
     */
    clearCache(filePath?: string): void {
        this.logger.debug('Clearing cache', { filePath });
        this.core.clearCache(filePath);
    }

    /**
     * Get backlink metadata (required by interface).
     * Delegates to BacklinksCore.
     */
    getBacklinkMetadata(): { lastUpdated: Date; cacheSize: number } {
        this.logger.debug('Getting backlink metadata');
        return this.core.getBacklinkMetadata();
    }

    /**
     * Check if backlinks have changed.
     * Delegates to BacklinksCore.
     */
    haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean {
        return this.core.haveBacklinksChanged(filePath, newBacklinks);
    }

    /**
     * Invalidate cache for a file.
     * Delegates to BacklinksCore.
     */
    invalidateCache(filePath: string): void {
        this.logger.debug('Invalidating cache', { filePath });
        this.core.invalidateCache(filePath);
    }

    /**
     * Clear all backlinks.
     * Delegates to BacklinksCore.
     */
    clearBacklinks(): void {
        this.logger.debug('Clearing all backlinks');
        this.core.clearBacklinks();
    }

    /**
     * Low-level accessors used by some callers/tests.
     */
    getBacklinkDiscoverer(): BacklinkDiscoverer {
        return this.backlinkDiscoverer;
    }

    getLinkResolver(): LinkResolver {
        return this.linkResolver;
    }

    getBacklinkCache(): BacklinkCache {
        return this.backlinkCache;
    }

    /**
     * Aggregate statistics from core + view layer.
     *
     * Domain stats come from BacklinksCore, while block/header/user interaction
     * stats are provided by the view controller.
     */
    getStatistics(): BacklinkStatistics {
        const backlinkStats = this.core.getStatistics();
        const blockStats = this.viewController.getBlockStatistics();
        const headerStats = this.viewController.getHeaderStatistics();

        return {
            ...backlinkStats,
            totalBlocksExtracted: blockStats.totalBlocksExtracted,
            totalBlocksRendered: blockStats.totalBlocksRendered,
            totalHeadersCreated: headerStats.totalHeadersCreated,
            totalUserInteractions:
                headerStats.totalFilterChanges +
                headerStats.totalSortToggles +
                headerStats.totalCollapseToggles +
                headerStats.totalStrategyChanges +
                headerStats.totalThemeChanges +
                headerStats.totalAliasSelections
        };
    }

    /**
     * Update discovery options.
     */
    updateOptions(options: Partial<BacklinkDiscoveryOptions>): void {
        this.logger.debug('Updating options', { options });
        this.options = { ...this.options, ...options };
        this.core.updateOptions(options);
        this.logger.debug('Options updated successfully', { options: this.options });
    }

    /**
     * Get current options.
     */
    getOptions(): BacklinkDiscoveryOptions {
        return { ...this.options };
    }

    /**
     * Filter backlinks based on criteria.
     *
     * Delegates to BacklinksCore.filterBacklinks so the domain layer owns
     * the filtering rules.
     */
    filterBacklinks(backlinks: string[], filePath: string, options?: BacklinkFilterOptions): string[] {
        return this.core.filterBacklinks(backlinks, filePath, options);
    }

    // ===== Public API methods that delegate to the view controller =====

    /**
     * Attach the complete backlinks UI to a view.
     * Delegates DOM work to BacklinksViewController while preserving error boundary.
     */
    async attachToDOM(
        view: MarkdownView,
        currentNotePath: string,
        forceRefresh = false
    ): Promise<boolean> {
        return this.withErrorBoundary(
            () => this.viewController.attachToDOM(view, currentNotePath, forceRefresh),
            `attachToDOM(${currentNotePath})`
        );
    }

    /**
     * Set options for the backlinks feature (sort/collapse/strategy/theme/alias/filter/headerStyle).
     * Delegates to BacklinksViewController.
     */
    setOptions(options: {
        sort?: boolean;
        sortDescending?: boolean;
        collapsed?: boolean;
        strategy?: string;
        theme?: string;
        alias?: string | null;
        filter?: string;
        headerStyle?: string;
        hideBacklinkLine?: boolean;
        hideFirstHeader?: boolean;
    }): void {
        try {
            this.logger.debug('Setting backlinks options', { options });
            this.viewController.setOptions(options);
            this.logger.debug('Backlinks options set successfully', { options });
        } catch (error) {
            this.logger.logErrorWithContext(error as Error, `setOptions(${JSON.stringify(options)})`);
            throw error;
        }
    }

    /**
     * Request focus when the view is ready.
     * Delegates to BacklinksViewController.
     */
    requestFocusWhenReady(leafId: string): void {
        this.logger.debug('Requesting focus when ready (slice)', { leafId });
        this.viewController.requestFocusWhenReady(leafId);
    }

    /**
     * Refresh all attached views to re-render with current options.
     */
    async refreshAllViews(): Promise<void> {
        this.logger.debug('Refreshing all views (slice)');
        await this.viewController.refreshAllViews();
    }

    // ===== Navigation =====

    /**
     * Handle navigation from backlinks (file opening, block scrolling).
     *
     * Delegates to the shared NavigationService using wiki-link style text so
     * that Obsidian handles headings and block references consistently.
     */
    handleNavigation(filePath: string, openInNewTab = false, blockId?: string): void {
        this.logger.debug('Handling navigation from backlinks', { filePath, openInNewTab, blockId });

        // Defensive: ensure we never wrap an already-wrapped [[...]] path.
        let cleanPath = (filePath || '').trim();
        while (cleanPath.startsWith('[[')) cleanPath = cleanPath.slice(2);
        while (cleanPath.endsWith(']]')) cleanPath = cleanPath.slice(0, -2);

        // IMPORTANT:
        // This is link *text* for Obsidian's openLinkText API, not a filename.
        // Do NOT wrap in [[...]]; brackets are markdown syntax and can leak into filenames.
        const linkText = blockId ? `${cleanPath}#^${blockId}` : cleanPath;

        try {
            void this.navigationService.openWikiLink(linkText, openInNewTab);
        } catch (error) {
            this.logger.logErrorWithContext(
                error as Error,
                `handleNavigation(${filePath}, ${openInNewTab}, ${blockId})`
            );
            throw error;
        }
    }

    // ===== Events =====

    /**
     * Emit an event.
     * Delegates to BacklinksEvents facade.
     */
    private emitEvent(event: CoalesceEvent): void {
        this.events.emitEvent(event);
    }

    /**
     * Add event listener.
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.events.addEventListener(eventType, handler);
    }

    /**
     * Remove event listener.
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.events.removeEventListener(eventType, handler);
    }

    // ===== Infrastructure =====

    /**
     * Error boundary wrapper for async operations.
     */
    private async withErrorBoundary<T>(operation: () => Promise<T>, context: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logger.logErrorWithContext(error as Error, context);
            throw error;
        }
    }

    /**
     * Cleanup resources used by this slice.
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up BacklinksSlice');

        try {
            // Core services - check if initialized before accessing
            if (this.core) {
                this.core.cleanup();
            }
            if (this.events) {
                this.events.clearAllListeners();
            }
            if (this.state) {
                this.state.reset();
            }

            // View/controller - check if initialized before accessing
            if (this.viewController) {
                this.viewController.cleanup();
            }

            // Backlink components (kept for backward compatibility) - check if initialized before accessing
            if (this.backlinkDiscoverer) {
                this.backlinkDiscoverer.cleanup();
            }
            if (this.linkResolver) {
                this.linkResolver.cleanup();
            }
            if (this.backlinkCache) {
                this.backlinkCache.cleanup();
            }

            // Block/header components - check if initialized before accessing
            if (this.blockExtractor) {
                this.blockExtractor.cleanup();
            }
            if (this.blockRenderer) {
                this.blockRenderer.cleanup();
            }
            if (this.strategyManager) {
                this.strategyManager.cleanup();
            }
            if (this.headerUI) {
                this.headerUI.cleanup();
            }
            if (this.filterControls) {
                this.filterControls.cleanup();
            }
            if (this.settingsControls) {
                this.settingsControls.cleanup();
            }

            this.logger.debug('BacklinksSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BacklinksSlice', { error });
        }
    }

    /**
     * Remove UI attachment for a specific view.
     * Delegates to BacklinksViewController.
     */
    removeAttachment(viewId: string): void {
        if (this.viewController) {
            this.viewController.removeAttachment(viewId);
        } else {
            this.logger.warn('removeAttachment called before viewController initialized', { viewId });
        }
    }
}

// Export the interface for external use
export type { IBacklinksSlice } from '../shared-contracts/slice-interfaces';
