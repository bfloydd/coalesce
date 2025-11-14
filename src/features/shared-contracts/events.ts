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