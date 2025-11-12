// ============================
// Backlinks Header Slice Types
// ============================

import { App } from 'obsidian';

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
}

// ============================
// Header State
// ============================

export interface HeaderState {
    fileCount: number;
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
    lastFilterChange?: Date;
    lastSortToggle?: Date;
    lastCollapseToggle?: Date;
    lastStrategyChange?: Date;
    lastThemeChange?: Date;
    lastAliasSelection?: Date;
    lastSettingsClick?: Date;
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