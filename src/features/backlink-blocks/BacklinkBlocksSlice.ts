import { App, TFile, MarkdownView } from 'obsidian';
import { IBacklinkBlocksSlice } from '../shared-contracts/slice-interfaces';
import { BlockExtractor } from './BlockExtractor';
import { BlockRenderer } from './BlockRenderer';
import { StrategyManager } from './StrategyManager';
import { Logger } from '../shared-utilities/Logger';
import { BlockData, BlockRenderOptions, BlockStatistics, BlockFilterOptions } from './types';
import { CoalesceEvent, EventHandler, BlocksRenderedEvent } from '../shared-contracts/events';

/**
 * Backlink Blocks Slice Implementation
 * 
 * This slice handles block extraction, block display, and strategy management
 * for the vertical slice architecture.
 */
export class BacklinkBlocksSlice implements IBacklinkBlocksSlice {
    private app: App;
    private logger: Logger;
    private blockExtractor: BlockExtractor;
    private blockRenderer: BlockRenderer;
    private strategyManager: StrategyManager;
    private currentBlocks: Map<string, BlockData[]> = new Map();
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private renderOptions: BlockRenderOptions;
    // Persist context so header actions (e.g., Block strategy change) can re-render correctly
    private lastRenderContext?: { filePaths: string[]; currentNoteName: string; container: HTMLElement; view: MarkdownView };

    constructor(app: App, renderOptions?: Partial<BlockRenderOptions>, initialCollapsed: boolean = false) {
        this.app = app;
        this.logger = new Logger('BacklinkBlocksSlice');

        // Set default render options
        this.renderOptions = {
            headerStyle: 'full',
            hideBacklinkLine: false,
            hideFirstHeader: false,
            showFullPathTitle: false,
            collapsed: initialCollapsed,
            sortByPath: false,
            sortDescending: true,
            ...renderOptions
        };
        
        // Initialize components
        this.blockExtractor = new BlockExtractor(app, this.logger);
        this.blockRenderer = new BlockRenderer(app, this.logger);
        this.strategyManager = new StrategyManager(this.logger, 'default');
        
        this.logger.debug('BacklinkBlocksSlice initialized', { renderOptions: this.renderOptions });
    }

    /**
     * Extract and render blocks from files
     */
    async extractAndRenderBlocks(
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
            // Persist context for future re-renders (e.g., strategy changes from header)
            this.lastRenderContext = {
                filePaths,
                currentNoteName,
                container,
                view: view || (this.app.workspace.getActiveViewOfType(MarkdownView) as MarkdownView)
            };

            const allBlocks: BlockData[] = [];
            
            // Extract blocks from each file
            for (const filePath of filePaths) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file && file instanceof TFile) {
                    const content = await this.app.vault.read(file);
                    const blocks = await this.blockExtractor.extractBlocks(
                        content, 
                        currentNoteName, 
                        this.strategyManager.getCurrentStrategy()
                    );
                    
                    // Set source path for each block
                    blocks.forEach(block => {
                        block.sourcePath = filePath;
                    });
                    
                    allBlocks.push(...blocks);
                }
            }
            
            // Set initial collapsed state for all blocks based on global render options
            allBlocks.forEach(block => {
                block.isCollapsed = this.renderOptions.collapsed;
            });

            // Store current blocks
            this.currentBlocks.set(currentNoteName, allBlocks);

            // Sort blocks if requested
            if (this.renderOptions.sortByPath) {
                this.sortBlocks(allBlocks, { by: 'path', descending: this.renderOptions.sortDescending });
            }
            
            // Render blocks
            await this.blockRenderer.renderBlocks(
                container,
                allBlocks,
                this.renderOptions,
                currentNoteName, // Pass the current note name
                this.strategyManager.getCurrentStrategy(), // Pass the current strategy
                undefined, // headingPopupComponent - can be added later if needed
                this.lastRenderContext.view
            );
            
            // Emit event
            this.emitEvent({
                type: 'blocks:rendered',
                payload: {
                    count: allBlocks.length,
                    leafId: currentNoteName
                }
            });
            
            this.logger.debug('Blocks extracted and rendered successfully', { 
                blockCount: allBlocks.length,
                currentNoteName 
            });
        } catch (error) {
            this.logger.error('Failed to extract and render blocks', { filePaths, currentNoteName, error });
        }
    }

    /**
     * Update blocks for a file
     */
    async updateBlocks(
        filePaths: string[],
        currentNoteName: string,
        container: HTMLElement,
        view?: MarkdownView
    ): Promise<void> {
        this.logger.debug('Updating blocks', {
            filePathCount: filePaths.length,
            currentNoteName
        });
        
        try {
            // Clear existing blocks
            this.blockRenderer.clearRenderedBlocks(container);
            
            // Extract and render new blocks
            await this.extractAndRenderBlocks(filePaths, currentNoteName, container, view);
            
            this.logger.debug('Blocks updated successfully', { currentNoteName });
        } catch (error) {
            this.logger.error('Failed to update blocks', { filePaths, currentNoteName, error });
        }
    }

    /**
     * Get current blocks for a note
     */
    getCurrentBlocks(currentNoteName: string): BlockData[] {
        this.logger.debug('Getting current blocks', { currentNoteName });
        
        try {
            const blocks = this.currentBlocks.get(currentNoteName) || [];
            
            this.logger.debug('Current blocks retrieved', { 
                currentNoteName, 
                blockCount: blocks.length 
            });
            
            return blocks;
        } catch (error) {
            this.logger.error('Failed to get current blocks', { currentNoteName, error });
            return [];
        }
    }

    /**
     * Filter blocks by text
     */
    filterBlocksByText(currentNoteName: string, filterText: string): void {
        this.logger.debug('Filtering blocks by text', { currentNoteName, filterText });

        try {
            // Update the current filter in render options
            this.renderOptions.filterText = filterText;

            // If we have a render context, apply filtering to DOM elements
            if (this.lastRenderContext) {
                const { container } = this.lastRenderContext;
                this.applyTextFilterToDOM(container, filterText);
            }

            this.logger.debug('Blocks filtered by text successfully', { currentNoteName, filterText });
        } catch (error) {
            this.logger.error('Failed to filter blocks by text', { currentNoteName, filterText, error });
        }
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
     * Apply collapse state to DOM elements
     */
    private applyCollapseStateToDOM(container: HTMLElement, collapsed: boolean): void {
        // Try multiple selectors to find all block containers
        let blockContainers: NodeListOf<Element>;

        // First try within the specific container
        blockContainers = container.querySelectorAll('.coalesce-backlink-item');

        // If no blocks found in the specific container, try broader search
        if (blockContainers.length === 0) {
            // Try finding backlinks-list container first
            const backlinksList = container.querySelector('.backlinks-list') || document.querySelector('.backlinks-list');
            if (backlinksList) {
                blockContainers = backlinksList.querySelectorAll('.coalesce-backlink-item');
            }

            // If still no blocks, search the entire document
            if (blockContainers.length === 0) {
                blockContainers = document.querySelectorAll('.coalesce-backlink-item');
            }
        }

        blockContainers.forEach((blockContainer) => {
            const blockElement = blockContainer as HTMLElement;

            // Update the collapsed class on the container
            if (collapsed) {
                blockElement.classList.add('is-collapsed');
            } else {
                blockElement.classList.remove('is-collapsed');
            }

            // Update the toggle arrow icon
            const toggleArrow = blockElement.querySelector('.coalesce-toggle-arrow') as HTMLElement;
            if (toggleArrow) {
                toggleArrow.textContent = collapsed ? '▶' : '▼';
            }
        });

        this.logger.debug('Applied collapse state to DOM', {
            collapsed,
            totalBlocks: blockContainers.length,
            containerFound: !!container
        });
    }

    /**
     * Filter blocks by alias
     */
    filterBlocksByAlias(currentNoteName: string, alias: string | null): void {
        this.logger.debug('Filtering blocks by alias', { currentNoteName, alias });

        try {
            const blocks = this.getCurrentBlocks(currentNoteName);
            this.blockRenderer.filterBlocksByAlias(blocks, alias, currentNoteName);

            this.logger.debug('Blocks filtered by alias successfully', {
                currentNoteName,
                alias,
                blockCount: blocks.length
            });
        } catch (error) {
            this.logger.error('Failed to filter blocks by alias', { currentNoteName, alias, error });
        }
    }

    /**
     * Toggle block collapsed state
     */
    toggleBlockCollapsedState(currentNoteName: string): void {
        this.logger.debug('Toggling block collapsed state', { currentNoteName });
        
        try {
            const blocks = this.getCurrentBlocks(currentNoteName);
            const newCollapsedState = !this.renderOptions.collapsed;
            
            // Update render options
            this.renderOptions.collapsed = newCollapsedState;
            
            // Update block renderer
            this.blockRenderer.updateBlockCollapsedState(blocks, newCollapsedState);
            
            this.logger.debug('Block collapsed state toggled successfully', { 
                currentNoteName, 
                collapsed: newCollapsedState 
            });
        } catch (error) {
            this.logger.error('Failed to toggle block collapsed state', { currentNoteName, error });
        }
    }

    /**
     * Update block strategy
     */
    async updateBlockStrategy(strategy: string, currentNoteName: string, container: HTMLElement): Promise<void> {
        this.logger.debug('Updating block strategy', { strategy, currentNoteName });
        
        try {
            // Set new strategy
            this.strategyManager.setCurrentStrategy(strategy);
            
            // Re-extract and render blocks with new strategy
            const currentBlocks = this.getCurrentBlocks(currentNoteName);
            const filePaths = [...new Set(currentBlocks.map(block => block.sourcePath))];
            
            await this.extractAndRenderBlocks(filePaths, currentNoteName, container, (this.lastRenderContext as any)?.view);
            
            this.logger.debug('Block strategy updated successfully', { 
                strategy, 
                currentNoteName 
            });
        } catch (error) {
            this.logger.error('Failed to update block strategy', { strategy, currentNoteName, error });
        }
    }

    /**
     * Handle filter change event from BacklinksHeader slice
     */
    public handleFilterChange(payload: { text: string }): void {
        const filterText = payload?.text || '';
        this.logger.debug('Handling filter change', { filterText });

        try {
            // Apply filter to blocks
            this.filterBlocksByText('', filterText); // Note: currentNoteName is not needed for filtering
            this.logger.debug('Filter applied successfully', { filterText });
        } catch (error) {
            this.logger.error('Failed to handle filter change', { filterText, error });
        }
    }

    /**
     * Handle alias selection event from BacklinksHeader slice
     */
    public handleAliasSelection(payload: { alias: string | null }): void {
        const alias = payload?.alias;
        this.logger.debug('Handling alias selection', { alias });

        try {
            // Use the last render context to get the current note name
            const currentNoteName = this.lastRenderContext?.currentNoteName || '';
            this.filterBlocksByAlias(currentNoteName, alias);
            this.logger.debug('Alias selection handled successfully', { alias, currentNoteName });
        } catch (error) {
            this.logger.error('Failed to handle alias selection', { alias, error });
        }
    }

    /**
     * Handle sort toggle event from BacklinksHeader slice
     */
    public handleSortToggle(payload: { sortByPath: boolean; descending: boolean }): void {
        const sortByPath = payload?.sortByPath || false;
        const descending = payload?.descending || false;
        this.logger.debug('Handling sort toggle', { sortByPath, descending });

        try {
            // Update render options
            this.renderOptions.sortByPath = sortByPath;
            this.renderOptions.sortDescending = descending;

            // Apply sorting to DOM if we have a render context and sorting is enabled
            if (this.lastRenderContext && sortByPath) {
                const { container } = this.lastRenderContext;
                this.applySortingToDOM(container, descending);
            }
            // When sortByPath is false, we leave the blocks in their current order (no re-rendering)

            this.logger.debug('Sort toggle handled successfully', { sortByPath, descending });
        } catch (error) {
            this.logger.error('Failed to handle sort toggle', { sortByPath, descending, error });
        }
    }

    /**
     * Apply sorting to DOM elements
     */
    private applySortingToDOM(container: HTMLElement, descending: boolean): void {
        // The container might be the backlinks-list itself or contain it
        const linksContainer = container.classList.contains('backlinks-list') ? container : container.querySelector('.backlinks-list');
        if (!linksContainer) return;

        const blockContainers = Array.from(linksContainer.querySelectorAll('.coalesce-backlink-item'));

        // Sort blocks by their file path (stored in data-path attribute)
        blockContainers.sort((a, b) => {
            const pathA = (a as HTMLElement).getAttribute('data-path') || '';
            const pathB = (b as HTMLElement).getAttribute('data-path') || '';

            const comparison = pathA.localeCompare(pathB);
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
     * Handle collapse toggle event from BacklinksHeader slice
     */
    public handleCollapseToggle(payload: { collapsed: boolean }): void {
        const collapsed = payload?.collapsed || false;
        this.logger.debug('Handling collapse toggle', { collapsed });

        try {
            // Update render options
            this.renderOptions.collapsed = collapsed;

            // Apply collapse state to all current blocks
            this.setAllBlocksCollapsed(collapsed);

            // Also apply collapse state to DOM elements directly
            if (this.lastRenderContext) {
                const { container } = this.lastRenderContext;
                this.applyCollapseStateToDOM(container, collapsed);
            }

            this.logger.debug('Collapse toggle handled successfully', { collapsed });
        } catch (error) {
            this.logger.error('Failed to handle collapse toggle', { collapsed, error });
        }
    }

    /**
     * Handle strategy change event from BacklinksHeader slice
     * Re-extracts and re-renders using the newly selected strategy.
     */
    public async handleStrategyChange(payload: { strategyId: string }): Promise<void> {
        const strategy = payload?.strategyId || 'default';
        this.logger.debug('Handling strategy change', { strategy });

        try {
            // Set the new strategy
            this.strategyManager.setCurrentStrategy(strategy);

            // Re-render using the last known render context
            if (this.lastRenderContext) {
                const { filePaths, currentNoteName, container, view } = this.lastRenderContext as any;
                await this.extractAndRenderBlocks(filePaths, currentNoteName, container, view);
                this.logger.debug('Re-rendered blocks after strategy change', {
                    strategy,
                    fileCount: filePaths.length,
                    currentNoteName
                });
            } else {
                this.logger.debug('No render context available yet; strategy stored for next render', { strategy });
            }
        } catch (error) {
            this.logger.error('Failed to handle strategy change', { strategy, error });
        }
    }

    /**
     * Update block title display
     */
    updateBlockTitleDisplay(headerStyle: string): void {
        this.logger.debug('Updating block title display', { headerStyle });
        
        try {
            // Update render options
            this.renderOptions.headerStyle = headerStyle;
            
            // Update block renderer
            this.blockRenderer.updateBlockTitleDisplay(headerStyle);
            
            this.logger.debug('Block title display updated successfully', { headerStyle });
        } catch (error) {
            this.logger.error('Failed to update block title display', { headerStyle, error });
        }
    }

    /**
     * Get block extractor
     */
    getBlockExtractor(): BlockExtractor {
        return this.blockExtractor;
    }

    /**
     * Get block renderer
     */
    getBlockRenderer(): BlockRenderer {
        return this.blockRenderer;
    }

    /**
     * Get strategy manager
     */
    getStrategyManager(): StrategyManager {
        return this.strategyManager;
    }

    /**
     * Get statistics
     */
    getStatistics(): BlockStatistics {
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
     * Update render options
     */
    updateRenderOptions(options: Partial<BlockRenderOptions>): void {
        this.logger.debug('Updating render options', { options });
        
        this.renderOptions = { ...this.renderOptions, ...options };
        
        this.logger.debug('Render options updated successfully', { options: this.renderOptions });
    }

    /**
     * Get current render options
     */
    getRenderOptions(): BlockRenderOptions {
        return { ...this.renderOptions };
    }

    /**
     * Sort blocks
     */
    sortBlocks(blocks: any[], sort: { by?: string; descending: boolean }): any[] {
        this.logger.debug('Sorting blocks', { blockCount: blocks.length, sort });
        
        const sortedBlocks = [...blocks].sort((a, b) => {
            let comparison = 0;
            
            switch (sort.by) {
                case 'path':
                    comparison = a.sourcePath?.localeCompare(b.sourcePath) || 0;
                    break;
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
     * Extract blocks (alias for blockExtractor.extractBlocks)
     */
    async extractBlocks(files: string[], noteName: string): Promise<Array<{ content: string; filePath: string; blockId: string }>> {
        const result: Array<{ content: string; filePath: string; blockId: string }> = [];
        
        for (const filePath of files) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const blocks = await this.blockExtractor.extractBlocks(
                    content,
                    noteName,
                    this.strategyManager.getCurrentStrategy()
                );
                
                for (const block of blocks) {
                    result.push({
                        content: block.content,
                        filePath: block.sourcePath,
                        blockId: block.id
                    });
                }
            }
        }
        
        return result;
    }

    /**
     * Render blocks (alias for blockRenderer.renderBlocks)
     */
    async renderBlocks(blocks: any[], container: HTMLElement, options: any): Promise<void> {
        return this.blockRenderer.renderBlocks(container, blocks, options);
    }

    /**
     * Filter blocks
     */
    filterBlocks(blocks: any[], filter: any): any[] {
        // Apply filtering logic
        return blocks.filter(block => {
            // Basic filtering implementation
            if (filter.text && !block.content.toLowerCase().includes(filter.text.toLowerCase())) {
                return false;
            }
            if (filter.alias && !block.content.includes(filter.alias)) {
                return false;
            }
            return true;
        });
    }

    /**
     * Set all blocks collapsed state
     */
    setAllBlocksCollapsed(collapsed: boolean): void {
        this.renderOptions.collapsed = collapsed;
        
        // Update all current blocks
        for (const blocks of this.currentBlocks.values()) {
            this.blockRenderer.updateBlockCollapsedState(blocks, collapsed);
        }
    }

    /**
     * Get block statistics
     */
    getBlockStatistics(): any {
        return this.getStatistics();
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
     * Cleanup resources used by this slice
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinkBlocksSlice');
        
        try {
            // Cleanup components
            this.blockExtractor.cleanup();
            this.blockRenderer.cleanup();
            this.strategyManager.cleanup();
            
            // Clear data
            this.currentBlocks.clear();
            this.eventHandlers.clear();
            
            this.logger.debug('BacklinkBlocksSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BacklinkBlocksSlice', { error });
        }
    }
}

// Export the interface for external use
export type { IBacklinkBlocksSlice } from '../shared-contracts/slice-interfaces';