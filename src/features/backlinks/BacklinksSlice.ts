import { App, TFile, MarkdownView } from 'obsidian';
import { IBacklinksSlice } from '../shared-contracts/slice-interfaces';
import { BacklinkDiscoverer } from './BacklinkDiscoverer';
import { LinkResolver } from './LinkResolver';
import { BacklinkCache } from './BacklinkCache';
import { Logger } from '../shared-utilities/Logger';
import { BacklinkDiscoveryOptions, BacklinkFilterOptions, BacklinkStatistics } from './types';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';
import { BacklinksState } from './core/BacklinksState';
import { BacklinksEvents } from './core/BacklinksEvents';
import { BacklinksCore } from './core/BacklinksCore';
import { BacklinksViewController } from './ui/BacklinksViewController';

// Import components from BacklinkBlocks slice
import { BlockExtractor } from './BlockExtractor';
import { BlockRenderer } from './BlockRenderer';
import { StrategyManager } from './StrategyManager';
import { BlockData, BlockRenderOptions, BlockStatistics } from './types';

// Import components from BacklinksHeader slice
import { HeaderUI } from './HeaderUI';
import { FilterControls } from './FilterControls';
import { SettingsControls } from './SettingsControls';
import { HeaderCreateOptions, HeaderState, HeaderStatistics } from './types';

/**
 * Consolidated Backlinks Slice Implementation
 *
 * This slice owns the complete backlinks feature from discovery to display:
 * - Backlink discovery, link resolution, and cache management
 * - Block extraction, rendering, and filtering
 * - Header UI controls and user interactions
 * - End-to-end feature delivery with clean public API
 */
export class BacklinksSlice implements IBacklinksSlice {
    private app: App;
    private logger: Logger;

    // Core/domain services
    private state: BacklinksState;
    private events: BacklinksEvents;
    private core: BacklinksCore;

    // Backlink components
    private backlinkDiscoverer: BacklinkDiscoverer;
    private linkResolver: LinkResolver;
    private backlinkCache: BacklinkCache;
    private options: BacklinkDiscoveryOptions;
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private currentBacklinks: Map<string, string[]> = new Map();

    // Block-related components (from BacklinkBlocks slice)
    private blockExtractor: BlockExtractor;
    private blockRenderer: BlockRenderer;
    private strategyManager: StrategyManager;
    private currentBlocks: Map<string, BlockData[]> = new Map();
    private renderOptions: BlockRenderOptions;
    private lastRenderContext?: { filePaths: string[]; currentNoteName: string; container: HTMLElement; view: MarkdownView };
    private currentTheme = 'default';

    // Header-related components (from BacklinksHeader slice)
    private headerUI: HeaderUI;
    private filterControls: FilterControls;
    private settingsControls: SettingsControls;
    private currentHeaders: Map<string, HTMLElement> = new Map();
    private headerStatistics: HeaderStatistics;
    private currentHeaderState: HeaderState;

    // UI state tracking for consistency
    private attachedViews: Map<string, { container: HTMLElement; lastUpdate: number }> = new Map();

    // View controller (new UI layer)
    private viewController: BacklinksViewController;

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

        // Initialize core/domain services and backlink components
        this.state = new BacklinksState();
        this.events = new BacklinksEvents(this.logger);
        this.core = new BacklinksCore(this.app, this.logger, this.options, this.state, this.events);

        // Use core-owned components for backward compatible methods
        this.backlinkDiscoverer = this.core.getBacklinkDiscoverer();
        this.backlinkCache = this.core.getBacklinkCache();
        this.linkResolver = new LinkResolver(app, this.logger);

        // Initialize block components
        this.renderOptions = {
            headerStyle: 'full',
            hideBacklinkLine: false,
            hideFirstHeader: false,
            showFullPathTitle: false,
            collapsed: false,
            sortByPath: false,
            sortDescending: true
        };
        this.blockExtractor = new BlockExtractor(app, this.logger);
        this.blockRenderer = new BlockRenderer(app, this.logger);
        this.strategyManager = new StrategyManager(this.logger, 'default');

        // Initialize header components
        this.settingsControls = new SettingsControls(this.logger);
        this.headerUI = new HeaderUI(app, this.logger, this.settingsControls);
        this.filterControls = new FilterControls(this.logger);

        // Initialize header state
        this.currentHeaderState = {
            fileCount: 0,
            sortByPath: false,
            sortDescending: true,
            isCollapsed: false,
            currentStrategy: 'default',
            currentTheme: 'default',
            showFullPathTitle: false,
            currentAlias: null,
            currentHeaderStyle: 'full',
            currentFilter: '',
            isCompact: false
        };

        // Ensure renderOptions.collapsed is in sync with header state
        this.renderOptions.collapsed = this.currentHeaderState.isCollapsed;

        // Initialize header statistics
        this.headerStatistics = {
            totalHeadersCreated: 0,
            totalFilterChanges: 0,
            totalSortToggles: 0,
            totalCollapseToggles: 0,
            totalStrategyChanges: 0,
            totalThemeChanges: 0,
            totalAliasSelections: 0,
            totalSettingsClicks: 0,
            totalHeaderStyleChanges: 0
        };

        // Initialize view controller (UI layer)
        this.viewController = new BacklinksViewController(
            app,
            this.logger,
            this.core,
            this.blockExtractor,
            this.blockRenderer,
            this.strategyManager,
            this.headerUI,
            this.filterControls,
            this.settingsControls
        );

        this.logger.debug('Consolidated BacklinksSlice initialized', { options: this.options });
    }

    /**
     * Update backlinks for a file
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
     * Get current backlinks for a file
     * Delegates to BacklinksCore/BacklinksState.
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
     * Delegates to BacklinksCore/cache.
     */
    getCachedBacklinks(filePath: string): string[] | null {
        this.logger.debug('Getting cached backlinks', { filePath });
        return this.core.getCachedBacklinks(filePath);
    }

    /**
     * Clear cache (required by interface)
     * Delegates to BacklinksCore.
     */
    clearCache(filePath?: string): void {
        this.logger.debug('Clearing cache', { filePath });
        this.core.clearCache(filePath);
    }

    /**
     * Get backlink metadata (required by interface)
     * Delegates to BacklinksCore.
     */
    getBacklinkMetadata(): { lastUpdated: Date; cacheSize: number } {
        this.logger.debug('Getting backlink metadata');
        return this.core.getBacklinkMetadata();
    }

    /**
     * Check if backlinks have changed
     * Delegates to BacklinksCore.
     */
    haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean {
        return this.core.haveBacklinksChanged(filePath, newBacklinks);
    }

    /**
     * Invalidate cache for a file
     * Delegates to BacklinksCore.
     */
    invalidateCache(filePath: string): void {
        this.core.invalidateCache(filePath);
    }

    /**
     * Clear all backlinks
     * Delegates to BacklinksCore.
     */
    clearBacklinks(): void {
        this.logger.debug('Clearing all backlinks');
        this.core.clearBacklinks();
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
     *
     * Domain stats come from BacklinksCore, while block/header/user interaction
     * stats are provided by the view layer (BacklinksViewController).
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
        } as any;
    }

    /**
     * Get block statistics (delegated to view controller)
     */
    private getBlockStatistics(): BlockStatistics {
        return this.viewController.getBlockStatistics();
    }

    /**
     * Update options
     */
    updateOptions(options: Partial<BacklinkDiscoveryOptions>): void {
        this.logger.debug('Updating options', { options });
        this.options = { ...this.options, ...options };
        this.core.updateOptions(options);
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

    // ===== CONSOLIDATED PUBLIC API METHODS =====

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
     * Set options for the backlinks feature.
     * Delegates to BacklinksViewController.
     */
    setOptions(options: {
        sort?: boolean;
        collapsed?: boolean;
        strategy?: string;
        theme?: string;
        alias?: string | null;
        filter?: string;
    }): void {
        try {
            this.logger.debug('Setting backlinks options', { options });
            this.viewController.setOptions(options);
            this.logger.debug('Backlinks options set successfully', { options });
        } catch (error) {
            this.logger.logErrorWithContext(error, `setOptions(${JSON.stringify(options)})`);
            throw error;
        }
    }

    /**
     * Attach container to view
     * This handles the DOM attachment of the backlinks container to the view
     */
    private attachContainerToView(view: MarkdownView, container: HTMLElement): void {
        this.logger.debug('Attaching container to view', { filePath: view.file?.path });

        try {
            // Find the appropriate attachment point in the view
            // Use the same approach as DOMAttachmentService - attach after .markdown-preview-section
            const markdownSection = view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;

            if (markdownSection) {
                // Insert the container after the markdown preview section
                markdownSection.insertAdjacentElement('afterend', container);

                // Ensure the container is visible
                container.style.minHeight = '50px';
                container.style.display = 'block';
                container.style.visibility = 'visible';

                this.logger.debug('Container attached to view successfully');
            } else {
                this.logger.error('Could not find .markdown-preview-section for attachment');
            }
        } catch (error) {
            this.logger.error('Failed to attach container to view', { error });
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

    // ===== HEADER-RELATED METHODS (from BacklinksHeader slice) =====

    /**
     * Create header for the backlinks UI
     */
    private createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement {
        this.logger.debug('Creating header', { options });

        try {
            // Create header using HeaderUI
            const header = this.headerUI.createHeader(container, options);

            // Store header reference
            const headerId = this.generateHeaderId(container);
            this.currentHeaders.set(headerId, header);

            // Update current state
            this.updateCurrentHeaderState(options);

            // Update statistics
            this.headerStatistics.totalHeadersCreated++;

            this.logger.debug('Header created successfully', { headerId });

            return header;
        } catch (error) {
            this.logger.error('Failed to create header', { options, error });
            throw error;
        }
    }

    /**
     * Handle sort toggle
     */
    private handleSortToggle(): void {
        this.logger.debug('Handling sort toggle');

        try {
            // Update statistics
            this.headerStatistics.totalSortToggles++;

            // Toggle sort direction
            this.currentHeaderState.sortDescending = !this.currentHeaderState.sortDescending;
            this.currentHeaderState.sortByPath = true;

            // Apply sorting to current blocks if they exist
            if (this.lastRenderContext) {
                this.applySortingToDOM(this.lastRenderContext.container, this.currentHeaderState.sortDescending);
            }

            this.logger.debug('Sort toggle handled successfully', {
                sortByPath: this.currentHeaderState.sortByPath,
                descending: this.currentHeaderState.sortDescending
            });
        } catch (error) {
            this.logger.error('Failed to handle sort toggle', { error });
        }
    }

    /**
     * Handle collapse toggle
     */
    private handleCollapseToggle(): void {
        this.logger.debug('Handling collapse toggle');

        try {
            // Update statistics
            this.headerStatistics.totalCollapseToggles++;

            // Update state
            this.currentHeaderState.isCollapsed = !this.currentHeaderState.isCollapsed;
            this.renderOptions.collapsed = this.currentHeaderState.isCollapsed;

            // Apply collapse to current blocks
            this.setAllBlocksCollapsed(this.currentHeaderState.isCollapsed);

            // Apply to DOM
            if (this.lastRenderContext) {
                this.applyCollapseStateToDOM(this.lastRenderContext.container, this.currentHeaderState.isCollapsed);
            }

            // Emit custom event to save collapse state to settings
            const event = new CustomEvent('coalesce-settings-collapse-changed', {
                detail: {
                    collapsed: this.currentHeaderState.isCollapsed
                }
            });
            document.dispatchEvent(event);

            this.logger.debug('Collapse toggle handled successfully', {
                collapsed: this.currentHeaderState.isCollapsed
            });
        } catch (error) {
            this.logger.error('Failed to handle collapse toggle', { error });
        }
    }

    /**
     * Handle strategy change
     */
    private async handleStrategyChange(strategy: string): Promise<void> {
        this.logger.debug('Handling strategy change', { strategy });

        try {
            // Update statistics
            this.headerStatistics.totalStrategyChanges++;

            // Update state
            this.currentHeaderState.currentStrategy = strategy;

            // Set new strategy
            this.strategyManager.setCurrentStrategy(strategy);

            // Re-render blocks with new strategy
            if (this.lastRenderContext) {
                const { filePaths, currentNoteName, container, view } = this.lastRenderContext;
                await this.extractAndRenderBlocks(filePaths, currentNoteName, container, view);
            }

            this.logger.debug('Strategy change handled successfully', { strategy });
        } catch (error) {
            this.logger.error('Failed to handle strategy change', { strategy, error });
        }
    }

    /**
     * Handle theme change
     */
    private handleThemeChange(theme: string): void {
        this.logger.debug('Handling theme change', { theme });

        try {
            // Update statistics
            this.headerStatistics.totalThemeChanges++;

            // Update state
            this.currentHeaderState.currentTheme = theme;
            this.currentTheme = theme;

            // Apply theme
            this.applyThemeToContainer(theme);

            this.logger.debug('Theme change handled successfully', { theme });
        } catch (error) {
            this.logger.error('Failed to handle theme change', { theme, error });
        }
    }

    /**
     * Handle header style change
     */
    private handleHeaderStyleChange(style: string): void {
        this.logger.debug('Handling header style change', { style });

        try {
            // Update statistics
            this.headerStatistics.totalHeaderStyleChanges++;

            // Update state
            this.currentHeaderState.currentHeaderStyle = style;

            // Update render options
            this.renderOptions.headerStyle = style;

            // Update block title display
            this.updateBlockTitleDisplay(style);

            this.logger.debug('Header style change handled successfully', { style });
        } catch (error) {
            this.logger.error('Failed to handle header style change', { style, error });
        }
    }

    /**
     * Handle alias selection
     */
    private handleAliasSelection(alias: string | null): void {
        this.logger.debug('Handling alias selection', { alias });

        try {
            // Update statistics
            this.headerStatistics.totalAliasSelections++;

            // Update state
            this.currentHeaderState.currentAlias = alias;

            // Apply alias filtering
            const currentNoteName = this.lastRenderContext?.currentNoteName || '';
            this.filterBlocksByAlias(currentNoteName, alias);

            this.logger.debug('Alias selection handled successfully', { alias });
        } catch (error) {
            this.logger.error('Failed to handle alias selection', { alias, error });
        }
    }

    /**
     * Handle filter change
     */
    private handleFilterChange(filterText: string): void {
        this.logger.debug('Handling filter change', { filterText });

        try {
            // Update statistics
            this.headerStatistics.totalFilterChanges++;

            // Update state
            this.currentHeaderState.currentFilter = filterText;

            // Apply text filtering
            this.filterBlocksByText('', filterText);

            this.logger.debug('Filter change handled successfully', { filterText });
        } catch (error) {
            this.logger.error('Failed to handle filter change', { filterText, error });
        }
    }

    /**
     * Handle settings click
     */
    private handleSettingsClick(): void {
        this.logger.debug('Handling settings click');

        try {
            // Update statistics
            this.headerStatistics.totalSettingsClicks++;

            // For now, just log - settings UI is handled by the main plugin
            this.logger.debug('Settings click handled (delegated to main plugin)');
        } catch (error) {
            this.logger.error('Failed to handle settings click', { error });
        }
    }

    /**
     * Update header state
     */
    private updateHeaderState(state: Partial<HeaderState>): void {
        this.logger.debug('Updating header state', { state });

        this.currentHeaderState = { ...this.currentHeaderState, ...state };

        this.logger.debug('Header state updated successfully', { state });
    }

    /**
     * Update current header state
     */
    private updateCurrentHeaderState(options: HeaderCreateOptions): void {
        this.currentHeaderState = {
            fileCount: options.fileCount,
            sortByPath: this.currentHeaderState.sortByPath,
            sortDescending: this.currentHeaderState.sortDescending,
            isCollapsed: options.isCollapsed,
            currentStrategy: options.currentStrategy,
            currentTheme: options.currentTheme,
            showFullPathTitle: options.showFullPathTitle,
            currentAlias: options.currentAlias,
            currentHeaderStyle: options.currentHeaderStyle,
            currentFilter: options.currentFilter,
            isCompact: this.currentHeaderState.isCompact
        };
    }

    /**
     * Generate header ID
     */
    private generateHeaderId(container: HTMLElement): string {
        return `header-${container.id || 'unknown'}-${Date.now()}`;
    }

    // ===== NAVIGATION METHODS (moved from separate navigation handling) =====

    /**
     * Handle navigation from backlinks (file opening, block scrolling)
     */
    public handleNavigation(filePath: string, openInNewTab = false, blockId?: string): void {
        try {
            this.logger.debug('Handling navigation from backlinks', { filePath, openInNewTab, blockId });

            if (blockId) {
                // Use Obsidian's built-in link handling for block references
                const linkText = `[[${filePath}#^${blockId}]]`;
                this.app.workspace.openLinkText(linkText, '', openInNewTab);
                this.logger.debug('Block reference navigation initiated', { filePath, blockId });
            } else {
                // Use Obsidian's built-in navigation for regular file opening
                this.app.workspace.openLinkText(`[[${filePath}]]`, '', openInNewTab);
                this.logger.debug('File navigation initiated', { filePath });
            }
        } catch (error) {
            this.logger.logErrorWithContext(error, `handleNavigation(${filePath}, ${openInNewTab}, ${blockId})`);
            throw error;
        }
    }

    // ===== BLOCK-RELATED METHODS (from BacklinkBlocks slice) =====

    /**
     * Extract and render blocks from files
     */
    private async extractAndRenderBlocks(
        filePaths: string[],
        currentNoteName: string,
        container: HTMLElement,
        view?: MarkdownView
    ): Promise<void> {
        this.logger.debug('Extracting and rendering blocks', {
            filePathCount: filePaths.length,
            currentNoteName
        });

        try {
            // Persist context for future re-renders
            this.lastRenderContext = {
                filePaths,
                currentNoteName,
                container,
                view: view || (this.app.workspace.getActiveViewOfType(MarkdownView) as MarkdownView)
            };

            let allBlocks: BlockData[] = [];

            // Extract blocks from each file
            for (const filePath of filePaths) {
                this.logger.debug('Processing backlink file', { filePath });
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file && file instanceof TFile) {
                    const content = await this.app.vault.read(file);
                    this.logger.debug('File content loaded', { filePath, contentLength: content.length });
                    const blocks = await this.blockExtractor.extractBlocks(
                        content,
                        currentNoteName,
                        this.strategyManager.getCurrentStrategy()
                    );
                    this.logger.debug('Blocks extracted from file', { filePath, blockCount: blocks.length });

                    // Set source path for each block
                    blocks.forEach(block => {
                        block.sourcePath = filePath;
                    });

                    allBlocks.push(...blocks);
                } else {
                    this.logger.warn('File not found or not TFile', { filePath, fileType: file?.constructor.name });
                }
            }
            this.logger.debug('Total blocks extracted from all files', { totalBlocks: allBlocks.length });

            // Set initial collapsed state
            allBlocks.forEach(block => {
                block.isCollapsed = this.renderOptions.collapsed;
            });

            // Store current blocks
            this.currentBlocks.set(currentNoteName, allBlocks);

            // Sort blocks if requested
            if (this.renderOptions.sortByPath) {
                allBlocks = this.sortBlocks(allBlocks, { by: 'path', descending: this.renderOptions.sortDescending });
            }

            // Render blocks
            await this.blockRenderer.renderBlocks(
                container,
                allBlocks,
                this.renderOptions,
                currentNoteName,
                this.strategyManager.getCurrentStrategy(),
                undefined, // headingPopupComponent
                this.lastRenderContext.view
            );

            // If no blocks were rendered, show a "no backlinks" message
            if (allBlocks.length === 0) {
                this.logger.debug('No blocks to render, adding no backlinks message');
                this.addNoBacklinksMessage(container);
            }

            // Apply current theme
            this.applyThemeToContainer(this.currentTheme);

            this.logger.debug('Blocks extracted and rendered successfully', {
                blockCount: allBlocks.length,
                currentNoteName
            });
        } catch (error) {
            this.logger.error('Failed to extract and render blocks', { filePaths, currentNoteName, error });
        }
    }

    /**
     * Apply sorting to DOM elements
     */
    private applySortingToDOM(container: HTMLElement, descending: boolean): void {
        const linksContainer = container.classList.contains('backlinks-list') ? container : container.querySelector('.backlinks-list');
        if (!linksContainer) return;

        const blockContainers = Array.from(linksContainer.querySelectorAll('.coalesce-backlink-item'));

        // Sort blocks by filename
        blockContainers.sort((a, b) => {
            const pathA = (a as HTMLElement).getAttribute('data-path') || '';
            const pathB = (b as HTMLElement).getAttribute('data-path') || '';

            const fileNameA = pathA.split('/').pop() || '';
            const fileNameB = pathB.split('/').pop() || '';

            const comparison = fileNameA.localeCompare(fileNameB);
            return descending ? -comparison : comparison;
        });

        // Re-append in sorted order
        blockContainers.forEach(block => {
            linksContainer.appendChild(block);
        });

        this.logger.debug('Applied sorting to DOM', {
            descending,
            sortedBlocks: blockContainers.length
        });
    }

    /**
     * Apply collapse state to DOM elements
     */
    private applyCollapseStateToDOM(container: HTMLElement, collapsed: boolean): void {
        let blockContainers: NodeListOf<Element> = container.querySelectorAll('.coalesce-backlink-item');

        if (blockContainers.length === 0) {
            const backlinksList = container.querySelector('.backlinks-list') || document.querySelector('.backlinks-list');
            if (backlinksList) {
                blockContainers = backlinksList.querySelectorAll('.coalesce-backlink-item');
            }
        }

        blockContainers.forEach((blockContainer) => {
            const blockElement = blockContainer as HTMLElement;

            if (collapsed) {
                blockElement.classList.add('is-collapsed');
            } else {
                blockElement.classList.remove('is-collapsed');
            }

            const toggleArrow = blockElement.querySelector('.coalesce-toggle-arrow') as HTMLElement;
            if (toggleArrow) {
                toggleArrow.textContent = collapsed ? '▶' : '▼';
            }
        });

        this.logger.debug('Applied collapse state to DOM', {
            collapsed,
            totalBlocks: blockContainers.length
        });
    }

    /**
     * Apply theme to container
     */
    private applyThemeToContainer(theme: string): void {
        if (this.lastRenderContext) {
            const { container } = this.lastRenderContext;

            // Remove existing theme classes
            container.classList.forEach((className: string) => {
                if (className.startsWith('theme-')) {
                    container.classList.remove(className);
                }
            });

            // Add new theme class
            container.classList.add(`theme-${theme}`);

            this.logger.debug('Applied theme to container', { theme });
        }
    }

    /**
     * Update block title display
     */
    private updateBlockTitleDisplay(headerStyle: string): void {
        this.logger.debug('Updating block title display', { headerStyle });

        // Update render options
        this.renderOptions.headerStyle = headerStyle;

        // Update block renderer
        this.blockRenderer.updateBlockTitleDisplay(headerStyle);

        this.logger.debug('Block title display updated successfully', { headerStyle });
    }

    /**
     * Filter blocks by alias
     */
    private filterBlocksByAlias(currentNoteName: string, alias: string | null): void {
        this.logger.debug('Filtering blocks by alias', { currentNoteName, alias });

        const blocks = this.getCurrentBlocks(currentNoteName);
        this.blockRenderer.filterBlocksByAlias(blocks, alias, currentNoteName);

        this.logger.debug('Blocks filtered by alias successfully', {
            currentNoteName,
            alias,
            blockCount: blocks.length
        });
    }

    /**
     * Filter blocks by text
     */
    private filterBlocksByText(currentNoteName: string, filterText: string): void {
        this.logger.debug('Filtering blocks by text', { currentNoteName, filterText });

        // Update render options
        this.renderOptions.filterText = filterText;

        // Apply filtering to DOM if we have a render context
        if (this.lastRenderContext) {
            const { container } = this.lastRenderContext;
            this.applyTextFilterToDOM(container, filterText);
        }

        this.logger.debug('Blocks filtered by text successfully', { currentNoteName, filterText });
    }

    /**
     * Apply text filtering to DOM elements
     */
    private applyTextFilterToDOM(container: HTMLElement, filterText: string): void {
        const blockContainers = container.querySelectorAll('.coalesce-backlink-item');

        blockContainers.forEach((blockContainer) => {
            const blockElement = blockContainer as HTMLElement;
            const content = blockElement.textContent || '';
            const title = blockElement.querySelector('.coalesce-block-title')?.textContent || '';

            const contentMatch = content.toLowerCase().includes(filterText.toLowerCase());
            const titleMatch = title.toLowerCase().includes(filterText.toLowerCase());
            const matchesFilter = !filterText || contentMatch || titleMatch;

            if (matchesFilter) {
                blockElement.classList.add('has-alias');
                blockElement.classList.remove('no-alias');
            } else {
                blockElement.classList.add('no-alias');
                blockElement.classList.remove('has-alias');
            }
        });

        this.logger.debug('Applied text filter to DOM', {
            filterText,
            totalBlocks: blockContainers.length
        });
    }

    /**
     * Set all blocks collapsed state
     */
    private setAllBlocksCollapsed(collapsed: boolean): void {
        this.renderOptions.collapsed = collapsed;

        // Update all current blocks
        for (const blocks of this.currentBlocks.values()) {
            this.blockRenderer.updateBlockCollapsedState(blocks, collapsed);
        }
    }

    /**
     * Sort blocks
     */
    private sortBlocks(blocks: any[], sort: { by?: string; descending: boolean }): any[] {
        this.logger.debug('Sorting blocks', { blockCount: blocks.length, sort });

        const sortedBlocks = [...blocks].sort((a, b) => {
            let comparison = 0;

            switch (sort.by) {
                case 'path': {
                    const fileNameA = a.sourcePath?.split('/').pop() || '';
                    const fileNameB = b.sourcePath?.split('/').pop() || '';
                    comparison = fileNameA.localeCompare(fileNameB);
                    break;
                }
                case 'heading':
                    comparison = (a.heading || '').localeCompare(b.heading || '');
                    break;
                default:
                    comparison = 0;
            }

            return sort.descending ? -comparison : comparison;
        });

        this.logger.debug('Blocks sorted successfully');
        return sortedBlocks;
    }

    /**
     * Get current blocks for a note
     */
    private getCurrentBlocks(currentNoteName: string): BlockData[] {
        return this.currentBlocks.get(currentNoteName) || [];
    }

    /**
     * Add a "no backlinks" message to the container
     */
    private addNoBacklinksMessage(container: HTMLElement): void {
        this.logger.debug('Adding no backlinks message to container');

        // Create a message element
        const messageElement = document.createElement('div');
        messageElement.className = 'coalesce-no-backlinks-message';
        messageElement.textContent = 'No backlinks found for this note.';

        // Add the message to the container
        container.appendChild(messageElement);

        this.logger.debug('No backlinks message added successfully');
    }

    /**
     * Apply current options to existing UI
     */
    private applyCurrentOptions(): void {
        // Apply current options to existing UI elements
        if (this.lastRenderContext) {
            const { container } = this.lastRenderContext;

            // Apply theme
            this.applyThemeToContainer(this.currentTheme);

            // Apply collapse state
            this.applyCollapseStateToDOM(container, this.currentHeaderState.isCollapsed);

            // Apply sorting if enabled
            if (this.currentHeaderState.sortByPath) {
                this.applySortingToDOM(container, this.currentHeaderState.sortDescending);
            }

            // Apply text filter
            if (this.currentHeaderState.currentFilter) {
                this.applyTextFilterToDOM(container, this.currentHeaderState.currentFilter);
            }
        }
    }

    /**
     * Emit an event
     * Delegates to BacklinksEvents facade.
     */
    private emitEvent(event: CoalesceEvent): void {
        this.events.emitEvent(event);
    }

    /**
     * Add event listener
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.events.addEventListener(eventType, handler);
    }

    /**
     * Remove event listener
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.events.removeEventListener(eventType, handler);
    }

    /**
     * Error boundary wrapper for operations
     */
    private async withErrorBoundary<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logger.logErrorWithContext(error, context);
            throw error;
        }
    }

    /**
     * Cleanup resources used by this slice
     */
    cleanup(): void {
        this.logger.debug('Cleaning up consolidated BacklinksSlice');

        try {
            // Cleanup core services
            this.core.cleanup();
            this.events.clearAllListeners();

            // Cleanup view controller
            this.viewController.cleanup();

            // Cleanup backlink components (kept for backward compatibility)
            this.backlinkDiscoverer.cleanup();
            this.linkResolver.cleanup();
            this.backlinkCache.cleanup();

            // Cleanup block components
            this.blockExtractor.cleanup();
            this.blockRenderer.cleanup();
            this.strategyManager.cleanup();

            // Cleanup header components
            this.headerUI.cleanup();
            this.filterControls.cleanup();
            this.settingsControls.cleanup();

            // Clear data
            this.currentBacklinks.clear();
            this.currentBlocks.clear();
            this.currentHeaders.clear();
            this.attachedViews.clear();

            this.logger.debug('Consolidated BacklinksSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup consolidated BacklinksSlice', { error });
        }
    }

    /**
     * Remove UI attachment for a specific view
     * Delegates to BacklinksViewController.
     */
    removeAttachment(viewId: string): void {
        this.viewController.removeAttachment(viewId);
    }
}

// Export the interface for external use
export type { IBacklinksSlice } from '../shared-contracts/slice-interfaces';