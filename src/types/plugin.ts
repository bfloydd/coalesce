import { Plugin as ObsidianPlugin } from 'obsidian';
import { LogLevel } from '../utils/Logger';

// ============================
// Plugin Settings Types (inline to avoid circular imports)
// ============================

export interface CoalescePluginSettings {
    mySetting: string;
    sortDescending: boolean;
    blocksCollapsed: boolean;
    showInDailyNotes: boolean;
    blockBoundaryStrategy: string;
    theme: string;
    showFullPathTitle: boolean;
    position: 'high' | 'low';
    onlyDailyNotes: boolean;
    headerStyle: string;
    hideBacklinkLine: boolean;
    sortByFullPath: boolean; // If true, sort by full path; if false, sort by filename
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