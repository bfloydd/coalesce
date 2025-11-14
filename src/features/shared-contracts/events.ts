// ============================
// Event Contracts for Inter-Slice Communication
// ============================
// These interfaces define the structure of events that slices
// use to communicate with each other in a loosely coupled manner

// ============================
// Backlinks Events
// ============================

/**
 * Emitted when backlinks are discovered or updated
 * Payload: files (string[]), leafId (string), count (number)
 * Emitted by: Backlinks slice
 * Consumed by: BacklinkBlocks, BacklinksHeader, ViewIntegration
 */
export interface BacklinksUpdatedEvent {
    type: 'backlinks:updated';
    payload: {
        files: string[];
        leafId: string;
        count: number;
    };
}

// ============================
// Block Events
// ============================

/**
 * Emitted when blocks are rendered
 * Payload: count (number), leafId (string)
 * Emitted by: BacklinkBlocks slice
 * Consumed by: BacklinksHeader, ViewIntegration
 */
export interface BlocksRenderedEvent {
    type: 'blocks:rendered';
    payload: {
        count: number;
        leafId: string;
    };
}

// ============================
// Header Events
// ============================

/**
 * Emitted when header filter changes
 * Payload: text (string)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderFilterChangedEvent {
    type: 'header:filterChanged';
    payload: {
        text: string;
    };
}

/**
 * Emitted when header sort toggle is clicked
 * Payload: sortByPath (boolean), descending (boolean)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderSortToggledEvent {
    type: 'header:sortToggled';
    payload: {
        sortByPath: boolean;
        descending: boolean;
    };
}


/**
 * Emitted when header strategy changes
 * Payload: strategyId (string)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderStrategyChangedEvent {
    type: 'header:strategyChanged';
    payload: {
        strategyId: string;
    };
}

/**
 * Emitted when header theme changes
 * Payload: themeId (string)
 * Emitted by: BacklinksHeader slice
 * Consumed by: Settings, ViewIntegration, BacklinkBlocks
 */
export interface HeaderThemeChangedEvent {
    type: 'header:themeChanged';
    payload: {
        themeId: string;
    };
}

/**
 * Emitted when header alias selection changes
 * Payload: alias (string|null)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderAliasSelectedEvent {
    type: 'header:aliasSelected';
    payload: {
        alias: string | null;
    };
}

/**
 * Emitted when header collapse toggle is clicked
 * Payload: collapsed (boolean)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderCollapseToggledEvent {
    type: 'header:collapseToggled';
    payload: {
        collapsed: boolean;
    };
}

/**
 * Emitted when header style changes
 * Payload: styleId (string)
 * Emitted by: BacklinksHeader slice
 * Consumed by: BacklinkBlocks
 */
export interface HeaderHeaderStyleChangedEvent {
    type: 'header:headerStyleChanged';
    payload: {
        styleId: string;
    };
}

// ============================
// Navigation Events
// ============================

/**
 * Emitted when navigation to a file is requested
 * Payload: path (string), openInNewTab (boolean)
 * Emitted by: BacklinksHeader, BacklinkBlocks
 * Consumed by: Navigation
 */
export interface NavigationOpenEvent {
    type: 'navigation:open';
    payload: {
        path: string;
        openInNewTab: boolean;
    };
}

// ============================
// Note Editing Events
// ============================

/**
 * Emitted when a heading is added to a note
 * Payload: filePath (string), heading (string)
 * Emitted by: NoteEditing slice
 * Consumed by: BacklinkBlocks, Backlinks, ViewIntegration
 */
export interface NoteEditingHeadingAddedEvent {
    type: 'noteEditing:headingAdded';
    payload: {
        filePath: string;
        heading: string;
    };
}

// ============================
// Union Type for All Events
// ============================

export type CoalesceEvent =
    | BacklinksUpdatedEvent
    | BlocksRenderedEvent
    | HeaderFilterChangedEvent
    | HeaderSortToggledEvent
    | HeaderStrategyChangedEvent
    | HeaderThemeChangedEvent
    | HeaderAliasSelectedEvent
    | HeaderCollapseToggledEvent
    | HeaderHeaderStyleChangedEvent
    | NavigationOpenEvent
    | NoteEditingHeadingAddedEvent;

// ============================
// Event Handler Types
// ============================

export type EventHandler<T extends CoalesceEvent = CoalesceEvent> = (event: T) => void | Promise<void>;

export interface EventDispatcher {
    dispatch<T extends CoalesceEvent>(event: T): void;
    addListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void;
    removeListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void;
}