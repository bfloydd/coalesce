import { App } from 'obsidian';
import { CoalescePluginInstance } from './plugin';

// ============================
// Obsidian App Extension Types
// ============================

export interface ObsidianPlugins {
    plugins: {
        coalesce: CoalescePluginInstance;
        [key: string]: unknown;
    };
}

export interface ExtendedApp extends App {
    plugins: ObsidianPlugins;
}

// ============================
// Daily Notes Plugin Types
// ============================

export interface DailyNotesPlugin {
    enabled: boolean;
    instance: {
        options: {
            folder: string;
        };
    };
}

export interface InternalPlugins {
    plugins: {
        'daily-notes': DailyNotesPlugin;
        [key: string]: unknown;
    };
}

export interface AppWithInternalPlugins extends App {
    internalPlugins: InternalPlugins;
}