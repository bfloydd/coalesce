import { App, TFile, MarkdownView } from 'obsidian';
import { Logger } from '../../shared-utilities/Logger';
import { PerformanceMonitor } from '../../shared-utilities/PerformanceMonitor';
import {
    BlockData,
    BlockRenderOptions,
    BlockStatistics,
    HeaderCreateOptions,
    HeaderState,
    HeaderStatistics
} from '../types';
import { BacklinksCore } from '../core/BacklinksCore';
import { BlockExtractor } from '../BlockExtractor';
import { BlockRenderer } from '../BlockRenderer';
import { StrategyManager } from '../StrategyManager';
import { HeaderUI } from '../HeaderUI';
import { FilterControls } from '../FilterControls';
import { SettingsControls } from '../SettingsControls';
import { HeaderController } from './HeaderController';

/**
 * BacklinksViewController
 *
 * Owns all DOM- and view-related behaviour for the backlinks UI:
 * - Attaching the backlinks container into a MarkdownView
 * - Creating and updating the header
 * - Extracting and rendering backlink blocks
 * - Applying sort/collapse/theme/filter options to the DOM
 *
 * This class has no knowledge of plugin lifecycle or orchestrator wiring.
 * It collaborates with BacklinksCore for data and keeps its own view state.
 */
export class BacklinksViewController {
    private currentBlocks: Map<string, BlockData[]> = new Map();
    private renderOptions: BlockRenderOptions;
    private performanceMonitor: PerformanceMonitor;
    private lastRenderContext?: {
        filePaths: string[];
        currentNoteName: string;
        container: HTMLElement;
        view: MarkdownView;
    };
    private currentTheme = 'default';

    private readonly headerController: HeaderController;

    private attachedViews: Map<string, { container: HTMLElement; lastUpdate: number }> = new Map();
    // Track views that showed "No backlinks found" and might need retry
    private pendingRetries: Map<string, { filePath: string; view: MarkdownView; retryCount: number }> = new Map();
    // Track views currently being processed to prevent concurrent attachToDOM calls
    private processingViews: Set<string> = new Set();

    constructor(
        private readonly app: App,
        private readonly logger: Logger,
        private readonly core: BacklinksCore,
        private readonly blockExtractor: BlockExtractor,
        private readonly blockRenderer: BlockRenderer,
        private readonly strategyManager: StrategyManager,
        private readonly headerUI: HeaderUI,
        private readonly filterControls: FilterControls,
        private readonly settingsControls: SettingsControls
    ) {
        // Initial render options mirror the previous BacklinksSlice defaults
        this.renderOptions = {
            headerStyle: 'full',
            hideBacklinkLine: false,
            hideFirstHeader: false,
            showFullPathTitle: false,
            collapsed: false,
            sortByPath: false,
            sortDescending: true
        };

        // Initialize header controller as the single source of truth for header state/statistics
        this.headerController = new HeaderController(this.logger, this.headerUI);
        const initialHeaderState = this.headerController.getHeaderState();
        this.renderOptions.collapsed = initialHeaderState.isCollapsed;

        this.performanceMonitor = new PerformanceMonitor(
            this.logger.child('Performance'),
            () => Logger.getGlobalLogging().enabled
        );

        this.logger.debug('BacklinksViewController initialized', {
            headerState: initialHeaderState
        });
    }

    /**
     * Attach the complete backlinks UI to a view.
     * Returns true if UI attached, false if skipped due to recent attachment.
     */
    async attachToDOM(
        view: MarkdownView,
        currentNotePath: string,
        forceRefresh = false
    ): Promise<boolean> {
        const viewId = (view.leaf as any).id || 'unknown';
        const startTime = Date.now();
        const metadataCacheState = {
            resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
            unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
            hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                       Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
        };

        this.logger.info('=== CODE PATH: BacklinksViewController.attachToDOM ===', {
            currentNotePath,
            viewId,
            forceRefresh,
            timestamp: startTime,
            metadataCacheState
        });

        // CRITICAL: Prevent concurrent attachToDOM calls for the same view
        if (this.processingViews.has(viewId)) {
            this.logger.warn('BLOCKED: attachToDOM already in progress for this view, skipping duplicate call', {
                currentNotePath,
                viewId,
                forceRefresh,
                timestamp: startTime,
                callStack: new Error().stack?.split('\n').slice(1, 6).join(' -> ')
            });
            return false;
        }

        // Mark as processing immediately to prevent concurrent calls
        this.processingViews.add(viewId);

        try {
            // CRITICAL: Check if UI is already attached in the DOM - this is an ERROR condition
            const existingContainersInDOM = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
            if (existingContainersInDOM.length > 0) {
                this.logger.error('ERROR: Attempting to attach coalesce UI to a note that already has it!', {
                    currentNotePath,
                    viewId,
                    existingContainerCount: existingContainersInDOM.length,
                    forceRefresh,
                    timestamp: startTime,
                    callStack: new Error().stack?.split('\n').slice(1, 6).join(' -> ')
                });
                // Still clear and reattach to prevent duplicates, but log the error
                existingContainersInDOM.forEach(container => container.remove());
            }

            // Check if UI is already attached and recent (within last 5 seconds), unless force refresh is requested
            const existingAttachment = this.attachedViews.get(viewId);
            if (!forceRefresh && existingAttachment && Date.now() - existingAttachment.lastUpdate < 5000) {
                this.logger.debug('UI already attached recently, skipping', { viewId, currentNotePath });
                return false;
            }

            // Clear any existing coalesce containers from the view (defensive cleanup)
            const existingContainers = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
            existingContainers.forEach(container => container.remove());

            // Get backlinks for the current note via core
            const backlinksStartTime = Date.now();
            this.logger.info('Calling core.updateBacklinks', {
                currentNotePath,
                viewId,
                metadataCacheStateBefore: {
                    resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                    unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                    hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                               Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
                }
            });
            
            let backlinks = await this.core.updateBacklinks(currentNotePath, viewId);
            
            const backlinksDuration = Date.now() - backlinksStartTime;
            this.logger.info('core.updateBacklinks completed', {
                currentNotePath,
                viewId,
                backlinkCount: backlinks.length,
                duration: backlinksDuration,
                metadataCacheStateAfter: {
                    resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                    unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                    hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                               Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
                }
            });

            // If no backlinks found and metadata cache appears empty, schedule a retry
            if (backlinks.length === 0) {
                const metadataCacheReady = Object.keys(this.app.metadataCache.resolvedLinks).length > 0 ||
                                          Object.keys(this.app.metadataCache.unresolvedLinks).length > 0;
                
                if (!metadataCacheReady) {
                    // Metadata cache might not be ready yet, schedule a retry
                    const retryInfo = this.pendingRetries.get(viewId);
                    const retryCount = retryInfo ? retryInfo.retryCount : 0;
                    
                    if (retryCount < 3) { // Max 3 retries
                        this.logger.debug('No backlinks found and metadata cache appears empty, scheduling retry', {
                            currentNotePath,
                            viewId,
                            retryCount: retryCount + 1
                        });
                        
                        this.pendingRetries.set(viewId, {
                            filePath: currentNotePath,
                            view,
                            retryCount: retryCount + 1
                        });
                        
                        // Retry after a delay (increasing delay for each retry)
                        setTimeout(async () => {
                            const pendingRetry = this.pendingRetries.get(viewId);
                            if (pendingRetry && pendingRetry.filePath === currentNotePath) {
                                this.logger.debug('Retrying backlink discovery after delay', {
                                    currentNotePath,
                                    viewId,
                                    retryCount: pendingRetry.retryCount
                                });
                                
                                // Retry with force refresh to bypass duplicate suppression
                                await this.attachToDOM(view, currentNotePath, true);
                            }
                        }, 1000 + (retryCount * 500)); // 1s, 1.5s, 2s delays
                    } else {
                        this.logger.debug('Max retries reached, showing no backlinks message', {
                            currentNotePath,
                            viewId
                        });
                        this.pendingRetries.delete(viewId);
                    }
                } else {
                    // Metadata cache is ready, so there really are no backlinks
                    this.logger.debug('No backlinks found (metadata cache ready), will render UI with no backlinks message', {
                        currentNotePath
                    });
                    this.pendingRetries.delete(viewId);
                }
            } else {
                // Backlinks found, clear any pending retry
                this.pendingRetries.delete(viewId);
            }

            // Create main container for the backlinks UI
            const container = document.createElement('div');
            container.className = 'coalesce-custom-backlinks-container';

            // Extract aliases from current note's frontmatter
            const aliases = this.extractAliasesFromNote(currentNotePath);

            // Create header using HeaderController (stateful)
            const headerState = this.headerController.getHeaderState();
            const headerElement = this.headerController.createHeader(container, {
                fileCount: backlinks.length,
                sortDescending: headerState.sortDescending,
                isCollapsed: headerState.isCollapsed,
                currentStrategy: headerState.currentStrategy,
                currentTheme: headerState.currentTheme,
                showFullPathTitle: headerState.showFullPathTitle,
                aliases: aliases,
                currentAlias: headerState.currentAlias,
                unsavedAliases: [],
                currentHeaderStyle: headerState.currentHeaderStyle,
                currentFilter: headerState.currentFilter,
                onSortToggle: () => this.handleSortToggle(),
                onCollapseToggle: () => this.handleCollapseToggle(),
                onStrategyChange: (strategy: string) => this.handleStrategyChange(strategy),
                onThemeChange: (theme: string) => this.handleThemeChange(theme),
                onFullPathTitleChange: (show: boolean) => this.handleFullPathTitleChange(show),
                onAliasSelect: (alias: string | null) => this.handleAliasSelection(alias),
                onHeaderStyleChange: (style: string) => this.handleHeaderStyleChange(style),
                onFilterChange: (filterText: string) => this.handleFilterChange(filterText),
                onSettingsClick: () => this.handleSettingsClick()
            });

            if (headerElement) {
                container.appendChild(headerElement);
            }

            // Create blocks container
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'backlinks-list';
            container.appendChild(blocksContainer);

            // Extract note name (basename without extension) for alias matching
            const file = this.app.vault.getAbstractFileByPath(currentNotePath);
            const currentNoteName = file && file instanceof TFile ? file.basename : currentNotePath.replace(/\.md$/, '').split('/').pop() || '';

            // Extract and render blocks
            this.logger.info('Extracting and rendering blocks', {
                currentNotePath,
                currentNoteName,
                backlinkCount: backlinks.length,
                viewId
            });
            
            await this.extractAndRenderBlocks(backlinks, currentNoteName, blocksContainer, view);
            
            this.logger.info('Blocks extraction and rendering completed', {
                currentNotePath,
                currentNoteName,
                backlinkCount: backlinks.length,
                viewId,
                blocksContainerChildren: blocksContainer.children.length
            });

            // Apply current alias filter after blocks are rendered
            const currentAlias = headerState.currentAlias;
            if (currentAlias !== null) {
                this.filterBlocksByAlias(currentNoteName, currentAlias);
            } else {
                // If no alias selected, ensure all blocks are visible
                const blocks = this.getCurrentBlocks(currentNoteName);
                this.blockRenderer.filterBlocksByAlias(blocks, null, currentNoteName);
            }

            // Apply current theme
            this.applyThemeToContainer(this.currentTheme);

            // CRITICAL: Check RIGHT BEFORE attaching if UI is already attached - this catches concurrent calls
            const existingContainersBeforeAttach = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
            if (existingContainersBeforeAttach.length > 0) {
                this.logger.error('ERROR: About to attach coalesce UI to a note that already has it! (detected right before attach)', {
                    currentNotePath,
                    viewId,
                    existingContainerCount: existingContainersBeforeAttach.length,
                    forceRefresh,
                    timestamp: Date.now(),
                    callStack: new Error().stack?.split('\n').slice(1, 8).join(' -> ')
                });
                // Remove existing containers to prevent duplicates
                existingContainersBeforeAttach.forEach(container => container.remove());
            }

            // Attach the container to the view (after the content)
            this.attachContainerToView(view, container);

            // Track the attachment
            this.attachedViews.set(viewId, {
                container,
                lastUpdate: Date.now()
            });

            // If backlinks were found, clear any pending retry
            if (backlinks.length > 0) {
                this.pendingRetries.delete(viewId);
            }

            this.logger.debug('Backlinks UI attached successfully (controller)', { 
                currentNotePath,
                backlinkCount: backlinks.length
            });
            return true;
        } finally {
            // Always remove from processing set, even if an error occurred
            this.processingViews.delete(viewId);
        }
    }

    /**
     * Apply options (sort/collapse/strategy/theme/alias/filter/headerStyle) to the current view.
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
    }): void {
        this.logger.debug('BacklinksViewController.setOptions', { options });

        const updatedState = this.headerController.updateStateFromOptions(options);

        this.renderOptions.collapsed = updatedState.isCollapsed;
        this.renderOptions.sortByPath = updatedState.sortByPath;
        this.renderOptions.sortDescending = updatedState.sortDescending;
        this.currentTheme = updatedState.currentTheme;

        if (options.headerStyle !== undefined) {
            this.renderOptions.headerStyle = updatedState.currentHeaderStyle;
            this.updateBlockTitleDisplay(updatedState.currentHeaderStyle);
        }

        this.applyCurrentOptions();
    }

    /**
     * Request focus when the view is ready.
     */
    requestFocusWhenReady(leafId: string): void {
        this.logger.debug('BacklinksViewController.requestFocusWhenReady', { leafId });

        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
            setTimeout(() => {
                this.logger.debug('BacklinksViewController focus requested (simplified)', { leafId });
            }, 100);
        }
    }

    /**
     * Remove UI attachment for a specific view.
     */
    removeAttachment(viewId: string): void {
        const attachment = this.attachedViews.get(viewId);
        if (attachment) {
            if (attachment.container.parentElement) {
                attachment.container.parentElement.removeChild(attachment.container);
            }
            this.attachedViews.delete(viewId);
            this.logger.debug('BacklinksViewController removed attachment for view', { viewId });
        }
    }

    /**
     * Cleanup view controller resources.
     */
    cleanup(): void {
        this.logger.debug('BacklinksViewController.cleanup');
        this.currentBlocks.clear();
        this.attachedViews.clear();
        this.processingViews.clear();
        this.headerController.reset();
    }

    // ===== Header methods =====

    private handleSortToggle(): void {
        this.logger.debug('BacklinksViewController.handleSortToggle');

        const newState = this.headerController.toggleSort();

        // Keep render options in sync with header state
        this.renderOptions.sortByPath = newState.sortByPath;
        this.renderOptions.sortDescending = newState.sortDescending;

        if (this.lastRenderContext) {
            this.applySortingToDOM(this.lastRenderContext.container, newState.sortDescending);
        }

        // Persist sort direction to settings via DOM custom event
        const event = new CustomEvent('coalesce-settings-sort-changed', {
            detail: {
                sortByPath: newState.sortByPath,
                descending: newState.sortDescending
            }
        });
        document.dispatchEvent(event);
    }

    private handleCollapseToggle(): void {
        this.logger.debug('BacklinksViewController.handleCollapseToggle');

        const newState = this.headerController.toggleCollapse();
        this.renderOptions.collapsed = newState.isCollapsed;

        this.setAllBlocksCollapsed(newState.isCollapsed);

        if (this.lastRenderContext) {
            this.applyCollapseStateToDOM(this.lastRenderContext.container, newState.isCollapsed);
        }

        const event = new CustomEvent('coalesce-settings-collapse-changed', {
            detail: { collapsed: newState.isCollapsed }
        });
        document.dispatchEvent(event);
    }

    private async handleStrategyChange(strategy: string): Promise<void> {
        this.logger.debug('BacklinksViewController.handleStrategyChange', { strategy });

        const newState = this.headerController.changeStrategy(strategy);
        this.strategyManager.setCurrentStrategy(newState.currentStrategy);

        if (this.lastRenderContext) {
            const { filePaths, currentNoteName, container, view } = this.lastRenderContext;
            await this.extractAndRenderBlocks(filePaths, currentNoteName, container, view);
        }
    }

    private handleThemeChange(theme: string): void {
        this.logger.debug('BacklinksViewController.handleThemeChange', { theme });

        const newState = this.headerController.changeTheme(theme);
        this.currentTheme = newState.currentTheme;

        this.applyThemeToContainer(newState.currentTheme);

        // Persist theme selection to settings via DOM custom event
        const event = new CustomEvent('coalesce-settings-theme-changed', {
            detail: { theme: newState.currentTheme }
        });
        document.dispatchEvent(event);
    }

    private handleHeaderStyleChange(style: string): void {
        this.logger.debug('BacklinksViewController.handleHeaderStyleChange', { style });

        const newState = this.headerController.changeHeaderStyle(style);
        this.renderOptions.headerStyle = newState.currentHeaderStyle;

        this.updateBlockTitleDisplay(newState.currentHeaderStyle);

        // Persist header style selection to settings via DOM custom event
        const event = new CustomEvent('coalesce-settings-header-style-changed', {
            detail: { headerStyle: newState.currentHeaderStyle }
        });
        document.dispatchEvent(event);
    }

    private handleAliasSelection(alias: string | null): void {
        this.logger.debug('BacklinksViewController.handleAliasSelection', { alias });

        const newState = this.headerController.selectAlias(alias);

        // Get current note name from last render context or extract from view
        let currentNoteName = this.lastRenderContext?.currentNoteName || '';
        if (!currentNoteName && this.lastRenderContext && this.lastRenderContext.filePaths.length > 0) {
            // Extract note name from the first file path (should be the current note)
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView?.file) {
                currentNoteName = activeView.file.basename;
            }
        }
        this.filterBlocksByAlias(currentNoteName, newState.currentAlias);
    }

    private handleFilterChange(filterText: string): void {
        this.logger.debug('BacklinksViewController.handleFilterChange', { filterText });

        const newState = this.headerController.changeFilter(filterText);

        this.filterBlocksByText('', newState.currentFilter);
    }

    private handleSettingsClick(): void {
        this.logger.debug('BacklinksViewController.handleSettingsClick');

        this.headerController.settingsClicked();
        this.logger.debug('Settings click handled (delegated elsewhere)');
    }

    private handleFullPathTitleChange(show: boolean): void {
        this.logger.debug('BacklinksViewController.handleFullPathTitleChange', { show });

        const newState = this.headerController.changeFullPathTitle(show);
        this.renderOptions.showFullPathTitle = newState.showFullPathTitle;
    }

    // ===== View / DOM helpers =====

    private attachContainerToView(view: MarkdownView, container: HTMLElement): void {
        this.logger.debug('BacklinksViewController.attachContainerToView', { filePath: view.file?.path });

        // FINAL CHECK: Right before DOM insertion, check if container already exists
        // This catches the case where two calls are racing and both pass earlier checks
        const existingContainers = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
        if (existingContainers.length > 0) {
            this.logger.error('ERROR: About to insert coalesce container but one already exists in DOM! (final check)', {
                filePath: view.file?.path,
                viewId: (view.leaf as any).id || 'unknown',
                existingContainerCount: existingContainers.length,
                callStack: new Error().stack?.split('\n').slice(1, 8).join(' -> ')
            });
            // Remove existing containers to prevent duplicates
            existingContainers.forEach(existing => existing.remove());
        }

        const markdownSection = view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
        if (markdownSection) {
            markdownSection.insertAdjacentElement('afterend', container);
            container.style.minHeight = '50px';
            container.style.display = 'block';
            container.style.visibility = 'visible';
        } else {
            this.logger.error('Could not find .markdown-preview-section for attachment');
        }
    }

    private async extractAndRenderBlocks(
        filePaths: string[],
        currentNoteName: string,
        container: HTMLElement,
        view?: MarkdownView
    ): Promise<void> {
        await this.performanceMonitor.measureAsync(
            'ui.blocks.extractAndRender',
            async () => {
                this.logger.debug('BacklinksViewController.extractAndRenderBlocks', {
                    filePathCount: filePaths.length,
                    currentNoteName
                });

                this.lastRenderContext = {
                    filePaths,
                    currentNoteName,
                    container,
                    view: view || (this.app.workspace.getActiveViewOfType(MarkdownView) as MarkdownView)
                };

                let allBlocks: BlockData[] = [];

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

                        blocks.forEach(block => {
                            block.sourcePath = filePath;
                        });

                        allBlocks.push(...blocks);
                    } else {
                        this.logger.warn('File not found or not TFile', {
                            filePath,
                            fileType: (file as any)?.constructor?.name
                        });
                    }
                }

                this.logger.debug('Total blocks extracted from all files', { totalBlocks: allBlocks.length });

                allBlocks.forEach(block => {
                    block.isCollapsed = this.renderOptions.collapsed;
                });

                this.currentBlocks.set(currentNoteName, allBlocks);
                
                this.logger.info('Blocks extracted', {
                    currentNoteName,
                    totalBlocks: allBlocks.length,
                    filePaths: filePaths
                });

                if (this.renderOptions.sortByPath) {
                    allBlocks = this.sortBlocks(allBlocks, {
                        by: 'path',
                        descending: this.renderOptions.sortDescending
                    });
                }

                this.logger.info('Rendering blocks to DOM', {
                    currentNoteName,
                    blockCount: allBlocks.length,
                    containerId: container.id || 'no-id'
                });
                
                await this.blockRenderer.renderBlocks(
                    container,
                    allBlocks,
                    this.renderOptions,
                    currentNoteName,
                    this.strategyManager.getCurrentStrategy(),
                    undefined,
                    this.lastRenderContext.view
                );
                
                this.logger.info('Blocks rendered to DOM', {
                    currentNoteName,
                    blockCount: allBlocks.length,
                    containerChildren: container.children.length
                });

                if (allBlocks.length === 0) {
                    this.logger.info('No blocks to render, adding no backlinks message', {
                        currentNoteName,
                        filePathCount: filePaths.length
                    });
                    this.addNoBacklinksMessage(container);
                }

                this.applyThemeToContainer(this.currentTheme);
            },
            {
                filePathCount: filePaths.length,
                currentNoteName
            }
        );
    }

    private applySortingToDOM(container: HTMLElement, descending: boolean): void {
        const linksContainer = container.classList.contains('backlinks-list')
            ? container
            : (container.querySelector('.backlinks-list') as HTMLElement);
        if (!linksContainer) return;

        const blockContainers = Array.from(
            linksContainer.querySelectorAll('.coalesce-backlink-item')
        );

        blockContainers.sort((a, b) => {
            const pathA = (a as HTMLElement).getAttribute('data-path') || '';
            const pathB = (b as HTMLElement).getAttribute('data-path') || '';
            const fileNameA = pathA.split('/').pop() || '';
            const fileNameB = pathB.split('/').pop() || '';
            const comparison = fileNameA.localeCompare(fileNameB);
            return descending ? -comparison : comparison;
        });

        blockContainers.forEach(block => {
            linksContainer.appendChild(block);
        });
    }

    private applyCollapseStateToDOM(container: HTMLElement, collapsed: boolean): void {
        let blockContainers: NodeListOf<Element> = container.querySelectorAll('.coalesce-backlink-item');

        if (blockContainers.length === 0) {
            const backlinksList =
                container.querySelector('.backlinks-list') ||
                document.querySelector('.backlinks-list');
            if (backlinksList) {
                blockContainers = backlinksList.querySelectorAll('.coalesce-backlink-item');
            }
        }

        blockContainers.forEach(blockContainer => {
            const blockElement = blockContainer as HTMLElement;

            if (collapsed) {
                blockElement.classList.add('is-collapsed');
            } else {
                blockElement.classList.remove('is-collapsed');
            }

            const toggleArrow = blockElement.querySelector(
                '.coalesce-toggle-arrow'
            ) as HTMLElement;
            if (toggleArrow) {
                toggleArrow.textContent = collapsed ? '▶' : '▼';
            }
        });
    }

    private applyThemeToContainer(theme: string): void {
        if (!this.lastRenderContext) return;
        const { container } = this.lastRenderContext;

        container.classList.forEach((className: string) => {
            if (className.startsWith('theme-')) {
                container.classList.remove(className);
            }
        });

        container.classList.add(`theme-${theme}`);
    }

    private updateBlockTitleDisplay(headerStyle: string): void {
        this.logger.debug('BacklinksViewController.updateBlockTitleDisplay', { headerStyle });
        this.renderOptions.headerStyle = headerStyle;
        this.blockRenderer.updateBlockTitleDisplay(headerStyle);
    }

    private filterBlocksByAlias(currentNoteName: string, alias: string | null): void {
        this.logger.debug('BacklinksViewController.filterBlocksByAlias', {
            currentNoteName,
            alias
        });

        const blocks = this.getCurrentBlocks(currentNoteName);
        // Pass the container from lastRenderContext if available, so filtering only affects the current view
        const targetContainer = this.lastRenderContext?.container;
        this.blockRenderer.filterBlocksByAlias(blocks, alias, currentNoteName, targetContainer);
    }

    private filterBlocksByText(currentNoteName: string, filterText: string): void {
        this.logger.debug('BacklinksViewController.filterBlocksByText', {
            currentNoteName,
            filterText
        });

        this.renderOptions.filterText = filterText;

        if (this.lastRenderContext) {
            const { container } = this.lastRenderContext;
            this.applyTextFilterToDOM(container, filterText);
        }
    }

    private applyTextFilterToDOM(container: HTMLElement, filterText: string): void {
        const blockContainers = container.querySelectorAll('.coalesce-backlink-item');

        blockContainers.forEach(blockContainer => {
            const blockElement = blockContainer as HTMLElement;
            const content = blockElement.textContent || '';
            const title =
                blockElement.querySelector('.coalesce-block-title')?.textContent || '';

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
    }

    private setAllBlocksCollapsed(collapsed: boolean): void {
        this.renderOptions.collapsed = collapsed;

        for (const blocks of this.currentBlocks.values()) {
            this.blockRenderer.updateBlockCollapsedState(blocks, collapsed);
        }
    }

    private sortBlocks(blocks: any[], sort: { by?: string; descending: boolean }): any[] {
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

        return sortedBlocks;
    }

    private getCurrentBlocks(currentNoteName: string): BlockData[] {
        return this.currentBlocks.get(currentNoteName) || [];
    }

    /**
     * Extract aliases from the current note's frontmatter
     */
    private extractAliasesFromNote(notePath: string): string[] {
        try {
            const file = this.app.vault.getAbstractFileByPath(notePath);
            if (!file || !(file instanceof TFile)) {
                this.logger.debug('File not found or not TFile', { notePath });
                return [];
            }

            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache || !cache.frontmatter) {
                this.logger.debug('No frontmatter found', { notePath });
                return [];
            }

            const aliases = cache.frontmatter.aliases;
            if (!aliases) {
                this.logger.debug('No aliases in frontmatter', { notePath });
                return [];
            }

            // Handle both array and single string aliases
            const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
            const validAliases = aliasArray.filter(
                (alias): alias is string => typeof alias === 'string' && alias.trim().length > 0
            );

            this.logger.debug('Aliases extracted from note', { notePath, aliases: validAliases });
            return validAliases;
        } catch (error) {
            this.logger.error('Failed to extract aliases from note', { notePath, error });
            return [];
        }
    }

    private addNoBacklinksMessage(container: HTMLElement): void {
        const messageElement = document.createElement('div');
        messageElement.className = 'coalesce-no-backlinks-message';
        messageElement.textContent = 'No backlinks found for this note.';
        container.appendChild(messageElement);
    }

    private applyCurrentOptions(): void {
        if (!this.lastRenderContext) return;
        const { container } = this.lastRenderContext;
        const headerState = this.headerController.getHeaderState();

        this.applyThemeToContainer(this.currentTheme);
        this.applyCollapseStateToDOM(container, headerState.isCollapsed);

        if (headerState.sortByPath) {
            this.applySortingToDOM(container, headerState.sortDescending);
        }

        if (headerState.currentFilter) {
            this.applyTextFilterToDOM(container, headerState.currentFilter);
        }
    }

    // ===== Block statistics helper (used by BacklinksSlice if needed) =====

    getBlockStatistics(): BlockStatistics {
        const extractorStats = (this.blockExtractor as any).getStatistics?.() || {
            totalBlocksExtracted: 0,
            totalExtractions: 0,
            lastExtractionTime: undefined
        };
        const rendererStats = this.blockRenderer.getStatistics();

        return {
            totalBlocksExtracted: extractorStats.totalBlocksExtracted || 0,
            totalBlocksRendered: rendererStats.totalBlocksRendered,
            blocksHidden: 0,
            blocksCollapsed: this.renderOptions.collapsed
                ? this.getCurrentBlocks('').length
                : 0,
            averageBlockSize:
                extractorStats.totalBlocksExtracted > 0
                    ? extractorStats.totalBlocksExtracted /
                      (extractorStats.totalExtractions || 1)
                    : 0,
            lastExtractionTime: extractorStats.lastExtractionTime,
            lastRenderTime: rendererStats.lastRenderTime
        };
    }

    getHeaderStatistics(): HeaderStatistics {
        return this.headerController.getStatistics();
    }

    getHeaderState(): HeaderState {
        return this.headerController.getHeaderState();
    }
}