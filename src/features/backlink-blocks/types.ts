// ============================
// Backlink Blocks Slice Types
// ============================

import { App, TFile } from 'obsidian';

// ============================
// Block Extractor Interface
// ============================

export interface IBlockExtractor {
    /**
     * Extract blocks from file content
     */
    extractBlocks(content: string, currentNoteName: string, strategy: string): Promise<BlockData[]>;
    
    /**
     * Get available strategies
     */
    getAvailableStrategies(): string[];
    
    /**
     * Check if strategy is available
     */
    isStrategyAvailable(strategy: string): boolean;
    
    /**
     * Get strategy description
     */
    getStrategyDescription(strategy: string): string;
}

// ============================
// Block Renderer Interface
// ============================

export interface IBlockRenderer {
    /**
     * Render blocks to DOM container
     */
    renderBlocks(
        container: HTMLElement, 
        blocks: BlockData[], 
        options: BlockRenderOptions
    ): Promise<void>;
    
    /**
     * Update block visibility
     */
    updateBlockVisibility(blocks: BlockData[], visible: boolean): void;
    
    /**
     * Update block collapsed state
     */
    updateBlockCollapsedState(blocks: BlockData[], collapsed: boolean): void;
    
    /**
     * Clear rendered blocks
     */
    clearRenderedBlocks(container: HTMLElement): void;
}

// ============================
// Strategy Manager Interface
// ============================

export interface IStrategyManager {
    /**
     * Get current strategy
     */
    getCurrentStrategy(): string;
    
    /**
     * Set current strategy
     */
    setCurrentStrategy(strategy: string): void;
    
    /**
     * Get available strategies
     */
    getAvailableStrategies(): string[];
    
    /**
     * Register a new strategy
     */
    registerStrategy(strategy: string, description: string): void;
    
    /**
     * Get strategy description
     */
    getStrategyDescription(strategy: string): string;
}

// ============================
// Block Data Structure
// ============================

export interface BlockData {
    id: string;
    content: string;
    sourcePath: string;
    startLine: number;
    endLine: number;
    heading?: string;
    headingLevel?: number;
    hasBacklinkLine: boolean;
    isVisible: boolean;
    isCollapsed: boolean;
    container?: HTMLElement;
}

// ============================
// Block Render Options
// ============================

export interface BlockRenderOptions {
    headerStyle: string;
    hideBacklinkLine: boolean;
    hideFirstHeader: boolean;
    showFullPathTitle: boolean;
    collapsed: boolean;
    filterText?: string;
    aliasFilter?: string;
    sortByPath: boolean;
    sortDescending: boolean;
}

// ============================
// Block Boundary Strategy
// ============================

export interface BlockBoundaryStrategy {
    name: string;
    description: string;
    findBlockBoundaries(content: string, currentNoteName: string): Array<{
        start: number;
        end: number;
    }>;
}

// ============================
// Block Statistics
// ============================

export interface BlockStatistics {
    totalBlocksExtracted: number;
    totalBlocksRendered: number;
    blocksHidden: number;
    blocksCollapsed: number;
    averageBlockSize: number;
    lastExtractionTime?: Date;
    lastRenderTime?: Date;
}

// ============================
// Block Event Data
// ============================

export interface BlockEventData {
    blockId: string;
    sourcePath: string;
    action: 'render' | 'hide' | 'show' | 'collapse' | 'expand' | 'click';
    timestamp: Date;
}

// ============================
// Block Filter Options
// ============================

export interface BlockFilterOptions {
    text?: string;
    alias?: string;
    showOnlyWithAlias?: boolean;
    hideEmptyBlocks?: boolean;
    sortByPath?: boolean;
    sortDescending?: boolean;
}

// ============================
// Block Extraction Result
// ============================

export interface BlockExtractionResult {
    blocks: BlockData[];
    strategy: string;
    extractionTime: number;
    success: boolean;
    errors: string[];
}

// ============================
// Block Render Result
// ============================

export interface BlockRenderResult {
    renderedBlocks: number;
    hiddenBlocks: number;
    collapsedBlocks: number;
    renderTime: number;
    success: boolean;
    errors: string[];
}

// ============================
// Block Component Options
// ============================

export interface BlockComponentOptions {
    headerStyle: string;
    hideBacklinkLine: boolean;
    hideFirstHeader: boolean;
    showFullPathTitle: boolean;
    onLinkClick?: (path: string, openInNewTab?: boolean) => void;
    onHeadingClick?: (heading: string) => void;
}