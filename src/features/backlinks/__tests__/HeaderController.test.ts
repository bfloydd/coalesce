import { HeaderController } from '../ui/HeaderController';
import type { HeaderCreateOptions, HeaderState } from '../types';
import { Logger } from '../../shared-utilities/Logger';
import type { HeaderUI } from '../HeaderUI';

describe('HeaderController', () => {
  let logger: Logger;
  let headerController: HeaderController;
  let headerUICreateHeaderMock: jest.Mock;
  let headerUIUpdateHeaderMock: jest.Mock;
  let headerUI: HeaderUI;
  let container: HTMLElement;

  const createHeaderOptions = (
    overrides: Partial<HeaderCreateOptions> = {}
  ): HeaderCreateOptions => ({
    fileCount: 0,
    sortDescending: true,
    isCollapsed: false,
    currentStrategy: 'default',
    currentTheme: 'default',
    showFullPathTitle: false,
    aliases: [],
    currentAlias: null,
    unsavedAliases: [],
    currentHeaderStyle: 'full',
    currentFilter: '',
    onSortToggle: jest.fn(),
    onCollapseToggle: jest.fn(),
    onStrategyChange: jest.fn(),
    onThemeChange: jest.fn(),
    onFullPathTitleChange: jest.fn(),
    onAliasSelect: jest.fn(),
    onHeaderStyleChange: jest.fn(),
    onFilterChange: jest.fn(),
    onSettingsClick: jest.fn(),
    onRefresh: jest.fn(),
    ...overrides
  });

  beforeEach(() => {
    logger = new Logger('HeaderController.test');

    headerUICreateHeaderMock = jest.fn((parent: HTMLElement, _options: HeaderCreateOptions) => {
      const header = document.createElement('div');
      header.className = 'coalesce-backlinks-header';
      parent.appendChild(header);
      return header;
    });

    headerUIUpdateHeaderMock = jest.fn(
      (_header: HTMLElement, _state: HeaderState) => {}
    );

    const fakeHeaderUI = {
      createHeader: headerUICreateHeaderMock,
      updateHeader: headerUIUpdateHeaderMock
    } as unknown as HeaderUI;

    headerUI = fakeHeaderUI;
    headerController = new HeaderController(logger, headerUI);
    container = document.createElement('div');
  });

  it('exposes sensible defaults for initial state and statistics', () => {
    const state = headerController.getHeaderState();

    expect(state.fileCount).toBe(0);
    expect(state.sortByPath).toBe(false);
    expect(state.sortDescending).toBe(true);
    expect(state.isCollapsed).toBe(false);
    expect(state.currentStrategy).toBe('default');
    expect(state.currentTheme).toBe('default');
    expect(state.currentHeaderStyle).toBe('full');
    expect(state.currentAlias).toBeNull();
    expect(state.currentFilter).toBe('');

    const stats = headerController.getStatistics();
    expect(stats.totalHeadersCreated).toBe(0);
    expect(stats.totalSortToggles).toBe(0);
    expect(stats.totalCollapseToggles).toBe(0);
    expect(stats.totalStrategyChanges).toBe(0);
    expect(stats.totalThemeChanges).toBe(0);
    expect(stats.totalAliasSelections).toBe(0);
    expect(stats.totalFilterChanges).toBe(0);
  });

  it('creates a header via HeaderUI and updates statistics', () => {
    const options = createHeaderOptions({ fileCount: 3 });

    const header = headerController.createHeader(container, options);

    expect(headerUICreateHeaderMock).toHaveBeenCalledTimes(1);
    expect(container.contains(header)).toBe(true);

    const stats = headerController.getStatistics();
    expect(stats.totalHeadersCreated).toBe(1);
    expect(headerUIUpdateHeaderMock).toHaveBeenCalledTimes(1);
  });

  it('toggles sort direction and records statistics', () => {
    const initial = headerController.getHeaderState();
    expect(initial.sortDescending).toBe(true);

    const afterFirst = headerController.toggleSort();
    expect(afterFirst.sortDescending).toBe(false);

    const afterSecond = headerController.toggleSort();
    expect(afterSecond.sortDescending).toBe(true);

    const stats = headerController.getStatistics();
    expect(stats.totalSortToggles).toBe(2);
    expect(stats.lastSortToggle).toBeInstanceOf(Date);
  });

  it('toggles collapse state and records statistics', () => {
    const initial = headerController.getHeaderState();
    expect(initial.isCollapsed).toBe(false);

    const afterFirst = headerController.toggleCollapse();
    expect(afterFirst.isCollapsed).toBe(true);

    const afterSecond = headerController.toggleCollapse();
    expect(afterSecond.isCollapsed).toBe(false);

    const stats = headerController.getStatistics();
    expect(stats.totalCollapseToggles).toBe(2);
    expect(stats.lastCollapseToggle).toBeInstanceOf(Date);
  });

  it('updates strategy, theme, header style, alias and filter', () => {
    const afterStrategy = headerController.changeStrategy('headers-only');
    expect(afterStrategy.currentStrategy).toBe('headers-only');

    const afterTheme = headerController.changeTheme('compact');
    expect(afterTheme.currentTheme).toBe('compact');

    const afterStyle = headerController.changeHeaderStyle('short');
    expect(afterStyle.currentHeaderStyle).toBe('short');

    const afterAlias = headerController.selectAlias('Alias A');
    expect(afterAlias.currentAlias).toBe('Alias A');

    const afterFilter = headerController.changeFilter('foo');
    expect(afterFilter.currentFilter).toBe('foo');

    const stats = headerController.getStatistics();
    expect(stats.totalStrategyChanges).toBe(1);
    expect(stats.totalThemeChanges).toBe(1);
    expect(stats.totalHeaderStyleChanges).toBe(1);
    expect(stats.totalAliasSelections).toBe(1);
    expect(stats.totalFilterChanges).toBe(1);
  });

  it('merges state from options via updateStateFromOptions', () => {
    const updated = headerController.updateStateFromOptions({
      sort: true,
      collapsed: true,
      strategy: 'headers-only',
      theme: 'compact',
      alias: 'Alias A',
      filter: 'bar'
    });

    expect(updated.sortByPath).toBe(true);
    expect(updated.isCollapsed).toBe(true);
    expect(updated.currentStrategy).toBe('headers-only');
    expect(updated.currentTheme).toBe('compact');
    expect(updated.currentAlias).toBe('Alias A');
    expect(updated.currentFilter).toBe('bar');
  });

  it('resets state and statistics to defaults', () => {
    headerController.changeStrategy('headers-only');
    headerController.changeTheme('compact');
    headerController.toggleSort();
    headerController.toggleCollapse();

    headerController.reset();

    const state = headerController.getHeaderState();
    expect(state.sortByPath).toBe(false);
    expect(state.sortDescending).toBe(true);
    expect(state.isCollapsed).toBe(false);
    expect(state.currentStrategy).toBe('default');
    expect(state.currentTheme).toBe('default');

    const stats = headerController.getStatistics();
    expect(stats.totalHeadersCreated).toBe(0);
    expect(stats.totalSortToggles).toBe(0);
    expect(stats.totalCollapseToggles).toBe(0);
    expect(stats.totalStrategyChanges).toBe(0);
    expect(stats.totalThemeChanges).toBe(0);
  });
});