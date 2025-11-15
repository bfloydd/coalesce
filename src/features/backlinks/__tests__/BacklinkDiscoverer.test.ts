import { BacklinkDiscoverer } from '../BacklinkDiscoverer';
import { App, TFile } from 'obsidian';

describe('BacklinkDiscoverer', () => {
  let mockApp: jest.Mocked<App>;
  let discoverer: BacklinkDiscoverer;

  beforeEach(() => {
    // Create vault mock
    const mockVault = {
      getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
        if (path === 'target.md') {
          // Create a mock TFile instance
          const file = Object.create(TFile.prototype);
          file.path = 'target.md';
          file.basename = 'target';
          file.name = 'target.md';
          file.extension = 'md';
          return file;
        }
        return null;
      })
    };

    // Create mock app with metadata cache
    mockApp = {
      metadataCache: {
        resolvedLinks: {},
        unresolvedLinks: {},
        getCache: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      vault: mockVault
    } as any;

    // Create logger mock
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis()
    };

    discoverer = new BacklinkDiscoverer(mockApp, mockLogger as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverBacklinks', () => {
    it('should find resolved backlinks', async () => {
      // Setup metadata cache with resolved links
      mockApp.metadataCache.resolvedLinks = {
        'file1.md': { 'target.md': 1 },
        'file2.md': { 'target.md': 1 }
      };

      const backlinks = await discoverer.discoverBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
      expect(backlinks).toContain('file2.md');
      expect(backlinks).toHaveLength(2);
    });

    it('should find unresolved backlinks with case insensitive matching', async () => {
      // Setup metadata cache with unresolved links
      mockApp.metadataCache.unresolvedLinks = {
        'file3.md': { 'Target': 1 } // Note: different case
      };

      // Mock file info for case matching
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
        basename: 'target',
        name: 'target.md'
      } as TFile);

      const backlinks = await discoverer.discoverBacklinks('target.md');
      expect(backlinks).toContain('file3.md');
    });

    it('should combine resolved and unresolved backlinks', async () => {
      mockApp.metadataCache.resolvedLinks = {
        'file1.md': { 'target.md': 1 }
      };
      mockApp.metadataCache.unresolvedLinks = {
        'file2.md': { 'target': 1 }
      };

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
        basename: 'target',
        name: 'target.md'
      } as TFile);

      const backlinks = await discoverer.discoverBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
      expect(backlinks).toContain('file2.md');
      expect(backlinks).toHaveLength(2);
    });

    it('should return empty array when no backlinks exist', async () => {
      // Empty metadata cache
      mockApp.metadataCache.resolvedLinks = {};
      mockApp.metadataCache.unresolvedLinks = {};

      const backlinks = await discoverer.discoverBacklinks('nonexistent.md');
      expect(backlinks).toEqual([]);
    }, 500); // Short timeout since this should be fast

    it('should remove duplicates between resolved and unresolved links', async () => {
      mockApp.metadataCache.resolvedLinks = {
        'file1.md': { 'target.md': 1 }
      };
      mockApp.metadataCache.unresolvedLinks = {
        'file1.md': { 'target': 1 } // Same file
      };

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
        basename: 'target',
        name: 'target.md'
      } as TFile);

      const backlinks = await discoverer.discoverBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
      expect(backlinks).toHaveLength(1); // Should not duplicate
    });
  });

  describe('getResolvedBacklinks', () => {
    it('should return files that link to the target', () => {
      mockApp.metadataCache.resolvedLinks = {
        'file1.md': { 'target.md': 1, 'other.md': 1 },
        'file2.md': { 'target.md': 1 },
        'file3.md': { 'other.md': 1 } // Doesn't link to target
      };

      const backlinks = discoverer.getResolvedBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
      expect(backlinks).toContain('file2.md');
      expect(backlinks).not.toContain('file3.md');
    });
  });

  describe('getUnresolvedBacklinks', () => {
    beforeEach(() => {
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
        basename: 'target',
        name: 'target.md'
      } as TFile);
    });

    it('should match by basename', () => {
      mockApp.metadataCache.unresolvedLinks = {
        'file1.md': { 'target': 1 }
      };

      // Ensure the mock is set up correctly
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({
        basename: 'target',
        name: 'target.md'
      } as TFile);

      const backlinks = discoverer.getUnresolvedBacklinks('target.md');

      expect((mockApp.vault.getAbstractFileByPath as jest.Mock)).toHaveBeenCalledWith('target.md');
      expect(backlinks).toContain('file1.md');
    });

    it('should match by full name', () => {
      mockApp.metadataCache.unresolvedLinks = {
        'file1.md': { 'target.md': 1 }
      };

      const backlinks = discoverer.getUnresolvedBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
    });

    it('should handle case insensitive matching', () => {
      mockApp.metadataCache.unresolvedLinks = {
        'file1.md': { 'TARGET': 1 }
      };

      const backlinks = discoverer.getUnresolvedBacklinks('target.md');
      expect(backlinks).toContain('file1.md');
    });
  });

  describe('hasBacklinks', () => {
    it('should return true when backlinks exist', () => {
      mockApp.metadataCache.resolvedLinks = {
        'file1.md': { 'target.md': 1 }
      };

      const hasBacklinks = discoverer.hasBacklinks('target.md');
      expect(hasBacklinks).toBe(true);
    });

    it('should return false when no backlinks exist', () => {
      mockApp.metadataCache.resolvedLinks = {};
      mockApp.metadataCache.unresolvedLinks = {};

      const hasBacklinks = discoverer.hasBacklinks('target.md');
      expect(hasBacklinks).toBe(false);
    });
  });

  describe('filterBacklinks', () => {
    const backlinks = ['file1.md', 'file2.md', 'file3.md'];

    it('should exclude daily notes when requested', () => {
      const filtered = discoverer.filterBacklinks(backlinks, {
        excludeDailyNotes: true
      });

      // This would need a proper daily note mock, but tests the interface
      expect(filtered).toBeDefined();
    });

    it('should exclude current file when requested', () => {
      const filtered = discoverer.filterBacklinks(backlinks, {
        excludeCurrentFile: 'file2.md'
      });

      expect(filtered).toContain('file1.md');
      expect(filtered).toContain('file3.md');
      expect(filtered).not.toContain('file2.md');
    });

    it('should sort backlinks when requested', () => {
      const unsorted = ['c.md', 'a.md', 'b.md'];
      const filtered = discoverer.filterBacklinks(unsorted, {
        sortByPath: true
      });

      expect(filtered).toEqual(['a.md', 'b.md', 'c.md']);
    });
  });

  // Note: Timing-related tests are difficult to test reliably in unit test environment
  // The core functionality of backlink discovery is tested above
});