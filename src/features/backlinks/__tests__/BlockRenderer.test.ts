import { BlockRenderer } from '../BlockRenderer';
import { BlockData } from '../types';
import { Logger } from '../../shared-utilities/Logger';
import type { App } from 'obsidian';

// Mock BlockComponent so tests don't depend on real Markdown rendering or Obsidian internals
jest.mock('../BlockComponent', () => {
  return {
    BlockComponent: jest.fn().mockImplementation(() => ({
      render: jest.fn().mockResolvedValue(undefined),
      getContainer: jest.fn().mockReturnValue(document.createElement('div')),
      setCollapsed: jest.fn(),
      updateTitleDisplay: jest.fn(),
      getTitle: jest.fn().mockReturnValue('Mock Title')
    }))
  };
});

describe('BlockRenderer', () => {
  let renderer: BlockRenderer;
  let container: HTMLElement;

  const makeBlock = (id: string, content: string, sourcePath = 'source.md'): BlockData => ({
    id,
    content,
    sourcePath,
    startLine: 1,
    endLine: 1,
    isCollapsed: false,
    isVisible: true,
    hasBacklinkLine: false
  });

  beforeEach(() => {
    const app = {} as App;
    const logger = new Logger('BlockRenderer.test');
    renderer = new BlockRenderer(app, logger);
    container = document.createElement('div');
    // Obsidian extends HTMLElement with .empty(); provide a simple stub for tests
    (container as any).empty = jest.fn(() => {
      container.innerHTML = '';
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renderBlocks updates statistics for rendered blocks', async () => {
    const blocks = [makeBlock('a', 'content-a'), makeBlock('b', 'content-b')];

    await renderer.renderBlocks(
      container,
      blocks,
      {
        headerStyle: 'full',
        hideBacklinkLine: false,
        hideFirstHeader: false,
        showFullPathTitle: false,
        collapsed: false,
        sortByPath: false,
        sortDescending: true
      },
      'note'
    );

    const stats = renderer.getStatistics();
    expect(stats.totalBlocksRendered).toBe(2);
    expect(stats.totalRenders).toBe(1);
    expect(stats.averageRenderTime).toBeGreaterThanOrEqual(0);
  });

  it('updateBlockVisibility toggles visible/hidden classes and updates BlockData', () => {
    const block = makeBlock('a', 'content-a');
    const blockContainer = document.createElement('div');
    const blockComponentMock = {
      getContainer: jest.fn().mockReturnValue(blockContainer)
    };

    (renderer as any).renderedBlocks.set(block.id, blockComponentMock);

    renderer.updateBlockVisibility([block], true);
    expect(blockContainer.classList.contains('visible')).toBe(true);
    expect(blockContainer.classList.contains('hidden')).toBe(false);
    expect(block.isVisible).toBe(true);

    renderer.updateBlockVisibility([block], false);
    expect(blockContainer.classList.contains('hidden')).toBe(true);
    expect(blockContainer.classList.contains('visible')).toBe(false);
    expect(block.isVisible).toBe(false);
  });

  it('updateBlockCollapsedState calls setCollapsed on components and updates BlockData', () => {
    const block = makeBlock('a', 'content-a');
    const blockComponentMock = {
      setCollapsed: jest.fn()
    };

    (renderer as any).renderedBlocks.set(block.id, blockComponentMock);

    renderer.updateBlockCollapsedState([block], true);
    expect(blockComponentMock.setCollapsed).toHaveBeenCalledWith(true);
    expect(block.isCollapsed).toBe(true);

    renderer.updateBlockCollapsedState([block], false);
    expect(blockComponentMock.setCollapsed).toHaveBeenCalledWith(false);
    expect(block.isCollapsed).toBe(false);
  });

  it('filterBlocksByText marks matching and non-matching blocks via classes', () => {
    const matchingBlock = makeBlock('a', 'This content matches filter');
    const nonMatchingBlock = makeBlock('b', 'Other content');

    const matchingContainer = document.createElement('div');
    const nonMatchingContainer = document.createElement('div');

    const matchingComponent = {
      getContainer: jest.fn().mockReturnValue(matchingContainer),
      getTitle: jest.fn().mockReturnValue('Matching title')
    };
    const nonMatchingComponent = {
      getContainer: jest.fn().mockReturnValue(nonMatchingContainer),
      getTitle: jest.fn().mockReturnValue('Irrelevant title')
    };

    (renderer as any).renderedBlocks.set(matchingBlock.id, matchingComponent);
    (renderer as any).renderedBlocks.set(nonMatchingBlock.id, nonMatchingComponent);

    renderer.filterBlocksByText([matchingBlock, nonMatchingBlock], 'matches');

    expect(matchingContainer.classList.contains('has-alias')).toBe(true);
    expect(matchingContainer.classList.contains('no-alias')).toBe(false);

    expect(nonMatchingContainer.classList.contains('no-alias')).toBe(true);
    expect(nonMatchingContainer.classList.contains('has-alias')).toBe(false);
  });

  it('filterBlocksByAlias uses content and current note name to toggle classes', () => {
    const currentNoteName = 'NoteA';

    const withAliasContent = 'Some text [[NoteA|alias1|alias2]] more text';
    const withoutAliasContent = 'Some text without alias for this note';

    const withAliasBlock = makeBlock('a', withAliasContent);
    const withoutAliasBlock = makeBlock('b', withoutAliasContent);

    const withAliasContainer = document.createElement('div');
    const withoutAliasContainer = document.createElement('div');

    const withAliasComponent = {
      getContainer: jest.fn().mockReturnValue(withAliasContainer)
    };
    const withoutAliasComponent = {
      getContainer: jest.fn().mockReturnValue(withoutAliasContainer)
    };

    (renderer as any).renderedBlocks.set(withAliasBlock.id, withAliasComponent);
    (renderer as any).renderedBlocks.set(withoutAliasBlock.id, withoutAliasComponent);

    renderer.filterBlocksByAlias(
      [withAliasBlock, withoutAliasBlock],
      'alias1',
      currentNoteName
    );

    expect(withAliasContainer.classList.contains('has-alias')).toBe(true);
    expect(withAliasContainer.classList.contains('no-alias')).toBe(false);

    expect(withoutAliasContainer.classList.contains('no-alias')).toBe(true);
    expect(withoutAliasContainer.classList.contains('has-alias')).toBe(false);
  });

  it('resetStatistics and cleanup clear internal state', () => {
    const block = makeBlock('a', 'content-a');
    const blockContainer = document.createElement('div');
    const blockComponentMock = {
      getContainer: jest.fn().mockReturnValue(blockContainer)
    };

    (renderer as any).renderedBlocks.set(block.id, blockComponentMock);

    renderer.resetStatistics();
    const stats = renderer.getStatistics();
    expect(stats.totalBlocksRendered).toBe(0);
    expect(stats.totalRenders).toBe(0);

    renderer.cleanup();
    expect((renderer as any).renderedBlocks.size).toBe(0);
  });
});