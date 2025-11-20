import { App, MarkdownView, TFile } from 'obsidian';
import { CoalescePluginSettings } from './plugin';
import { AppWithInternalPlugins } from './obsidian';
import { CoalesceEvent, EventHandler, EventDispatcher } from './events';

// ============================
// Slice Interface Definitions
// ============================
// These interfaces define the contract for each slice in the vertical slice architecture
// They enable dependency injection and loose coupling between slices

// ============================
// Shared Utilities Interface
// ============================

export interface ISharedUtilitiesSlice {
    /**
     * Logger instance for debugging and error reporting
     */
    getLogger(): (prefix?: string) => {
        debug(message?: unknown, ...optionalParams: unknown[]): void;
        info(message?: unknown, ...optionalParams: unknown[]): void;
        warn(message?: unknown, ...optionalParams: unknown[]): void;
        error(message?: unknown, ...optionalParams: unknown[]): void;
        on(level?: any): void;
        off(): void;
        isEnabled(): boolean;
    };

    /**
     * Daily note detection and helper functions
     */
    getDailyNote(): {
        isDaily(app: AppWithInternalPlugins, filePath: string): boolean;
        getDailyNotePath(app: AppWithInternalPlugins, date?: Date): string | null;
    };

    /**
     * Common helper functions used across slices
     */
    getHelpers(): {
        escapeRegexChars(text: string): string;
        debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;
    };
}

// ============================
// Settings Interface
// ============================

export interface ISettingsSlice {
    /**
     * Load settings from storage
     */
    loadSettings(): Promise<void>;

    /**
     * Save settings to storage
     */
    saveSettings(): Promise<void>;

    /**
     * Get current settings
     */
    getSettings(): CoalescePluginSettings;

    /**
     * Update specific setting
     */
    updateSetting<K extends keyof CoalescePluginSettings>(key: K, value: CoalescePluginSettings[K]): Promise<void>;

    /**
     * Theme management
     */
    getThemeManager(): {
        getCurrentTheme(): string;
        setTheme(theme: string): void;
        getAvailableThemes(): readonly string[];
    };
}

// ============================
// Navigation Interface
// ============================

export interface INavigationSlice {
    /**
     * Open a file path
     */
    openPath(path: string, openInNewTab?: boolean): void;

    /**
     * Handle navigation events
     */
    handleNavigationEvent(event: CoalesceEvent): void;

    /**
     * Get navigation options
     */
    getNavigationOptions(): {
        defaultOpenInNewTab: boolean;
    };
}

// ============================
// Note Editing Interface
// ============================

export interface INoteEditingSlice {
    /**
     * Add heading to a file
     */
    addHeadingToFile(filePath: string, heading: string): Promise<boolean>;

    /**
     * Show heading popup for user input
     */
    showHeadingPopup(filePath: string, onHeadingAdded?: (heading: string) => void): void;

    /**
     * Validate heading content
     */
    validateHeading(heading: string): boolean;

    /**
     * Get file modification options
     */
    getFileModificationOptions(): {
        createBackup: boolean;
        validateContent: boolean;
    };
}

// ============================
// Backlinks Interface
// ============================

export interface IBacklinksSlice {
    /**
     * Discover backlinks for a given file
     */
    discoverBacklinks(filePath: string): Promise<string[]>;

    /**
     * Get cached backlinks
     */
    getCachedBacklinks(filePath: string): string[] | null;

    /**
     * Clear backlinks cache
     */
    clearCache(filePath?: string): void;

    /**
     * Check if backlinks have changed
     */
    haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean;

    /**
     * Get backlink metadata
     */
    getBacklinkMetadata(): {
        lastUpdated: Date;
        cacheSize: number;
    };
}


// ============================
// View Integration Interface
// ============================

export interface IViewIntegrationSlice {
    /**
     * Initialize view for a file
     */
    initializeView(file: TFile, view: MarkdownView): Promise<void>;

    /**
     * Cleanup view resources
     */
    cleanupView(leafId: string): void;

    /**
     * Handle view mode switch
     */
    handleModeSwitch(file: TFile, view: MarkdownView): Promise<void>;

    /**
     * Request focus when ready
     */
    requestFocusWhenReady(leafId: string): void;

    /**
     * Check if view is ready for focus
     */
    isViewReadyForFocus(leafId: string): boolean;

    /**
     * Get view statistics
     */
    getViewStatistics(): {
        activeViews: number;
        focusedViews: number;
        totalViews: number;
    };
}

// ============================
// Supporting Types
// ============================

export interface BlockRenderOptions {
    headerStyle: string;
    strategy: string;
    hideBacklinkLine: boolean;
    hideFirstHeader: boolean;
    theme: string;
    onLinkClick: (path: string, openInNewTab?: boolean) => void;
}

export interface FilterOptions {
    text?: string;
    alias?: string | null;
    showAll?: boolean;
}

export interface SortOptions {
    descending: boolean;
    sortByFullPath: boolean;
}

export interface HeaderRenderOptions {
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
}

export interface HeaderState {
    filterText: string;
    sortDescending: boolean;
    isCollapsed: boolean;
    currentStrategy: string;
    currentTheme: string;
    selectedAlias: string | null;
}

// Note:
// Orchestrator contracts and types (such as IPluginOrchestrator) now live under
// [`src/orchestrator/types.ts`](src/orchestrator/types.ts:1) and are exported
// via [`src/orchestrator/index.ts`](src/orchestrator/index.ts:1).
//
// This file is intentionally limited to slice-level contracts shared between
// features and the orchestrator.