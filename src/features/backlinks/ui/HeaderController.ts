import { Logger } from '../../shared-utilities/Logger';
import { HeaderUI } from '../HeaderUI';
import { HeaderCreateOptions, HeaderState, HeaderStatistics } from '../types';

/**
 * HeaderController
 *
 * Owns header state and statistics for the backlinks UI.
 * Delegates DOM creation and low-level updates to HeaderUI.
 *
 * Responsibilities:
 * - Maintain HeaderState as the single source of truth for header options
 * - Track HeaderStatistics for user interactions
 * - Provide helpers used by BacklinksViewController to react to header events
 */
export class HeaderController {
    private readonly logger: Logger;
    private readonly headerUI: HeaderUI;

    private currentHeaderState: HeaderState;
    private headerStatistics: HeaderStatistics;

    constructor(logger: Logger, headerUI: HeaderUI) {
        this.logger = logger.child('HeaderController');
        this.headerUI = headerUI;

        this.currentHeaderState = {
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

        this.logger.debug('HeaderController initialized', {
            state: this.currentHeaderState
        });
    }

    /**
     * Create the header element and synchronize initial state.
     *
     * The provided options may contain persisted user preferences
     * (fileCount, aliases, currentTheme, etc.). Sort/collapse related
     * fields are normalized from the internal HeaderState so that
     * header state remains the single source of truth.
     */
    createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement {
        this.logger.debug('HeaderController.createHeader', { options });

        // Synchronize state from options while preserving sort preferences
        this.currentHeaderState = {
            ...this.currentHeaderState,
            fileCount: options.fileCount,
            isCollapsed: options.isCollapsed,
            currentStrategy: options.currentStrategy,
            currentTheme: options.currentTheme,
            showFullPathTitle: options.showFullPathTitle,
            currentAlias: options.currentAlias,
            currentHeaderStyle: options.currentHeaderStyle,
            currentFilter: options.currentFilter
        };

        const header = this.headerUI.createHeader(container, {
            ...options,
            sortDescending: this.currentHeaderState.sortDescending,
            isCollapsed: this.currentHeaderState.isCollapsed
        });

        this.headerStatistics.totalHeadersCreated += 1;

        // Apply initial visual state to the header controls
        this.headerUI.updateHeader(header, this.currentHeaderState);

        this.logger.debug('HeaderController header created', {
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return header;
    }

    /**
     * Toggle sort state (ascending/descending and ensure sortByPath is enabled).
     */
    toggleSort(): HeaderState {
        this.headerStatistics.totalSortToggles += 1;
        this.headerStatistics.lastSortToggle = new Date();

        this.currentHeaderState = {
            ...this.currentHeaderState,
            sortByPath: true,
            sortDescending: !this.currentHeaderState.sortDescending
        };

        this.logger.debug('HeaderController.toggleSort', {
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Toggle collapse state for all blocks.
     */
    toggleCollapse(): HeaderState {
        this.headerStatistics.totalCollapseToggles += 1;
        this.headerStatistics.lastCollapseToggle = new Date();

        this.currentHeaderState = {
            ...this.currentHeaderState,
            isCollapsed: !this.currentHeaderState.isCollapsed
        };

        this.logger.debug('HeaderController.toggleCollapse', {
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Change current strategy.
     */
    changeStrategy(strategy: string): HeaderState {
        if (this.currentHeaderState.currentStrategy !== strategy) {
            this.headerStatistics.totalStrategyChanges += 1;
            this.headerStatistics.lastStrategyChange = new Date();
        }

        this.currentHeaderState = {
            ...this.currentHeaderState,
            currentStrategy: strategy
        };

        this.logger.debug('HeaderController.changeStrategy', {
            strategy,
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Change current theme.
     */
    changeTheme(theme: string): HeaderState {
        if (this.currentHeaderState.currentTheme !== theme) {
            this.headerStatistics.totalThemeChanges += 1;
            this.headerStatistics.lastThemeChange = new Date();
        }

        this.currentHeaderState = {
            ...this.currentHeaderState,
            currentTheme: theme
        };

        this.logger.debug('HeaderController.changeTheme', {
            theme,
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Change header style (full/short/etc.).
     */
    changeHeaderStyle(style: string): HeaderState {
        if (this.currentHeaderState.currentHeaderStyle !== style) {
            this.headerStatistics.totalHeaderStyleChanges += 1;
            this.headerStatistics.lastHeaderStyleChange = new Date();
        }

        this.currentHeaderState = {
            ...this.currentHeaderState,
            currentHeaderStyle: style
        };

        this.logger.debug('HeaderController.changeHeaderStyle', {
            style,
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Change whether the full path title is shown.
     */
    changeFullPathTitle(show: boolean): HeaderState {
        this.currentHeaderState = {
            ...this.currentHeaderState,
            showFullPathTitle: show
        };

        this.logger.debug('HeaderController.changeFullPathTitle', {
            show,
            state: this.currentHeaderState
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Select a specific alias (or clear selection with null).
     */
    selectAlias(alias: string | null): HeaderState {
        if (this.currentHeaderState.currentAlias !== alias) {
            this.headerStatistics.totalAliasSelections += 1;
            this.headerStatistics.lastAliasSelection = new Date();
        }

        this.currentHeaderState = {
            ...this.currentHeaderState,
            currentAlias: alias
        };

        this.logger.debug('HeaderController.selectAlias', {
            alias,
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Update filter text.
     */
    changeFilter(filterText: string): HeaderState {
        this.headerStatistics.totalFilterChanges += 1;
        this.headerStatistics.lastFilterChange = new Date();

        this.currentHeaderState = {
            ...this.currentHeaderState,
            currentFilter: filterText
        };

        this.logger.debug('HeaderController.changeFilter', {
            filterText,
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Record a settings button click.
     */
    settingsClicked(): HeaderState {
        this.headerStatistics.totalSettingsClicks += 1;
        this.headerStatistics.lastSettingsClick = new Date();

        this.logger.debug('HeaderController.settingsClicked', {
            state: this.currentHeaderState,
            statistics: this.headerStatistics
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Apply a partial update originating from external options
     * (e.g., persisted settings via BacklinksSlice.setOptions).
     */
    updateStateFromOptions(options: {
        sort?: boolean;
        sortDescending?: boolean;
        collapsed?: boolean;
        strategy?: string;
        theme?: string;
        alias?: string | null;
        filter?: string;
    }): HeaderState {
        this.logger.debug('HeaderController.updateStateFromOptions', { options });

        let updated = { ...this.currentHeaderState };

        if (options.sort !== undefined) {
            updated.sortByPath = options.sort;
        }

        if (options.sortDescending !== undefined) {
            updated.sortDescending = options.sortDescending;
        }

        if (options.collapsed !== undefined) {
            updated.isCollapsed = options.collapsed;
        }

        if (options.strategy !== undefined) {
            updated.currentStrategy = options.strategy;
        }

        if (options.theme !== undefined) {
            updated.currentTheme = options.theme;
        }

        if (options.alias !== undefined) {
            updated.currentAlias = options.alias;
        }

        if (options.filter !== undefined) {
            updated.currentFilter = options.filter;
        }

        this.currentHeaderState = updated;

        this.logger.debug('HeaderController.updateStateFromOptions.completed', {
            state: this.currentHeaderState
        });

        return { ...this.currentHeaderState };
    }

    /**
     * Get a copy of the current header state.
     */
    getHeaderState(): HeaderState {
        return { ...this.currentHeaderState };
    }

    /**
     * Get a copy of the current header statistics.
     */
    getStatistics(): HeaderStatistics {
        return { ...this.headerStatistics };
    }

    /**
     * Reset state and statistics to defaults.
     */
    reset(): void {
        this.logger.debug('HeaderController.reset');

        this.currentHeaderState = {
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