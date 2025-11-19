import { BacklinksState, AttachmentInfo } from '../core/BacklinksState';
import { BlockData } from '../types';

describe('BacklinksState', () => {
  let state: BacklinksState;

  beforeEach(() => {
    state = new BacklinksState();
  });

  describe('backlinks', () => {
    it('stores and retrieves backlinks per file path', () => {
      state.setBacklinks('note-a.md', ['a1.md', 'a2.md']);
      state.setBacklinks('note-b.md', ['b1.md']);

      expect(state.getBacklinks('note-a.md')).toEqual(['a1.md', 'a2.md']);
      expect(state.getBacklinks('note-b.md')).toEqual(['b1.md']);
    });

    it('returns an empty array when no backlinks exist', () => {
      expect(state.getBacklinks('missing.md')).toEqual([]);
    });

    it('clearBacklinks(filePath) clears only that entry', () => {
      state.setBacklinks('note-a.md', ['a1.md']);
      state.setBacklinks('note-b.md', ['b1.md']);

      state.clearBacklinks('note-a.md');

      expect(state.getBacklinks('note-a.md')).toEqual([]);
      expect(state.getBacklinks('note-b.md')).toEqual(['b1.md']);
    });

    it('clearBacklinks() clears all backlinks and resets header fileCount', () => {
      state.setBacklinks('note-a.md', ['a1.md']);
      state.setBacklinks('note-b.md', ['b1.md']);

      state.clearBacklinks();

      expect(Array.from(state.getBacklinksMap().keys())).toEqual([]);
      expect(state.getHeaderState().fileCount).toBe(0);
    });
  });

  describe('blocks', () => {
    const makeBlock = (id: string): BlockData => ({
      id,
      content: `content-${id}`,
      sourcePath: 'source.md',
      startLine: 1,
      endLine: 1,
      isCollapsed: false,
      isVisible: true,
      hasBacklinkLine: false
    });

    it('stores and retrieves blocks per note name', () => {
      const blocksA = [makeBlock('a1'), makeBlock('a2')];
      const blocksB = [makeBlock('b1')];

      state.setBlocks('note-a', blocksA);
      state.setBlocks('note-b', blocksB);

      expect(state.getBlocks('note-a')).toEqual(blocksA);
      expect(state.getBlocks('note-b')).toEqual(blocksB);
    });

    it('returns an empty array when no blocks exist', () => {
      expect(state.getBlocks('missing-note')).toEqual([]);
    });

    it('clearBlocks(noteName) clears only that note', () => {
      const blocksA = [makeBlock('a1')];
      const blocksB = [makeBlock('b1')];

      state.setBlocks('note-a', blocksA);
      state.setBlocks('note-b', blocksB);

      state.clearBlocks('note-a');

      expect(state.getBlocks('note-a')).toEqual([]);
      expect(state.getBlocks('note-b')).toEqual(blocksB);
    });

    it('clearBlocks() clears all blocks', () => {
      state.setBlocks('note-a', [makeBlock('a1')]);

      state.clearBlocks();

      expect(Array.from(state.getBlocksMap().keys())).toEqual([]);
    });
  });

  describe('attachments', () => {
    const makeAttachment = (): AttachmentInfo => ({
      container: document.createElement('div'),
      lastUpdate: 1234
    });

    it('stores and retrieves attachments per view id', () => {
      const a = makeAttachment();
      const b = makeAttachment();

      state.setAttachment('view-a', a);
      state.setAttachment('view-b', b);

      expect(state.getAttachment('view-a')).toBe(a);
      expect(state.getAttachment('view-b')).toBe(b);
    });

    it('removeAttachment removes a single attachment', () => {
      const a = makeAttachment();

      state.setAttachment('view-a', a);
      state.removeAttachment('view-a');

      expect(state.getAttachment('view-a')).toBeUndefined();
    });

    it('clearAttachments removes all attachments', () => {
      state.setAttachment('view-a', makeAttachment());
      state.setAttachment('view-b', makeAttachment());

      state.clearAttachments();

      expect(Array.from(state.getAttachments().keys())).toEqual([]);
    });
  });

  describe('header state', () => {
    it('returns a defensive copy of header state', () => {
      const headerState = state.getHeaderState();
      headerState.fileCount = 999;

      expect(state.getHeaderState().fileCount).toBe(0);
    });

    it('updateHeaderState shallow-merges and returns the new state', () => {
      const updated = state.updateHeaderState({
        fileCount: 3,
        sortByPath: true,
        currentTheme: 'compact'
      });

      expect(updated.fileCount).toBe(3);
      expect(updated.sortByPath).toBe(true);
      expect(updated.currentTheme).toBe('compact');

      const next = state.getHeaderState();
      expect(next.fileCount).toBe(3);
      expect(next.sortByPath).toBe(true);
      expect(next.currentTheme).toBe('compact');
    });
  });

  describe('header statistics', () => {
    it('returns a defensive copy of header statistics', () => {
      const stats = state.getHeaderStatistics();
      stats.totalHeadersCreated = 10;

      expect(state.getHeaderStatistics().totalHeadersCreated).toBe(0);
    });

    it('updateHeaderStatistics applies a mutator and persists the result', () => {
      const updated = state.updateHeaderStatistics(stats => {
        stats.totalHeadersCreated += 1;
        stats.totalFilterChanges += 2;
      });

      expect(updated.totalHeadersCreated).toBe(1);
      expect(updated.totalFilterChanges).toBe(2);

      const next = state.getHeaderStatistics();
      expect(next.totalHeadersCreated).toBe(1);
      expect(next.totalFilterChanges).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all maps and resets header state and statistics to defaults', () => {
      state.setBacklinks('note.md', ['a.md']);
      state.setBlocks('note', [{
        id: '1',
        content: 'content',
        sourcePath: 'source.md',
        startLine: 1,
        endLine: 1,
        isCollapsed: false,
        isVisible: true,
        hasBacklinkLine: false
      }]);
      state.setAttachment('view', {
        container: document.createElement('div'),
        lastUpdate: 123
      });
      state.updateHeaderState({ fileCount: 42, sortByPath: true });
      state.updateHeaderStatistics(stats => {
        stats.totalHeadersCreated = 5;
      });

      state.reset();

      expect(Array.from(state.getBacklinksMap().keys())).toEqual([]);
      expect(Array.from(state.getBlocksMap().keys())).toEqual([]);
      expect(Array.from(state.getAttachments().keys())).toEqual([]);

      const headerState = state.getHeaderState();
      expect(headerState.fileCount).toBe(0);
      expect(headerState.sortByPath).toBe(false);
      expect(headerState.currentTheme).toBe('default');

      const headerStats = state.getHeaderStatistics();
      expect(headerStats.totalHeadersCreated).toBe(0);
      expect(headerStats.totalFilterChanges).toBe(0);
    });
  });
});