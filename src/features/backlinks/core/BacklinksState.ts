import { BlockData, HeaderState, HeaderStatistics } from '../types';

/**
 * Centralized state container for the Backlinks feature.
 *
 * This class owns all in-memory state that used to live directly on BacklinksSlice:
 * - Backlinks by file
 * - Extracted blocks by current note
 * - Attached view containers
 * - Header UI state and statistics
 *
 * It is intentionally free of any Obsidian APIs or direct DOM querying
 * so it stays easy to test and reuse.
 */
export interface AttachmentInfo {
    container: HTMLElement;
    lastUpdate: number;
}

export class BacklinksState {
    private backlinksByFile = new Map<string, string[]>();
    private blocksByNote = new Map<string, BlockData[]>();
    private attachmentsByView = new Map<string, AttachmentInfo>();
    private headerState: HeaderState;
    private headerStatistics: HeaderStatistics;

    constructor(
        initialHeaderState?: Partial<HeaderState>,
        initialHeaderStats?: Partial<HeaderStatistics>
    ) {
        this.headerState = {
            fileCount: 0,
            sortByPath: false,
            sortDescending: true,
            isCollapsed: false,
            currentStrategy: 'default',
            currentTheme: 'default',
            showFullPathTitle: false,
            currentAlias: null,
            currentHeaderStyle: 'full',
            currentFilter: '',
            isCompact: false,
            ...initialHeaderState
        };

        this.headerStatistics = {
            totalHeadersCreated: 0,
            totalFilterChanges: 0,
            totalSortToggles: 0,
            totalCollapseToggles: 0,
            totalStrategyChanges: 0,
            totalThemeChanges: 0,
            totalAliasSelections: 0,
            totalSettingsClicks: 0,
            totalHeaderStyleChanges: 0,
            ...initialHeaderStats
        };
    }

    // Backlinks

    setBacklinks(filePath: string, backlinks: string[]): void {
        this.backlinksByFile.set(filePath, [...backlinks]);
        this.headerState.fileCount = backlinks.length;
    }

    getBacklinks(filePath: string): string[] {
        const backlinks = this.backlinksByFile.get(filePath);
        return backlinks ? [...backlinks] : [];
    }

    clearBacklinks(filePath?: string): void {
        if (filePath) {
            this.backlinksByFile.delete(filePath);
        } else {
            this.backlinksByFile.clear();
            this.headerState.fileCount = 0;
        }
    }

    getBacklinksMap(): ReadonlyMap<string, string[]> {
        return this.backlinksByFile;
    }

    // Blocks

    setBlocks(noteName: string, blocks: BlockData[]): void {
        this.blocksByNote.set(noteName, [...blocks]);
    }

    getBlocks(noteName: string): BlockData[] {
        const blocks = this.blocksByNote.get(noteName);
        return blocks ? [...blocks] : [];
    }

    clearBlocks(noteName?: string): void {
        if (noteName) {
            this.blocksByNote.delete(noteName);
        } else {
            this.blocksByNote.clear();
        }
    }

    getBlocksMap(): ReadonlyMap<string, BlockData[]> {
        return this.blocksByNote;
    }

    // Attachments

    setAttachment(viewId: string, attachment: AttachmentInfo): void {
        this.attachmentsByView.set(viewId, attachment);
    }

    getAttachment(viewId: string): AttachmentInfo | undefined {
        return this.attachmentsByView.get(viewId);
    }

    removeAttachment(viewId: string): void {
        this.attachmentsByView.delete(viewId);
    }

    clearAttachments(): void {
        this.attachmentsByView.clear();
    }

    getAttachments(): ReadonlyMap<string, AttachmentInfo> {
        return this.attachmentsByView;
    }

    // Header state

    getHeaderState(): HeaderState {
        return { ...this.headerState };
    }

    /**
     * Shallow-merge the current header state with the provided partial
     * and return the updated value.
     */
    updateHeaderState(partial: Partial<HeaderState>): HeaderState {
        this.headerState = {
            ...this.headerState,
            ...partial
        };
        return this.getHeaderState();
    }

    // Header statistics

    getHeaderStatistics(): HeaderStatistics {
        return { ...this.headerStatistics };
    }

    /**
     * Apply a mutating update function to the header statistics in a controlled way.
     */
    updateHeaderStatistics(mutator: (stats: HeaderStatistics) => void): HeaderStatistics {
        const copy: HeaderStatistics = { ...this.headerStatistics };
        mutator(copy);
        this.headerStatistics = copy;
        return this.getHeaderStatistics();
    }

    reset(): void {
        this.backlinksByFile.clear();
        this.blocksByNote.clear();
        this.attachmentsByView.clear();

        this.headerState = {
            fileCount: 0,
            sortByPath: false,
            sortDescending: true,
            isCollapsed: false,
            currentStrategy: 'default',
            currentTheme: 'default',
            showFullPathTitle: false,
            currentAlias: null,
            currentHeaderStyle: 'full',
            currentFilter: '',
            isCompact: false
        };

        this.headerStatistics = {
            totalHeadersCreated: 0,
            totalFilterChanges: 0,
            totalSortToggles: 0,
            totalCollapseToggles: 0,
            totalStrategyChanges: 0,
            totalThemeChanges: 0,
            totalAliasSelections: 0,
            totalSettingsClicks: 0,
            totalHeaderStyleChanges: 0
        };
    }
}