import { App, TFile, MarkdownView } from 'obsidian';
import { IBacklinksSlice } from '../shared-contracts/slice-interfaces';
import { BacklinkDiscoverer } from './BacklinkDiscoverer';
import { LinkResolver } from './LinkResolver';
import { BacklinkCache } from './BacklinkCache';
import { Logger } from '../shared-utilities/Logger';
import { DailyNote } from '../shared-utilities/DailyNote';
import { BacklinkDiscoveryOptions, BacklinkFilterOptions, BacklinkStatistics } from './types';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';

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

        // Initialize backlink components
        this.backlinkDiscoverer = new BacklinkDiscoverer(app, this.logger, this.options);
        this.linkResolver = new LinkResolver(app, this.logger);
        this.backlinkCache = new BacklinkCache(app, this.logger);

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

        this.logger.debug('Consolidated BacklinksSlice initialized', { options: this.options });
    }

    /**
     * Update backlinks for a file
     */
    async updateBacklinks(filePath: string, leafId?: string): Promise<string[]> {
        return this.withErrorBoundary(async () => {
            this.logger.debug('Updating backlinks', { filePath, leafId });

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
        }, `updateBacklinks(${filePath})`);
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
        const backlinkStats = this.backlinkDiscoverer.getStatistics();

        // For consolidated slice, we extend the basic backlink stats with block and header stats
        return {
            ...backlinkStats,
            // Add consolidated statistics
            totalBlocksExtracted: this.getBlockStatistics().totalBlocksExtracted,
            totalBlocksRendered: this.getBlockStatistics().totalBlocksRendered,
            totalHeadersCreated: this.headerStatistics.totalHeadersCreated,
            totalUserInteractions: this.headerStatistics.totalFilterChanges +
                                this.headerStatistics.totalSortToggles +
                                this.headerStatistics.totalCollapseToggles +
                                this.headerStatistics.totalStrategyChanges +
                                this.headerStatistics.totalThemeChanges +
                                this.headerStatistics.totalAliasSelections
        } as any; // Type assertion needed due to extended interface
    }

    /**
     * Get block statistics
     */
    private getBlockStatistics(): BlockStatistics {
        const extractorStats = this.blockExtractor.getStatistics();
        const rendererStats = this.blockRenderer.getStatistics();

        return {
            totalBlocksExtracted: extractorStats.totalBlocksExtracted,
            totalBlocksRendered: rendererStats.totalBlocksRendered,
            blocksHidden: 0, // This would need tracking
            blocksCollapsed: this.renderOptions.collapsed ? this.getCurrentBlocks('').length : 0,
            averageBlockSize: extractorStats.totalBlocksExtracted > 0 ?
                extractorStats.totalBlocksExtracted / extractorStats.totalExtractions : 0,
            lastExtractionTime: extractorStats.lastExtractionTime,
            lastRenderTime: rendererStats.lastRenderTime
        };
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

    // ===== CONSOLIDATED PUBLIC API METHODS =====

    /**
     * Attach the complete backlinks UI to a view
     * This is the main entry point for rendering the full backlinks feature
     * @param view The markdown view to attach to
     * @param currentNotePath The current note file path
     * @param forceRefresh If true, skip the recent attachment optimization
     * @returns true if UI was attached, false if skipped due to recent attachment
     */
    async attachToDOM(view: MarkdownView, currentNotePath: string, forceRefresh = false): Promise<boolean> {
        return this.withErrorBoundary(async () => {
            const viewId = (view.leaf as any).id || 'unknown';

            this.logger.debug('Attaching backlinks UI to view', { currentNotePath, viewId, forceRefresh });

            // Check if UI is already attached and recent (within last 5 seconds), unless force refresh is requested
            const existingAttachment = this.attachedViews.get(viewId);
            if (!forceRefresh && existingAttachment && (Date.now() - existingAttachment.lastUpdate) < 5000) {
                this.logger.debug('UI already attached recently, skipping', { viewId, currentNotePath });
                return false;
            }

            // Clear any existing coalesce containers from the view
            const existingContainers = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
            existingContainers.forEach(container => container.remove());

            // Get backlinks for the current note
            const backlinks = await this.updateBacklinks(currentNotePath);

            if (backlinks.length === 0) {
                this.logger.debug('No backlinks found, will render UI with no backlinks message', { currentNotePath });
            }

            // Create main container for the backlinks UI
            const container = document.createElement('div');
            container.className = 'coalesce-custom-backlinks-container';

            // Create header
            const headerElement = this.createHeader(container, {
                fileCount: backlinks.length,
                sortDescending: this.currentHeaderState.sortDescending,
                isCollapsed: this.currentHeaderState.isCollapsed,
                currentStrategy: this.currentHeaderState.currentStrategy,
                currentTheme: this.currentHeaderState.currentTheme,
                showFullPathTitle: false,
                aliases: [], // TODO: Extract from frontmatter
                currentAlias: null,
                unsavedAliases: [],
                currentHeaderStyle: this.currentHeaderState.currentHeaderStyle,
                currentFilter: this.currentHeaderState.currentFilter,
                onSortToggle: () => this.handleSortToggle(),
                onCollapseToggle: () => this.handleCollapseToggle(),
                onStrategyChange: (strategy: string) => this.handleStrategyChange(strategy),
                onThemeChange: (theme: string) => this.handleThemeChange(theme),
                onFullPathTitleChange: (show: boolean) => this.updateHeaderState({ showFullPathTitle: show }),
                onAliasSelect: (alias: string | null) => this.handleAliasSelection(alias),
                onHeaderStyleChange: (style: string) => this.handleHeaderStyleChange(style),
                onFilterChange: (filterText: string) => this.handleFilterChange(filterText),
                onSettingsClick: () => this.handleSettingsClick()
            });

            if (headerElement) {
                container.appendChild(headerElement);

                // Ensure header visual state is consistent with current state
                this.headerUI.updateHeader(headerElement, this.currentHeaderState);
            }

            // Create blocks container
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'backlinks-list';
            container.appendChild(blocksContainer);

            // Extract and render blocks
            await this.extractAndRenderBlocks(backlinks, currentNotePath, blocksContainer, view);

            // Apply current theme
            this.applyThemeToContainer(this.currentTheme);

            // Attach the container to the view (after the content)
            this.attachContainerToView(view, container);

            // Track the attachment
            this.attachedViews.set(viewId, {
                container,
                lastUpdate: Date.now()
            });

            this.logger.debug('Backlinks UI attached successfully', { currentNotePath });
            return true;
        }, `attachToDOM(${currentNotePath})`);
    }

    /**
     * Set options for the backlinks feature
     * This controls sorting, collapsing, strategy, theme, alias, and filter settings
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

            // Update header state
            if (options.sort !== undefined) {
                this.currentHeaderState.sortByPath = options.sort;
            }
            if (options.collapsed !== undefined) {
                this.currentHeaderState.isCollapsed = options.collapsed;
                this.renderOptions.collapsed = options.collapsed;
            }
            if (options.strategy !== undefined) {
                this.currentHeaderState.currentStrategy = options.strategy;
            }
            if (options.theme !== undefined) {
                this.currentHeaderState.currentTheme = options.theme;
                this.currentTheme = options.theme;
            }
            if (options.alias !== undefined) {
                this.currentHeaderState.currentAlias = options.alias;
            }
            if (options.filter !== undefined) {
                this.currentHeaderState.currentFilter = options.filter;
            }

            // Apply changes to current UI if it exists
            this.applyCurrentOptions();

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
     * Request focus when the view is ready
     * This handles timing for focus management
     */
    requestFocusWhenReady(leafId: string): void {
        this.logger.debug('Requesting focus when ready', { leafId });

        // For now, this is a simple implementation
        // In a full implementation, this would coordinate with ViewIntegration
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
            // Simple focus request - in practice this would be more sophisticated
            setTimeout(() => {
                this.logger.debug('Focus requested (simplified implementation)', { leafId });
            }, 100);
        }
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
            // Cleanup backlink components
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
            this.eventHandlers.clear();
            this.attachedViews.clear();

            this.logger.debug('Consolidated BacklinksSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup consolidated BacklinksSlice', { error });
        }
    }

    /**
     * Remove UI attachment for a specific view
     */
    removeAttachment(viewId: string): void {
        const attachment = this.attachedViews.get(viewId);
        if (attachment) {
            // Remove the container from DOM if it still exists
            if (attachment.container.parentElement) {
                attachment.container.parentElement.removeChild(attachment.container);
            }
            this.attachedViews.delete(viewId);
            this.logger.debug('Removed attachment for view', { viewId });
        }
    }
}

// Export the interface for external use
export type { IBacklinksSlice } from '../shared-contracts/slice-interfaces';