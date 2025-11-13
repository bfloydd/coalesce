// ============================
// Shared Contracts - Vertical Slice Architecture
// ============================
// This slice contains all shared type definitions and interfaces
// used across the vertical slice architecture

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

// Event contracts for inter-slice communication
export type {
    BacklinksUpdatedEvent,
    BlocksRenderedEvent,
    HeaderFilterChangedEvent,
    HeaderSortToggledEvent,
    HeaderStrategyChangedEvent,
    HeaderThemeChangedEvent,
    HeaderAliasSelectedEvent,
    NavigationOpenEvent,
    NoteEditingHeadingAddedEvent
} from './events';

// Slice interfaces for dependency injection and communication
export type {
    IViewIntegrationSlice,
    IBacklinksSlice,
    IBacklinkBlocksSlice,
    IBacklinksHeaderSlice,
    ISettingsSlice,
    INavigationSlice,
    INoteEditingSlice,
    ISharedUtilitiesSlice
} from './slice-interfaces';

// Common data structures
export type {
    BacklinkData,
    BlockData,
    BlockRenderOptions,
    NavigationOptions,
    FilterOptions,
    SortOptions
} from './data-structures';