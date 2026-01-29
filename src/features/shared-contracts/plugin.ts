import { Plugin as ObsidianPlugin } from 'obsidian';

// Temporary LogLevel enum until SharedUtilities is implemented
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

// ============================
// Plugin Settings Types (inline to avoid circular imports)
// ============================

export interface CoalescePluginSettings {
    mySetting: string;
    sortDescending: boolean;
    showInDailyNotes: boolean;
    blockBoundaryStrategy: string;
    theme: string;
    showFullPathTitle: boolean;
    onlyDailyNotes: boolean;
    /**
     * If true, Coalesce UI should NOT be attached for Daily Notes or Streams notes.
     * This is a UI-visibility gate (not a backlink discovery filter).
     */
    hideInDailyNotesOrStreams: boolean;
    headerStyle: string;
    hideBacklinkLine: boolean;
    hideFirstHeader: boolean;
    sortByFullPath: boolean; // If true, sort by full path; if false, sort by filename
    enableLogging: boolean; // Enable/disable debug logging
    blocksCollapsed: boolean; // If true, blocks start collapsed by default
}

// ============================
// Plugin Instance Types
// ============================

export interface CoalescePluginInstance {
    log?: {
        on: (level?: LogLevel | keyof typeof LogLevel | number) => void;
        off: () => void;
        isEnabled: () => boolean;
    };
}

export interface CoalescePlugin extends ObsidianPlugin {
    coalesceManager?: {
        refreshActiveViews(): void;
    };
}

// ============================
// Plugin Interface Types
// ============================

export interface PluginInterface {
    loadData(): Promise<Partial<CoalescePluginSettings>>;
    saveData(settings: CoalescePluginSettings): Promise<void>;
}