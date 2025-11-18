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

    private currentHeaders: Map<string, HTMLElement> = new Map();
    private headerStatistics: HeaderStatistics;
    private currentHeaderState: HeaderState;

    private attachedViews: Map<string, { container: HTMLElement; lastUpdate: number }> = new Map();

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

        // Initial header state mirrors BacklinksSlice defaults
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

        this.renderOptions.collapsed = this.currentHeaderState.isCollapsed;

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

        this.performanceMonitor = new PerformanceMonitor(
            this.logger.child('Performance'),
            () => Logger.getGlobalLogging().enabled
        );

        this.logger.debug('BacklinksViewController initialized');
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

        this.logger.debug('BacklinksViewController.attachToDOM', {
            currentNotePath,
            viewId,
            forceRefresh
        });

        // Check if UI is already attached and recent (within last 5 seconds), unless force refresh is requested
        const existingAttachment = this.attachedViews.get(viewId);
        if (!forceRefresh && existingAttachment && Date.now() - existingAttachment.lastUpdate < 5000) {
            this.logger.debug('UI already attached recently, skipping', { viewId, currentNotePath });
            return false;
        }

        // Clear any existing coalesce containers from the view
        const existingContainers = view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
        existingContainers.forEach(container => container.remove());

        // Get backlinks for the current note via core
        const backlinks = await this.core.updateBacklinks(currentNotePath, viewId);

        if (backlinks.length === 0) {
            this.logger.debug('No backlinks found, will render UI with no backlinks message', {
                currentNotePath
            });
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
            aliases: [],
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

        this.logger.debug('Backlinks UI attached successfully (controller)', { currentNotePath });
        return true;
    }

    /**
     * Apply options (sort/collapse/strategy/theme/alias/filter) to the current view.
     */
    setOptions(options: {
        sort?: boolean;
        collapsed?: boolean;
        strategy?: string;
        theme?: string;
        alias?: string | null;
        filter?: string;
    }): void {
        this.logger.debug('BacklinksViewController.setOptions', { options });

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
        this.currentHeaders.clear();
        this.attachedViews.clear();
    }

    // ===== Header methods =====

    private createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement {
        this.logger.debug('BacklinksViewController.createHeader', { options });

        const header = this.headerUI.createHeader(container, options);
        const headerId = this.generateHeaderId(container);
        this.currentHeaders.set(headerId, header);

        this.updateCurrentHeaderState(options);
        this.headerStatistics.totalHeadersCreated++;

        return header;
    }

    private handleSortToggle(): void {
        this.logger.debug('BacklinksViewController.handleSortToggle');

        this.headerStatistics.totalSortToggles++;
        this.currentHeaderState.sortDescending = !this.currentHeaderState.sortDescending;
        this.currentHeaderState.sortByPath = true;

        if (this.lastRenderContext) {
            this.applySortingToDOM(this.lastRenderContext.container, this.currentHeaderState.sortDescending);
        }
    }

    private handleCollapseToggle(): void {
        this.logger.debug('BacklinksViewController.handleCollapseToggle');

        this.headerStatistics.totalCollapseToggles++;
        this.currentHeaderState.isCollapsed = !this.currentHeaderState.isCollapsed;
        this.renderOptions.collapsed = this.currentHeaderState.isCollapsed;

        this.setAllBlocksCollapsed(this.currentHeaderState.isCollapsed);

        if (this.lastRenderContext) {
            this.applyCollapseStateToDOM(this.lastRenderContext.container, this.currentHeaderState.isCollapsed);
        }

        const event = new CustomEvent('coalesce-settings-collapse-changed', {
            detail: { collapsed: this.currentHeaderState.isCollapsed }
        });
        document.dispatchEvent(event);
    }

    private async handleStrategyChange(strategy: string): Promise<void> {
        this.logger.debug('BacklinksViewController.handleStrategyChange', { strategy });

        this.headerStatistics.totalStrategyChanges++;
        this.currentHeaderState.currentStrategy = strategy;
        this.strategyManager.setCurrentStrategy(strategy);

        if (this.lastRenderContext) {
            const { filePaths, currentNoteName, container, view } = this.lastRenderContext;
            await this.extractAndRenderBlocks(filePaths, currentNoteName, container, view);
        }
    }

    private handleThemeChange(theme: string): void {
        this.logger.debug('BacklinksViewController.handleThemeChange', { theme });

        this.headerStatistics.totalThemeChanges++;
        this.currentHeaderState.currentTheme = theme;
        this.currentTheme = theme;

        this.applyThemeToContainer(theme);
    }

    private handleHeaderStyleChange(style: string): void {
        this.logger.debug('BacklinksViewController.handleHeaderStyleChange', { style });

        this.headerStatistics.totalHeaderStyleChanges++;
        this.currentHeaderState.currentHeaderStyle = style;
        this.renderOptions.headerStyle = style;

        this.updateBlockTitleDisplay(style);
    }

    private handleAliasSelection(alias: string | null): void {
        this.logger.debug('BacklinksViewController.handleAliasSelection', { alias });

        this.headerStatistics.totalAliasSelections++;
        this.currentHeaderState.currentAlias = alias;

        const currentNoteName = this.lastRenderContext?.currentNoteName || '';
        this.filterBlocksByAlias(currentNoteName, alias);
    }

    private handleFilterChange(filterText: string): void {
        this.logger.debug('BacklinksViewController.handleFilterChange', { filterText });

        this.headerStatistics.totalFilterChanges++;
        this.currentHeaderState.currentFilter = filterText;

        this.filterBlocksByText('', filterText);
    }

    private handleSettingsClick(): void {
        this.logger.debug('BacklinksViewController.handleSettingsClick');

        this.headerStatistics.totalSettingsClicks++;
        this.logger.debug('Settings click handled (delegated elsewhere)');
    }

    private updateHeaderState(state: Partial<HeaderState>): void {
        this.logger.debug('BacklinksViewController.updateHeaderState', { state });
        this.currentHeaderState = { ...this.currentHeaderState, ...state };
    }

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

    private generateHeaderId(container: HTMLElement): string {
        return `header-${container.id || 'unknown'}-${Date.now()}`;
    }

    // ===== View / DOM helpers =====

    private attachContainerToView(view: MarkdownView, container: HTMLElement): void {
        this.logger.debug('BacklinksViewController.attachContainerToView', { filePath: view.file?.path });

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

                if (this.renderOptions.sortByPath) {
                    allBlocks = this.sortBlocks(allBlocks, {
                        by: 'path',
                        descending: this.renderOptions.sortDescending
                    });
                }

                await this.blockRenderer.renderBlocks(
                    container,
                    allBlocks,
                    this.renderOptions,
                    currentNoteName,
                    this.strategyManager.getCurrentStrategy(),
                    undefined,
                    this.lastRenderContext.view
                );

                if (allBlocks.length === 0) {
                    this.logger.debug('No blocks to render, adding no backlinks message');
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
        this.blockRenderer.filterBlocksByAlias(blocks, alias, currentNoteName);
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

    private addNoBacklinksMessage(container: HTMLElement): void {
        const messageElement = document.createElement('div');
        messageElement.className = 'coalesce-no-backlinks-message';
        messageElement.textContent = 'No backlinks found for this note.';
        container.appendChild(messageElement);
    }

    private applyCurrentOptions(): void {
        if (!this.lastRenderContext) return;
        const { container } = this.lastRenderContext;

        this.applyThemeToContainer(this.currentTheme);
        this.applyCollapseStateToDOM(container, this.currentHeaderState.isCollapsed);

        if (this.currentHeaderState.sortByPath) {
            this.applySortingToDOM(container, this.currentHeaderState.sortDescending);
        }

        if (this.currentHeaderState.currentFilter) {
            this.applyTextFilterToDOM(container, this.currentHeaderState.currentFilter);
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
        return { ...this.headerStatistics };
    }

    getHeaderState(): HeaderState {
        return { ...this.currentHeaderState };
    }
}