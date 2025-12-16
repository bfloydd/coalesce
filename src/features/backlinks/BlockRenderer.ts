import { App, MarkdownView } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IBlockRenderer, BlockData, BlockRenderOptions, BlockRenderResult } from './types';
import { BlockComponent } from './BlockComponent';

import { HeaderStyleManager } from './header-styles/HeaderStyleManager';

/**
 * Block Renderer for Backlink Blocks Slice
 * 
 * Handles rendering of blocks to DOM with appropriate styling
 * for the vertical slice architecture.
 */
export class BlockRenderer implements IBlockRenderer {
    private app: App;
    private logger: Logger;
    private renderedBlocks: Map<string, BlockComponent> = new Map();
    // Map to track which blocks belong to which container (for multi-view support)
    private containerBlocks: Map<HTMLElement, Set<string>> = new Map();
    private statistics = {
        totalBlocksRendered: 0,
        totalRenders: 0,
        averageRenderTime: 0,
        lastRenderTime: new Date()
    };

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('BlockRenderer');
        
        this.logger.debug('BlockRenderer initialized');
    }

    /**
     * Render blocks to DOM container
     */
    async renderBlocks(
        container: HTMLElement,
        blocks: BlockData[],
        options: BlockRenderOptions,
        currentNoteName?: string,
        blockBoundaryStrategy?: string,
        headingPopupComponent?: any,
        view?: MarkdownView
    ): Promise<void> {
        this.logger.debug('Rendering blocks', { blockCount: blocks.length, options });

        const startTime = Date.now();

        try {
            // Clear existing blocks
            this.clearRenderedBlocks(container);

            // Render each block
            for (const blockData of blocks) {
                await this.renderSingleBlock(
                    container,
                    blockData,
                    options,
                    currentNoteName,
                    blockBoundaryStrategy,
                    headingPopupComponent,
                    view
                );
            }
            
            // Update statistics
            const renderTime = Date.now() - startTime;
            this.updateStatistics(blocks.length, renderTime);
            
            this.logger.debug('Blocks rendered successfully', { 
                blockCount: blocks.length, 
                renderTime 
            });
        } catch (error) {
            this.logger.error('Failed to render blocks', { blockCount: blocks.length, error });
        }
    }

    /**
     * Update block visibility
     */
    updateBlockVisibility(blocks: BlockData[], visible: boolean): void {
        this.logger.debug('Updating block visibility', { blockCount: blocks.length, visible });
        
        try {
            for (const blockData of blocks) {
                const blockComponent = this.renderedBlocks.get(blockData.id);
                if (blockComponent) {
                    const container = blockComponent.getContainer();
                    if (container) {
                        if (visible) {
                            container.classList.remove('hidden');
                            container.classList.add('visible');
                        } else {
                            container.classList.remove('visible');
                            container.classList.add('hidden');
                        }
                        
                        // Update block data
                        blockData.isVisible = visible;
                    }
                }
            }
            
            this.logger.debug('Block visibility updated successfully', { 
                blockCount: blocks.length, 
                visible 
            });
        } catch (error) {
            this.logger.error('Failed to update block visibility', { blocks, visible, error });
        }
    }

    /**
     * Update block collapsed state
     */
    updateBlockCollapsedState(blocks: BlockData[], collapsed: boolean): void {
        this.logger.debug('Updating block collapsed state', { blockCount: blocks.length, collapsed });
        
        try {
            for (const blockData of blocks) {
                const blockComponent = this.renderedBlocks.get(blockData.id);
                if (blockComponent) {
                    // Use the block component's setCollapsed method
                    blockComponent.setCollapsed(collapsed);
                    
                    // Update block data
                    blockData.isCollapsed = collapsed;
                }
            }
            
            this.logger.debug('Block collapsed state updated successfully', { 
                blockCount: blocks.length, 
                collapsed 
            });
        } catch (error) {
            this.logger.error('Failed to update block collapsed state', { blocks, collapsed, error });
        }
    }

    /**
     * Get a unique ID for a container
     */
    private getContainerId(container: HTMLElement): string {
        // Try to use an existing ID
        if (container.id) {
            return container.id;
        }
        
        // Generate a unique ID based on container's position or create one
        // Use a combination of class names and a simple hash
        const classes = Array.from(container.classList).join('-');
        const hash = container.getBoundingClientRect().top + container.getBoundingClientRect().left;
        return `${classes}-${hash}`.replace(/[^a-zA-Z0-9-]/g, '');
    }

    /**
     * Clear rendered blocks for a specific container only
     */
    clearRenderedBlocks(container: HTMLElement): void {
        this.logger.debug('Clearing rendered blocks for container');
        
        try {
            // Get blocks for this container
            const containerBlockIds = this.containerBlocks.get(container);
            const blocksToRemove: string[] = [];
            
            if (containerBlockIds) {
                // Remove blocks that belong to this container
                for (const blockId of containerBlockIds) {
                    const blockComponent = this.renderedBlocks.get(blockId);
                    if (blockComponent) {
                        const blockContainer = blockComponent.getContainer();
                        if (blockContainer && blockContainer.parentElement) {
                            blockContainer.parentElement.removeChild(blockContainer);
                        }
                        blocksToRemove.push(blockId);
                    }
                }
                
                // Remove blocks from the map
                for (const blockId of blocksToRemove) {
                    this.renderedBlocks.delete(blockId);
                }
                
                // Remove container tracking
                this.containerBlocks.delete(container);
            } else {
                // Fallback: find blocks by checking if they're in the container
                for (const [blockId, blockComponent] of this.renderedBlocks.entries()) {
                    const blockContainer = blockComponent.getContainer();
                    if (blockContainer && container.contains(blockContainer)) {
                        if (blockContainer.parentElement) {
                            blockContainer.parentElement.removeChild(blockContainer);
                        }
                        blocksToRemove.push(blockId);
                    }
                }
                
                for (const blockId of blocksToRemove) {
                    this.renderedBlocks.delete(blockId);
                }
            }
            
            // Clear container
            container.empty();
            
            this.logger.debug('Rendered blocks cleared successfully', {
                blocksRemoved: blocksToRemove.length,
                totalBlocksRemaining: this.renderedBlocks.size
            });
        } catch (error) {
            this.logger.error('Failed to clear rendered blocks', { error });
        }
    }

    /**
     * Get rendered block component
     */
    getRenderedBlock(blockId: string): BlockComponent | undefined {
        return this.renderedBlocks.get(blockId);
    }

    /**
     * Get all rendered blocks
     */
    getAllRenderedBlocks(): Map<string, BlockComponent> {
        return new Map(this.renderedBlocks);
    }

    /**
     * Update block title display
     */
    updateBlockTitleDisplay(style: string): void {
        this.logger.debug('Updating block title display', { style });
        
        try {
            for (const blockComponent of this.renderedBlocks.values()) {
                blockComponent.updateTitleDisplay(style);
            }
            
            this.logger.debug('Block title display updated successfully', { style });
        } catch (error) {
            this.logger.error('Failed to update block title display', { style, error });
        }
    }

    /**
     * Filter blocks by text
     */
    filterBlocksByText(blocks: BlockData[], filterText: string): void {
        this.logger.debug('Filtering blocks by text', { blockCount: blocks.length, filterText });
        
        try {
            const filterLower = filterText.toLowerCase();
            
            for (const blockData of blocks) {
                const blockComponent = this.renderedBlocks.get(blockData.id);
                if (blockComponent) {
                    const container = blockComponent.getContainer();
                    if (container) {
                        const contentMatch = blockData.content.toLowerCase().includes(filterLower);
                        const titleMatch = blockComponent.getTitle().toLowerCase().includes(filterLower);
                        const matchesFilter = contentMatch || titleMatch;
                        
                        if (matchesFilter) {
                            container.classList.remove('no-alias');
                            container.classList.add('has-alias');
                        } else {
                            container.classList.remove('has-alias');
                            container.classList.add('no-alias');
                        }
                    }
                }
            }
            
            this.logger.debug('Blocks filtered by text successfully', { 
                blockCount: blocks.length, 
                filterText 
            });
        } catch (error) {
            this.logger.error('Failed to filter blocks by text', { blocks, filterText, error });
        }
    }

    /**
     * Filter blocks by alias
     */
    filterBlocksByAlias(blocks: BlockData[], alias: string | null, currentNoteName: string, targetContainer?: HTMLElement): void {
        this.logger.debug('Filtering blocks by alias', { blockCount: blocks.length, alias, currentNoteName, hasTargetContainer: !!targetContainer });

        try {
            // If target container is specified, only filter blocks in that container
            // Otherwise, filter blocks in all containers (for backward compatibility)
            const containersToProcess = targetContainer 
                ? [targetContainer]
                : Array.from(this.containerBlocks.keys());

            for (const container of containersToProcess) {
                const containerBlockIds = this.containerBlocks.get(container);
                if (!containerBlockIds) continue;

                for (const blockId of containerBlockIds) {
                    const blockComponent = this.renderedBlocks.get(blockId);
                    if (!blockComponent) continue;

                    // Extract original block ID from the unique ID
                    const originalBlockId = blockId.split('-').slice(0, -1).join('-');
                    const blockData = blocks.find(b => b.id === originalBlockId);
                    if (!blockData) continue;

                    const blockContainer = blockComponent.getContainer();
                    if (blockContainer) {
                        const hasAlias = alias ? this.blockContainsAlias(blockData, alias, currentNoteName) : true;

                        if (hasAlias) {
                            blockContainer.classList.remove('no-alias');
                            blockContainer.classList.add('has-alias');
                        } else {
                            blockContainer.classList.remove('has-alias');
                            blockContainer.classList.add('no-alias');
                        }
                    }
                }
            }

            this.logger.debug('Blocks filtered by alias successfully', {
                blockCount: blocks.length,
                alias,
                currentNoteName
            });
        } catch (error) {
            this.logger.error('Failed to filter blocks by alias', { blocks, alias, currentNoteName, error });
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): {
        totalBlocksRendered: number;
        totalRenders: number;
        averageRenderTime: number;
        lastRenderTime: Date;
    } {
        return { ...this.statistics };
    }

    /**
     * Render a single block
     */
    private async renderSingleBlock(
        container: HTMLElement,
        blockData: BlockData,
        options: BlockRenderOptions,
        currentNoteName?: string,
        blockBoundaryStrategy?: string,
        headingPopupComponent?: any,
        view?: MarkdownView
    ): Promise<void> {
        try {
            // Create block component
            const blockComponent = new BlockComponent(
                blockData.content,
                blockData.sourcePath,
                currentNoteName || blockData.sourcePath, // Use currentNoteName if provided, otherwise sourcePath
                options.headerStyle,
                this.logger as any, // Type assertion for compatibility
                blockBoundaryStrategy || 'default', // Use provided strategy or default
                options.hideBacklinkLine,
                options.hideFirstHeader,
                headingPopupComponent, // Pass through heading popup component
                this.app,
                blockData.id, // Pass the block ID for navigation
                blockData.startLine // Pass the start line for navigation
            );

            // Render the block (requires MarkdownView)
            await blockComponent.render(container, (view as any), (path: string, openInNewTab?: boolean) => {
                // Handle link clicks - this will be wired up by the slice
                this.logger.debug('Link clicked', { path, openInNewTab });
            });

            // Set initial collapsed state after rendering
            blockComponent.setCollapsed(options.collapsed);
            
            // Store the rendered block
            // Use a unique key that includes container reference to support multiple views of the same note
            // Generate a unique ID based on container's position in DOM or a hash
            const containerId = this.getContainerId(container);
            const uniqueBlockId = `${blockData.id}-${containerId}`;
            this.renderedBlocks.set(uniqueBlockId, blockComponent);
            
            // Track which blocks belong to this container
            if (!this.containerBlocks.has(container)) {
                this.containerBlocks.set(container, new Set());
            }
            this.containerBlocks.get(container)!.add(uniqueBlockId);
            
            blockData.container = blockComponent.getContainer() || undefined;
            
            this.logger.debug('Single block rendered successfully', { 
                blockId: blockData.id,
                sourcePath: blockData.sourcePath 
            });
        } catch (error) {
            this.logger.error('Failed to render single block', { blockData, error });
        }
    }

    /**
     * Check if a block contains an alias
     */
    private blockContainsAlias(blockData: BlockData, alias: string, currentNoteName: string): boolean {
        if (!alias) return true;

        const content = blockData.content;

        // Check for alias pattern in content
        const escapedNoteName = this.escapeRegexChars(currentNoteName);
        const regex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}\\|([^\\]]+)\\]\\]`, 'gi');
        const matches = Array.from(content.matchAll(regex));

        for (const match of matches) {
            const aliasString = match[1];
            if (!aliasString) continue;

            // Split by | to get all aliases after the note name
            const aliases = aliasString.split('|');
            if (aliases.some(a => a.toLowerCase() === alias.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    /**
     * Escape regex characters
     */
    private escapeRegexChars(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Update statistics
     */
    private updateStatistics(blockCount: number, renderTime: number): void {
        this.statistics.totalBlocksRendered += blockCount;
        this.statistics.totalRenders++;
        this.statistics.lastRenderTime = new Date();
        
        // Calculate average render time
        if (this.statistics.totalRenders > 0) {
            this.statistics.averageRenderTime = 
                (this.statistics.averageRenderTime * (this.statistics.totalRenders - 1) + renderTime) / 
                this.statistics.totalRenders;
        }
        
        this.logger.debug('Statistics updated', { 
            blockCount, 
            renderTime, 
            statistics: this.statistics 
        });
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalBlocksRendered: 0,
            totalRenders: 0,
            averageRenderTime: 0,
            lastRenderTime: new Date()
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this block renderer
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BlockRenderer');
        
        try {
            // Cleanup all rendered blocks
            for (const [blockId, blockComponent] of this.renderedBlocks.entries()) {
                // Remove the block component from DOM
                const container = blockComponent.getContainer();
                if (container && container.parentElement) {
                    container.parentElement.removeChild(container);
                }
                this.renderedBlocks.delete(blockId);
            }
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('BlockRenderer cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BlockRenderer', { error });
        }
    }
}