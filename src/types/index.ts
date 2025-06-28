// ============================
// Re-export all types for easy importing
// ============================

// Plugin types (includes settings)
export type { 
    CoalescePluginInstance, 
    CoalescePlugin, 
    PluginInterface,
    CoalescePluginSettings
} from './plugin';

// Obsidian app extension types
export type { 
    ObsidianPlugins, 
    ExtendedApp, 
    InternalPlugins, 
    AppWithInternalPlugins,
    DailyNotesPlugin
} from './obsidian'; 