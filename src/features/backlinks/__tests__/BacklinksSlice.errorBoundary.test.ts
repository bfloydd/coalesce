import { BacklinksSlice } from '../BacklinksSlice';
import { App, MarkdownView, TFile } from 'obsidian';

describe('BacklinksSlice error boundaries', () => {
  let mockApp: jest.Mocked<App>;
  let slice: BacklinksSlice;

  beforeEach(() => {
    mockApp = {
      metadataCache: {
        resolvedLinks: {},
        unresolvedLinks: {},
        getCache: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      vault: {
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        create: jest.fn(),
        modify: jest.fn(),
        delete: jest.fn()
      },
      workspace: {
        getActiveViewOfType: jest.fn(),
        getLeavesOfType: jest.fn(),
        openLinkText: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        activeLeaf: { id: 'test-leaf' } as any
      }
    } as any;

    slice = new BacklinksSlice(mockApp);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('logs and rethrows errors from core.updateBacklinks via updateBacklinks()', async () => {
    const error = new Error('core failure');

    const core = (slice as any).core;
    const logger = (slice as any).logger;

    jest.spyOn(core, 'updateBacklinks').mockRejectedValue(error);
    const logSpy = jest.spyOn(logger, 'logErrorWithContext');

    await expect(slice.updateBacklinks('target.md')).rejects.toThrow(error);

    expect(logSpy).toHaveBeenCalledWith(error, 'updateBacklinks(target.md)');
  });

  it('logs and rethrows errors from viewController.attachToDOM via attachToDOM()', async () => {
    const error = new Error('view failure');

    const viewController = (slice as any).viewController;
    const logger = (slice as any).logger;

    jest.spyOn(viewController, 'attachToDOM').mockRejectedValue(error);
    const logSpy = jest.spyOn(logger, 'logErrorWithContext');

    const mockView: MarkdownView = {
      file: { path: 'target.md', basename: 'target' } as TFile,
      contentEl: document.createElement('div'),
      containerEl: document.createElement('div'),
      leaf: { id: 'test-leaf' } as any,
      getMode: jest.fn().mockReturnValue('preview'),
      on: jest.fn(),
      off: jest.fn()
    } as any;

    await expect(slice.attachToDOM(mockView, 'target.md', true)).rejects.toThrow(error);

    expect(logSpy).toHaveBeenCalledWith(error, 'attachToDOM(target.md)');
  });
});