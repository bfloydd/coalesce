import { BacklinksCore } from '../core/BacklinksCore';
import { BacklinksState } from '../core/BacklinksState';
import { BacklinksEvents } from '../core/BacklinksEvents';
import { BacklinkDiscoveryOptions } from '../types';
import { BacklinkDiscoverer } from '../BacklinkDiscoverer';
import { BacklinkCache } from '../BacklinkCache';
import { DailyNote } from '../../shared-utilities/DailyNote';

jest.mock('../BacklinkDiscoverer', () => {
    return {
        BacklinkDiscoverer: jest.fn().mockImplementation(() => ({
            discoverBacklinks: jest.fn(),
            filterBacklinks: jest.fn(),
            getStatistics: jest.fn().mockReturnValue({
                totalFilesChecked: 0,
                filesWithBacklinks: 0,
                totalBacklinksFound: 0,
                resolvedBacklinks: 0,
                unresolvedBacklinks: 0,
                averageBacklinksPerFile: 0,
                cacheHitRate: 0
            }),
            cleanup: jest.fn()
        }))
    };
});

jest.mock('../BacklinkCache', () => {
    return {
        BacklinkCache: jest.fn().mockImplementation(() => ({
            getCachedBacklinks: jest.fn(),
            cacheBacklinks: jest.fn(),
            clearCache: jest.fn(),
            invalidateCache: jest.fn(),
            getCacheStatistics: jest.fn().mockReturnValue({
                totalCachedFiles: 1,
                cacheHits: 0,
                cacheMisses: 0,
                lastCleanup: new Date()
            }),
            cleanup: jest.fn()
        }))
    };
});

jest.mock('../../shared-utilities/DailyNote', () => ({
    DailyNote: {
        isDaily: jest.fn()
    }
}));

describe('BacklinksCore', () => {
    let mockApp: any;
    let mockLogger: any;
    let state: BacklinksState;
    let events: BacklinksEvents;
    let core: BacklinksCore;

    const createCore = (options: Partial<BacklinkDiscoveryOptions> = {}) => {
        const baseOptions: Partial<BacklinkDiscoveryOptions> = {
            includeResolved: true,
            includeUnresolved: true,
            useCache: true,
            cacheTimeout: 30000,
            onlyDailyNotes: false,
            ...options
        };
        return new BacklinksCore(mockApp, mockLogger, baseOptions, state, events);
    };

    beforeEach(() => {
        mockApp = {
            metadataCache: {
                resolvedLinks: {},
                unresolvedLinks: {}
            },
            vault: {
                getMarkdownFiles: jest.fn().mockReturnValue([]),
                getAbstractFileByPath: jest.fn(),
                read: jest.fn()
            }
        };

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            child: jest.fn().mockReturnThis(),
            logErrorWithContext: jest.fn()
        };

        state = new BacklinksState();
        events = new BacklinksEvents(mockLogger as any);

        (DailyNote.isDaily as jest.Mock).mockReset();
        (BacklinkDiscoverer as unknown as jest.Mock).mockClear();
        (BacklinkCache as unknown as jest.Mock).mockClear();

        core = createCore();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateBacklinks', () => {
        it('skips daily notes when onlyDailyNotes is true', async () => {
            (DailyNote.isDaily as jest.Mock).mockReturnValue(true);

            const dailyCore = createCore({ onlyDailyNotes: true });
            const result = await dailyCore.updateBacklinks('2024-01-01.md');

            expect(result).toEqual([]);
            expect(DailyNote.isDaily).toHaveBeenCalledWith(mockApp, '2024-01-01.md');

            const stateBacklinks = state.getBacklinks('2024-01-01.md');
            expect(stateBacklinks).toEqual([]);
        });

        it('uses cache when cached backlinks are available', async () => {
            (DailyNote.isDaily as jest.Mock).mockReturnValue(false);

            core = createCore({ useCache: true });
            const cacheInstance = core.getBacklinkCache() as any;
            const discovererInstance = core.getBacklinkDiscoverer() as any;

            cacheInstance.getCachedBacklinks.mockReturnValue(['cached1.md', 'cached2.md']);

            const result = await core.updateBacklinks('note.md');

            expect(cacheInstance.getCachedBacklinks).toHaveBeenCalledWith('note.md');
            expect(discovererInstance.discoverBacklinks).not.toHaveBeenCalled();
            expect(result).toEqual(['cached1.md', 'cached2.md']);

            const stateBacklinks = state.getBacklinks('note.md');
            expect(stateBacklinks).toEqual(['cached1.md', 'cached2.md']);
        });

        it('discovers and caches backlinks when cache is empty', async () => {
            (DailyNote.isDaily as jest.Mock).mockReturnValue(false);

            core = createCore({ useCache: true });
            const cacheInstance = core.getBacklinkCache() as any;
            const discovererInstance = core.getBacklinkDiscoverer() as any;

            cacheInstance.getCachedBacklinks.mockReturnValue(null);
            discovererInstance.discoverBacklinks.mockResolvedValue(['disc1.md', 'disc2.md']);

            const result = await core.updateBacklinks('note.md');

            expect(cacheInstance.getCachedBacklinks).toHaveBeenCalledWith('note.md');
            expect(discovererInstance.discoverBacklinks).toHaveBeenCalledWith('note.md');
            expect(cacheInstance.cacheBacklinks).toHaveBeenCalledWith('note.md', ['disc1.md', 'disc2.md']);
            expect(result).toEqual(['disc1.md', 'disc2.md']);

            const stateBacklinks = state.getBacklinks('note.md');
            expect(stateBacklinks).toEqual(['disc1.md', 'disc2.md']);
        });

        it('emits backlinks:updated event after updating backlinks', async () => {
            (DailyNote.isDaily as jest.Mock).mockReturnValue(false);

            core = createCore({ useCache: false });
            const discovererInstance = core.getBacklinkDiscoverer() as any;
            discovererInstance.discoverBacklinks.mockResolvedValue(['a.md', 'b.md']);

            const emitSpy = jest.spyOn(events, 'emitEvent');

            await core.updateBacklinks('note.md', 'leaf-1');

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const event = emitSpy.mock.calls[0][0] as any;
            expect(event.type).toBe('backlinks:updated');
            expect(event.payload.files).toEqual(['a.md', 'b.md']);
            expect(event.payload.leafId).toBe('leaf-1');
            expect(event.payload.count).toBe(2);
        });
    });

    describe('haveBacklinksChanged', () => {
        it('returns false when backlinks are identical (order-insensitive)', () => {
            state.setBacklinks('note.md', ['a.md', 'b.md']);

            const changed = core.haveBacklinksChanged('note.md', ['b.md', 'a.md']);

            expect(changed).toBe(false);
        });

        it('returns true when backlink count differs', () => {
            state.setBacklinks('note.md', ['a.md']);

            const changed = core.haveBacklinksChanged('note.md', ['a.md', 'b.md']);

            expect(changed).toBe(true);
        });

        it('returns true when backlink contents differ', () => {
            state.setBacklinks('note.md', ['a.md', 'b.md']);

            const changed = core.haveBacklinksChanged('note.md', ['a.md', 'c.md']);

            expect(changed).toBe(true);
        });
    });

    describe('getBacklinkMetadata', () => {
        it('returns metadata based on cache statistics', () => {
            const cacheInstance = core.getBacklinkCache() as any;
            const lastCleanup = new Date('2024-01-01T00:00:00Z');
            cacheInstance.getCacheStatistics.mockReturnValue({
                totalCachedFiles: 5,
                cacheHits: 10,
                cacheMisses: 2,
                lastCleanup
            });

            const metadata = core.getBacklinkMetadata();

            expect(metadata.cacheSize).toBe(5);
            expect(metadata.lastUpdated).toBe(lastCleanup);
        });
    });

    describe('clearCache / clearBacklinks', () => {
        it('clearCache(filePath) invalidates only that file and clears state entry', () => {
            const cacheInstance = core.getBacklinkCache() as any;
            state.setBacklinks('note.md', ['a.md']);

            core.clearCache('note.md');

            expect(cacheInstance.invalidateCache).toHaveBeenCalledWith('note.md');
            expect(state.getBacklinks('note.md')).toEqual([]);
        });

        it('clearCache() clears all cache and state', () => {
            const cacheInstance = core.getBacklinkCache() as any;
            state.setBacklinks('n1.md', ['a.md']);
            state.setBacklinks('n2.md', ['b.md']);

            core.clearCache();

            expect(cacheInstance.clearCache).toHaveBeenCalled();
            expect(state.getBacklinks('n1.md')).toEqual([]);
            expect(state.getBacklinks('n2.md')).toEqual([]);
        });

        it('clearBacklinks() clears state and cache', () => {
            const cacheInstance = core.getBacklinkCache() as any;
            state.setBacklinks('note.md', ['a.md']);

            core.clearBacklinks();

            expect(cacheInstance.clearCache).toHaveBeenCalled();
            expect(state.getBacklinks('note.md')).toEqual([]);
        });
    });
});