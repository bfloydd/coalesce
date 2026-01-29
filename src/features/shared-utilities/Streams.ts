import type { App } from 'obsidian';

/**
 * Minimal shape of the Streams plugin public API as used by Coalesce.
 *
 * Source of truth for the intent:
 * Streams exposes `getStreamForFile(filePath)` (see Streams `APIService`).
 */
export interface StreamsApiLike {
    getStreamForFile(filePath: string): unknown | null;
    hasStreams?: () => boolean;
}

/**
 * Attempt to find the Streams plugin API from Obsidian's community plugin manager.
 *
 * We intentionally keep this defensive because plugins may expose APIs in different fields
 * (or not at all), depending on Streams version.
 */
export function getStreamsApi(app: App): StreamsApiLike | null {
    const streamsPlugin = (app as any)?.plugins?.plugins?.streams;
    if (!streamsPlugin) return null;

    const candidates: unknown[] = [
        (streamsPlugin as any).api,
        (streamsPlugin as any).API,
        (streamsPlugin as any).apiService,
        (streamsPlugin as any).services?.api,
        (streamsPlugin as any).slices?.api,
        streamsPlugin
    ];

    for (const candidate of candidates) {
        const api = candidate as any;
        if (api && typeof api.getStreamForFile === 'function') {
            return api as StreamsApiLike;
        }
    }

    return null;
}

/**
 * Check whether a file belongs to any Streams stream.
 * Returns false if Streams is not installed/enabled or no API is available.
 */
export function isFileInAnyStream(app: App, filePath: string): boolean {
    if (!filePath) return false;

    try {
        const api = getStreamsApi(app);
        if (!api) return false;

        if (typeof api.hasStreams === 'function' && !api.hasStreams()) {
            return false;
        }

        return api.getStreamForFile(filePath) !== null;
    } catch {
        return false;
    }
}


