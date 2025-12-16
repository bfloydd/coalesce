import { HeaderUI } from '../HeaderUI';
import { SettingsControls } from '../SettingsControls';
import { Logger } from '../../shared-utilities/Logger';
import { IconProvider } from '../../shared-utilities/IconProvider';
import type { HeaderState } from '../types';
import type { App } from 'obsidian';

describe('HeaderUI', () => {
  let headerUI: HeaderUI;
  let container: HTMLElement;
  let logger: Logger;

  const createDefaultOptions = () => ({
    fileCount: 0,
    sortDescending: true,
    isCollapsed: false,
    currentStrategy: 'default',
    currentTheme: 'default',
    showFullPathTitle: false,
    aliases: [] as string[],
    currentAlias: null as string | null,
    unsavedAliases: [] as string[],
    currentHeaderStyle: 'full' as const,
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
    onRefresh: jest.fn()
  });

  beforeAll(() => {
    // Provide a minimal ResizeObserver polyfill for JSDOM
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // Avoid depending on the real IconProvider DOM behaviour in unit tests
    jest.spyOn(IconProvider, 'updateIconClasses').mockImplementation(() => {});
  });

  afterAll(() => {
    (IconProvider.updateIconClasses as jest.Mock).mockRestore();
    delete (global as any).ResizeObserver;
  });

  beforeEach(() => {
    container = document.createElement('div');
    logger = new Logger('HeaderUI.test');
    const app = {} as App;
    const settingsControls = new SettingsControls(logger);
    headerUI = new HeaderUI(app, logger, settingsControls);
  });

  it('creates a header element with core controls present', () => {
    const options = createDefaultOptions();

    const header = headerUI.createHeader(container, options);

    expect(header).toBeTruthy();
    expect(container.contains(header)).toBe(true);

    // Structural expectations
    expect(header.classList.contains('coalesce-backlinks-header')).toBe(true);
    expect(header.querySelector('.coalesce-sort-button')).not.toBeNull();
    expect(header.querySelector('.coalesce-collapse-button')).not.toBeNull();
    expect(header.querySelector('.coalesce-settings-button')).not.toBeNull();
  });

  it('applies compact and collapsed state via updateHeader', () => {
    const options = createDefaultOptions();
    const header = headerUI.createHeader(container, options);

    const state: HeaderState = {
      fileCount: 3,
      sortByPath: true,
      sortDescending: false,
      isCollapsed: true,
      currentStrategy: 'default',
      currentTheme: 'default',
      showFullPathTitle: false,
      currentAlias: null,
      currentHeaderStyle: 'full',
      currentFilter: '',
      isCompact: true
    };

    headerUI.updateHeader(header, state);

    // Compact class should be applied
    expect(header.classList.contains('compact')).toBe(true);

    // Sort button aria-label reflects ascending when sortDescending is false
    const sortButton = header.querySelector('.coalesce-sort-button') as HTMLElement;
    expect(sortButton).not.toBeNull();
    expect(sortButton.getAttribute('aria-label')).toBe('Ascending');
  });

  it('focusFilterInput returns a boolean and does not throw', () => {
    const options = createDefaultOptions();
    const header = headerUI.createHeader(container, options);

    const result = headerUI.focusFilterInput(header);

    expect(typeof result).toBe('boolean');
  });
});