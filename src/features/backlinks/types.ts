// ============================
// Backlinks Slice Types
// ============================

import { App, TFile } from 'obsidian';

// ============================
// Backlink Discoverer Interface
// ============================

export interface IBacklinkDiscoverer {
    /**
     * Discover files linking to the current note
     */
    discoverBacklinks(currentFilePath: string): Promise<string[]>;
    
    /**
     * Get resolved backlinks (files that link directly)
     */
    getResolvedBacklinks(currentFilePath: string): string[];
    
    /**
     * Get unresolved backlinks (files that link by name)
     */
    getUnresolvedBacklinks(currentFilePath: string): string[];
    
    /**
     * Check if a file has backlinks
     */
    hasBacklinks(filePath: string): boolean;
    
    /**
     * Get backlink count for a file
     */
    getBacklinkCount(filePath: string): number;
}

// ============================
// Link Resolver Interface
// ============================

export interface ILinkResolver {
    /**
     * Resolve a link path to an actual file path
     */
    resolveLink(linkPath: string, sourceFilePath: string): string | null;
    
    /**
     * Check if a link is resolved
     */
    isLinkResolved(linkPath: string, sourceFilePath: string): boolean;
    
    /**
     * Get all possible resolutions for a link
     */
    getPossibleResolutions(linkPath: string): string[];
    
    /**
     * Normalize a link path
     */
    normalizeLinkPath(linkPath: string): string;
}

// ============================
// Backlink Cache Interface
// ============================

export interface IBacklinkCache {
    /**
     * Get cached backlinks for a file
     */
    getCachedBacklinks(filePath: string): string[] | null;
    
    /**
     * Cache backlinks for a file
     */
    cacheBacklinks(filePath: string, backlinks: string[]): void;
    
    /**
     * Invalidate cache for a file
     */
    invalidateCache(filePath: string): void;
    
    /**
     * Clear all cache
     */
    clearCache(): void;
    
    /**
     * Check if cache is valid for a file
     */
    isCacheValid(filePath: string): boolean;
    
    /**
     * Get cache statistics
     */
    getCacheStatistics(): {
        totalCachedFiles: number;
        cacheHits: number;
        cacheMisses: number;
        lastCleanup?: Date;
    };
}

// ============================
// Backlink Data Structure
// ============================

export interface BacklinkData {
    filePath: string;
    backlinks: string[];
    resolvedBacklinks: string[];
    unresolvedBacklinks: string[];
    lastUpdated: Date;
    cacheValid: boolean;
}

// ============================
// Backlink Discovery Options
// ============================

export interface BacklinkDiscoveryOptions {
    includeResolved: boolean;
    includeUnresolved: boolean;
    useCache: boolean;
    cacheTimeout: number; // in milliseconds
    onlyDailyNotes: boolean;
}

// ============================
// Backlink Resolution Result
// ============================

export interface BacklinkResolutionResult {
    originalLink: string;
    resolvedPath: string | null;
    isResolved: boolean;
    possibleResolutions: string[];
    resolutionMethod: 'direct' | 'name' | 'alias' | 'failed';
}

// ============================
// Backlink Cache Entry
// ============================

export interface BacklinkCacheEntry {
    filePath: string;
    backlinks: string[];
    timestamp: Date;
    fileModifiedTime: number;
    isValid: boolean;
}

// ============================
// Backlink Statistics
// ============================

export interface BacklinkStatistics {
    totalFilesChecked: number;
    filesWithBacklinks: number;
    totalBacklinksFound: number;
    resolvedBacklinks: number;
    unresolvedBacklinks: number;
    averageBacklinksPerFile: number;
    cacheHitRate: number;
    lastDiscoveryTime?: Date;
    // Additional statistics from view layer
    totalBlocksExtracted?: number;
    totalBlocksRendered?: number;
    totalHeadersCreated?: number;
    totalUserInteractions?: number;
}

// ============================
// Backlink Event Data
// ============================

export interface BacklinkEventData {
    filePath: string;
    backlinks: string[];
    count: number;
    leafId?: string;
    timestamp: Date;
}

// ============================
// Backlink Filter Options
// ============================

export interface BacklinkFilterOptions {
    includeResolved: boolean;
    includeUnresolved: boolean;
    excludeDailyNotes: boolean;
    excludeCurrentFile: boolean;
    sortByPath: boolean;
    filterByAlias?: string;
}

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
     * Filter blocks by alias
     */
    filterBlocksByAlias(blocks: BlockData[], alias: string | null, currentNoteName: string): void;

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
    alias?: string;
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

// ============================
// Block Boundary
// ============================

export interface BlockBoundary {
    start: number;
    end: number;
}

// ============================
// Header UI Interface
// ============================

export interface IHeaderUI {
    /**
     * Create header element
     */
    createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement;

    /**
     * Update header state
     */
    updateHeader(header: HTMLElement, state: HeaderState): void;

    /**
     * Focus filter input
     */
    focusFilterInput(header: HTMLElement): boolean;

    /**
     * Get header element
     */
    getHeaderElement(container: HTMLElement): HTMLElement | null;
}

// ============================
// Filter Controls Interface
// ============================

export interface IFilterControls {
    /**
     * Create filter input element
     */
    createFilterInput(container: HTMLElement, options: FilterInputOptions): HTMLInputElement;

    /**
     * Create alias dropdown element
     */
    createAliasDropdown(container: HTMLElement, options: AliasDropdownOptions): HTMLElement;

    /**
     * Update filter text
     */
    updateFilterText(input: HTMLInputElement, text: string): void;

    /**
     * Update alias selection
     */
    updateAliasSelection(dropdown: HTMLElement, alias: string | null): void;
}

// ============================
// Settings Controls Interface
// ============================

export interface ISettingsControls {
    /**
     * Create sort button
     */
    createSortButton(container: HTMLElement, options: SortButtonOptions): HTMLElement;

    /**
     * Create collapse button
     */
    createCollapseButton(container: HTMLElement, options: CollapseButtonOptions): HTMLElement;

    /**
     * Create strategy dropdown
     */
    createStrategyDropdown(container: HTMLElement, options: StrategyDropdownOptions): HTMLElement;

    /**
     * Create theme dropdown
     */
    createThemeDropdown(container: HTMLElement, options: ThemeDropdownOptions): HTMLElement;

    /**
     * Create settings button
     */
    createSettingsButton(container: HTMLElement, options: SettingsButtonOptions): HTMLElement;
}

// ============================
// Header Create Options
// ============================

export interface HeaderCreateOptions {
    fileCount: number;
    sortDescending: boolean;
    isCollapsed: boolean;
    currentStrategy: string;
    currentTheme: string;
    showFullPathTitle: boolean;
    aliases: string[];
    currentAlias: string | null;
    unsavedAliases: string[];
    currentHeaderStyle: string;
    currentFilter: string;
    onSortToggle: () => void;
    onCollapseToggle: () => void;
    onStrategyChange: (strategy: string) => void;
    onThemeChange: (theme: string) => void;
    onFullPathTitleChange: (show: boolean) => void;
    onAliasSelect: (alias: string | null) => void;
    onHeaderStyleChange: (style: string) => void;
    onFilterChange: (filterText: string) => void;
    onSettingsClick: () => void;
    onRefresh: () => void;
}

// ============================
// Header State
// ============================

export interface HeaderState {
    fileCount: number;
    sortByPath: boolean;
    sortDescending: boolean;
    isCollapsed: boolean;
    currentStrategy: string;
    currentTheme: string;
    showFullPathTitle: boolean;
    currentAlias: string | null;
    currentHeaderStyle: string;
    currentFilter: string;
    isCompact: boolean;
}

// ============================
// Filter Input Options
// ============================

export interface FilterInputOptions {
    placeholder: string;
    value: string;
    onInput: (value: string) => void;
    onFocus: () => void;
    onBlur: () => void;
}

// ============================
// Alias Dropdown Options
// ============================

export interface AliasDropdownOptions {
    aliases: string[];
    unsavedAliases: string[];
    currentAlias: string | null;
    onAliasSelect: (alias: string | null) => void;
}

// ============================
// Sort Button Options
// ============================

export interface SortButtonOptions {
    isDescending: boolean;
    onToggle: () => void;
}

// ============================
// Collapse Button Options
// ============================

export interface CollapseButtonOptions {
    isCollapsed: boolean;
    onToggle: () => void;
}

// ============================
// Strategy Dropdown Options
// ============================

export interface StrategyDropdownOptions {
    strategies: string[];
    currentStrategy: string;
    onStrategyChange: (strategy: string) => void;
}

// ============================
// Theme Dropdown Options
// ============================

export interface ThemeDropdownOptions {
    themes: string[];
    currentTheme: string;
    onThemeChange: (theme: string) => void;
}

// ============================
// Settings Button Options
// ============================

export interface SettingsButtonOptions {
    onClick: () => void;
}

// ============================
// Header Event Data
// ============================

export interface HeaderEventData {
    type: 'filterChanged' | 'sortToggled' | 'collapseToggled' | 'strategyChanged' | 'themeChanged' | 'aliasSelected' | 'settingsClicked';
    data: any;
    timestamp: Date;
}

// ============================
// Header Statistics
// ============================

export interface HeaderStatistics {
    totalHeadersCreated: number;
    totalFilterChanges: number;
    totalSortToggles: number;
    totalCollapseToggles: number;
    totalStrategyChanges: number;
    totalThemeChanges: number;
    totalAliasSelections: number;
    totalSettingsClicks: number;
    totalHeaderStyleChanges: number;
    lastFilterChange?: Date;
    lastSortToggle?: Date;
    lastCollapseToggle?: Date;
    lastStrategyChange?: Date;
    lastThemeChange?: Date;
    lastAliasSelection?: Date;
    lastSettingsClick?: Date;
    lastHeaderStyleChange?: Date;
}

// ============================
// Header Component Options
// ============================

export interface HeaderComponentOptions {
    showLogo: boolean;
    showTitle: boolean;
    showFilter: boolean;
    showAliasDropdown: boolean;
    showSortButton: boolean;
    showCollapseButton: boolean;
    showStrategyDropdown: boolean;
    showThemeDropdown: boolean;
    showSettingsButton: boolean;
    responsive: boolean;
}

// ============================
// Header Layout Options
// ============================

export interface HeaderLayoutOptions {
    leftAlign: boolean;
    compactThreshold: number;
    wrapOnOverflow: boolean;
}

// ============================
// Header Theme Options
// ============================

export interface HeaderThemeOptions {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    hoverColor: string;
    activeColor: string;
}