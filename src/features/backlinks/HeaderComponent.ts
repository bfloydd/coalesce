import { ThemeManager } from '../settings/ThemeManager';
import { Logger } from '../shared-utilities/Logger';
import { IconProvider } from '../shared-utilities/IconProvider';
import { HeaderStyleManager } from './header-styles/HeaderStyleManager';
import { BlockFinderFactory } from './block-finders/BlockFinderFactory';
import { HeaderStyleFactory } from './header-styles/HeaderStyleFactory';
import { Menu } from 'obsidian';
import { SettingsControls } from './SettingsControls';
import { createButton } from '../../shared/ui/Button';
import { createIconButton } from '../../shared/ui/IconButton';

export class HeaderComponent {
    private static currentHeaderStyle: string = HeaderStyleFactory.getValidStyles()[0];
    private resizeObserver: ResizeObserver | null = null;
    private observedContainer: HTMLElement | null = null;
    private settingsManager: any = null;
    private settingsControls: SettingsControls;

    // Current state for menu selections
    private currentHeaderStyleState: string = 'full';
    private currentStrategyState: string = 'default';
    private currentThemeState: string = 'default';

    // Change handlers
    private onHeaderStyleChangeHandler: (style: string) => void = () => {};
    private onStrategyChangeHandler: (strategy: string) => void = () => {};
    private onThemeChangeHandler: (theme: string) => void = () => {};

    constructor(private logger: Logger, settingsControls: SettingsControls) {
        this.settingsControls = settingsControls;
    }

    public setSettingsManager(settingsManager: any): void {
        this.settingsManager = settingsManager;
    }

    /**
     * Cleans up resources used by this component
     */
    public cleanup(): void {
        if (this.resizeObserver && this.observedContainer) {
            this.resizeObserver.unobserve(this.observedContainer);
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
            this.observedContainer = null;
        }
    }

    private applyResponsiveLayout(header: HTMLElement, container: HTMLElement): void {
        this.cleanup();
        
        this.observedContainer = container;
        
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                if (width < 450) {
                    header.classList.add('compact');
                } else {
                    header.classList.remove('compact');
                }
            }
        });
        
        const initialWidth = container.getBoundingClientRect().width;
        if (initialWidth < 450) {
            header.classList.add('compact');
        }
        
        this.resizeObserver.observe(container);
    }

    createHeader(
        container: HTMLElement,
        fileCount: number,
        sortDescending: boolean,
        onSortToggle: () => void,
        onCollapseToggle: () => void,
        isCollapsed: boolean,
        currentStrategy: string,
        onStrategyChange: (strategy: string) => void,
        currentTheme: string,
        onThemeChange: (theme: string) => void,
        showFullPathTitle: boolean,
        onFullPathTitleChange: (show: boolean) => void,
        aliases: string[] = [],
        onAliasSelect: (alias: string | null) => void,
        currentAlias: string | null = null,
        unsavedAliases: string[] = [],
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        onFilterChange: (filterText: string) => void = () => {},
        currentFilter: string = '',
        onRefresh: () => void = () => {}
    ): HTMLElement {
        HeaderComponent.currentHeaderStyle = currentHeaderStyle;

        // Initialize current state
        this.currentHeaderStyleState = currentHeaderStyle;
        this.currentStrategyState = currentStrategy;
        this.currentThemeState = currentTheme;

        // Store change handlers
        this.onHeaderStyleChangeHandler = onHeaderStyleChange;
        this.onStrategyChangeHandler = onStrategyChange;
        this.onThemeChangeHandler = onThemeChange;

        this.logger.debug("HeaderComponent aliases:", { count: aliases.length, aliases });

        const header = container.createDiv({ cls: 'coalesce-backlinks-header' });

        // Create wrapped change handlers that update state
        const wrappedHeaderStyleChange = (style: string) => {
            this.currentHeaderStyleState = style;
            HeaderComponent.currentHeaderStyle = style;
            this.onHeaderStyleChangeHandler(style);
        };

        const wrappedStrategyChange = (strategy: string) => {
            this.currentStrategyState = strategy;
            this.onStrategyChangeHandler(strategy);
        };

        const wrappedThemeChange = (theme: string) => {
            this.currentThemeState = theme;
            this.onThemeChangeHandler(theme);
        };

        const leftContainer = this.createLeftContainer(aliases, unsavedAliases, currentAlias, onAliasSelect, sortDescending, onSortToggle, isCollapsed, onCollapseToggle, onFilterChange, currentFilter, onRefresh);
        const rightContainer = this.createRightContainer(
            currentHeaderStyle,
            wrappedHeaderStyleChange,
            currentStrategy,
            wrappedStrategyChange,
            currentTheme,
            wrappedThemeChange
        );

        header.appendChild(leftContainer);
        header.appendChild(rightContainer);

        this.applyResponsiveLayout(header, container);

        return header;
    }

    private createLeftContainer(
        aliases: string[], 
        unsavedAliases: string[],
        currentAlias: string | null,
        onAliasSelect: (alias: string | null) => void,
        sortDescending: boolean,
        onSortToggle: () => void,
        isCollapsed: boolean,
        onCollapseToggle: () => void,
        onFilterChange: (filterText: string) => void,
        currentFilter: string = '',
        onRefresh: () => void = () => {}
    ): HTMLElement {
        // Create a temporary container to use createDiv
        const tempContainer = document.createElement('div');
        const leftContainer = tempContainer.createDiv({ cls: 'coalesce-backlinks-header-left' });

        // Create and add coalesce icon
        const svg = this.createCoalesceIcon();
        
        // Create alias dropdown
        const aliasDropdown = this.createAliasDropdown(aliases, unsavedAliases, currentAlias, onAliasSelect);

        // Create filter input
        const filterInput = this.createFilterInput(onFilterChange, currentFilter);

        // Create button group
        const buttonGroup = this.createButtonGroup(sortDescending, onSortToggle, isCollapsed, onCollapseToggle, onRefresh);

        // Add elements in order
        leftContainer.appendChild(svg);
        leftContainer.appendChild(aliasDropdown);
        leftContainer.appendChild(filterInput);
        leftContainer.appendChild(buttonGroup);

        return leftContainer;
    }

    private createCoalesceIcon(): SVGSVGElement {
        // Create a temporary container to use createSvg
        const tempContainer = document.createElement('div');
        const svg = tempContainer.createSvg('svg', {
            attr: {
                viewBox: "0 0 200 200",
                width: "36",
                height: "36",
                fill: "currentColor"
            }
        });
        
        // Create background circle for contrast and premium look
        const background = tempContainer.createSvg('circle', {
            attr: {
                cx: "100",
                cy: "100", 
                r: "95",
                fill: "currentColor",
                opacity: "0.08"
            }
        });
        
        // Create the central hexagon - now uses currentColor with opacity for theme adaptation
        const hexagon = tempContainer.createSvg('polygon', {
            attr: {
                points: "70,100 85,75 115,75 130,100 115,125 85,125",
                fill: "currentColor",
                opacity: "0.9"
            }
        });
        
        // Create diagonal arrows group - now uses currentColor with reduced opacity
        const arrowGroup = tempContainer.createSvg('g', {
            attr: {
                fill: "currentColor",
                opacity: "0.7"
            }
        });
        
        // Top-left arrow
        const topLeftArrow = tempContainer.createSvg('polygon', {
            attr: {
                points: "42,58 50,50 64,64 70,58 75,82 50,72 57,66"
            }
        });
        
        // Top-right arrow
        const topRightArrow = tempContainer.createSvg('polygon', {
            attr: {
                points: "158,58 150,50 136,64 130,58 125,82 150,72 143,66"
            }
        });
        
        // Bottom-left arrow
        const bottomLeftArrow = tempContainer.createSvg('polygon', {
            attr: {
                points: "42,142 50,150 64,136 70,142 75,118 50,128 57,134"
            }
        });
        
        // Bottom-right arrow
        const bottomRightArrow = tempContainer.createSvg('polygon', {
            attr: {
                points: "158,142 150,150 136,136 130,142 125,118 150,128 143,134"
            }
        });
        
        // Add subtle inner glow effect for premium look
        const innerGlow = tempContainer.createSvg('circle', {
            attr: {
                cx: "100",
                cy: "100",
                r: "85",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "1",
                opacity: "0.15"
            }
        });
        
        svg.appendChild(background);
        svg.appendChild(innerGlow);
        svg.appendChild(hexagon);
        arrowGroup.appendChild(topLeftArrow);
        arrowGroup.appendChild(topRightArrow);
        arrowGroup.appendChild(bottomLeftArrow);
        arrowGroup.appendChild(bottomRightArrow);
        svg.appendChild(arrowGroup);
        
        return svg;
    }

    private createAliasDropdown(
        aliases: string[],
        unsavedAliases: string[],
        currentAlias: string | null,
        onAliasSelect: (alias: string | null) => void
    ): HTMLSelectElement {
        const aliasDropdown = document.createElement('select');
        aliasDropdown.classList.add('coalesce-alias-dropdown');

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All content';
        aliasDropdown.appendChild(defaultOption);

        // Add saved aliases if they exist
        if (aliases.length > 0) {
            this.addAliasesToDropdown(aliasDropdown, aliases, currentAlias);
        }

        // Add unsaved aliases if they exist
        if (unsavedAliases.length > 0) {
            this.addUnsavedAliasesToDropdown(aliasDropdown, unsavedAliases, currentAlias);
        }

        // Always enable dropdown to allow selection of "All content"
        // aliasDropdown.disabled = aliases.length === 0 && unsavedAliases.length === 0;

        aliasDropdown.addEventListener('change', (e) => {
            const selectedAlias = (e.target as HTMLSelectElement).value;
            onAliasSelect(selectedAlias || null);
        });

        return aliasDropdown;
    }

    private addAliasesToDropdown(dropdown: HTMLSelectElement, aliases: string[], currentAlias: string | null): void {
        aliases.forEach(alias => {
            const option = document.createElement('option');
            option.value = alias;
            option.textContent = alias;
            if (currentAlias === alias) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });
    }

    private addUnsavedAliasesToDropdown(dropdown: HTMLSelectElement, unsavedAliases: string[], currentAlias: string | null): void {
        // Add separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '-- unsaved aliases --';
        dropdown.appendChild(separator);

        // Add unsaved aliases
        unsavedAliases.forEach(alias => {
            const option = document.createElement('option');
            option.value = alias;
            option.textContent = alias;
            if (currentAlias === alias) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });
    }

    private createButtonGroup(
        sortDescending: boolean,
        onSortToggle: () => void,
        isCollapsed: boolean,
        onCollapseToggle: () => void,
        onRefresh: () => void = () => {}
    ): HTMLElement {
        // Create a temporary container to use createDiv
        const tempContainer = document.createElement('div');
        const buttonGroup = tempContainer.createDiv({ cls: 'coalesce-button-group' });
        
        // Create sort button
        const sortButton = this.createSortButton(sortDescending, onSortToggle);
        
        // Create collapse button
        const collapseButton = this.createCollapseButton(isCollapsed, onCollapseToggle);
        
        // Create refresh button
        const refreshButton = this.createRefreshButton(onRefresh);
        
        buttonGroup.appendChild(sortButton);
        buttonGroup.appendChild(collapseButton);
        buttonGroup.appendChild(refreshButton);
        
        return buttonGroup;
    }

    private createSortButton(sortDescending: boolean, onSortToggle: () => void): HTMLElement {
        const tempContainer = document.createElement('div');

        const sortButton = createButton({
            parent: tempContainer,
            label: sortDescending ? 'Descending' : 'Ascending',
            ariaLabel: sortDescending ? 'Descending' : 'Ascending',
            icon: 'sort',
            iconSize: 'sm',
            variant: 'ghost',
            onClick: onSortToggle,
            classes: ['coalesce-sort-button']
        });

        const svg = sortButton.querySelector('svg') as SVGElement | null;
        if (svg) {
            if (sortDescending) {
                svg.classList.add('sort-descending');
                svg.classList.remove('sort-ascending');
            } else {
                svg.classList.add('sort-ascending');
                svg.classList.remove('sort-descending');
            }
        }

        return sortButton;
    }

    private createCollapseButton(isCollapsed: boolean, onCollapseToggle: () => void): HTMLElement {
        const tempContainer = document.createElement('div');

        const collapseButton = createIconButton({
            parent: tempContainer,
            icon: 'chevronDown',
            size: 'sm',
            ariaLabel: isCollapsed ? 'Expand all' : 'Collapse all',
            classes: ['coalesce-collapse-button'],
            onClick: onCollapseToggle
        });

        const svg = collapseButton.querySelector('svg') as SVGElement | null;
        if (svg) {
            if (isCollapsed) {
                svg.classList.add('is-collapsed');
            } else {
                svg.classList.remove('is-collapsed');
            }
        }

        return collapseButton;
    }

    private createRefreshButton(onRefresh: () => void): HTMLElement {
        const tempContainer = document.createElement('div');

        const refreshButton = createIconButton({
            parent: tempContainer,
            icon: 'refresh',
            size: 'sm',
            ariaLabel: 'Refresh',
            classes: ['coalesce-refresh-button'],
            onClick: onRefresh
        });

        return refreshButton;
    }

    private createFilterInput(onFilterChange: (filterText: string) => void, initialValue: string = ''): HTMLElement {
        const container = document.createElement('div');
        container.classList.add('coalesce-filter-input-container');
        
        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter...';
        filterInput.classList.add('coalesce-filter-input');
        
        if (initialValue) {
            filterInput.value = initialValue;
            container.classList.add('has-value');
        }
        
        const clearButton = document.createElement('button');
        clearButton.classList.add('coalesce-filter-clear-button');
        clearButton.setAttribute('type', 'button');
        clearButton.setAttribute('aria-label', 'Clear filter');
        
        clearButton.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 2L8 8M8 2L2 8"/>
            </svg>
        `;
        
        let debounceTimeout: NodeJS.Timeout;
        let lastValue = initialValue;
        
        filterInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const filterText = target.value;
            
            if (filterText) {
                container.classList.add('has-value');
            } else {
                container.classList.remove('has-value');
            }
            
            if (filterText !== lastValue) {
                lastValue = filterText;
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    onFilterChange(filterText.toLowerCase());
                }, 100);
            }
        });
        
        clearButton.addEventListener('click', () => {
            filterInput.value = '';
            filterInput.focus();
            container.classList.remove('has-value');
            onFilterChange('');
        });
        
        container.appendChild(filterInput);
        container.appendChild(clearButton);
        
        return container;
    }

    public focusFilterInput(header: HTMLElement): boolean {
        const filterInput = header.querySelector('.coalesce-filter-input') as HTMLInputElement;
        
        this.logger.debug("Focusing filter input", {
            hasHeader: !!header,
            hasFilterInput: !!filterInput,
            filterInputVisible: filterInput ? filterInput.offsetParent !== null : false,
            filterInputValue: filterInput ? filterInput.value : null
        });
        
        if (filterInput && filterInput.offsetParent !== null) {
            requestAnimationFrame(() => {
                if (filterInput.offsetWidth > 0 && filterInput.offsetHeight > 0) {
                    filterInput.focus();
                    this.logger.debug("Filter input focused successfully");
                } else {
                    this.logger.debug("Filter input exists but has no dimensions", {
                        offsetWidth: filterInput.offsetWidth,
                        offsetHeight: filterInput.offsetHeight
                    });
                }
            });
            return true;
        } else {
            this.logger.debug("Filter input not found or not visible", {
                filterInputExists: !!filterInput,
                offsetParent: filterInput ? filterInput.offsetParent : null
            });
            return false;
        }
    }

    private createRightContainer(
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLElement {
        // Create a temporary container to use createDiv
        const tempContainer = document.createElement('div');
        const rightContainer = tempContainer.createDiv({ cls: 'coalesce-backlinks-header-right' });

        // Add settings button to right container
        const settingsButton = this.createSettingsButton(
            currentHeaderStyle,
            onHeaderStyleChange,
            currentStrategy,
            onStrategyChange,
            currentTheme,
            onThemeChange
        );
        
        rightContainer.appendChild(settingsButton);
        
        return rightContainer;
    }

    private createSettingsButton(
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLElement {
        const tempContainer = document.createElement('div');

        const handleSettingsClick = (e: MouseEvent) => {
            e.stopPropagation(); // Prevent body click from being triggered immediately

            const menu = this.createSettingsMenu();
            menu.showAtMouseEvent(e);
        };

        const settingsButton = createIconButton({
            parent: tempContainer,
            icon: 'settings',
            size: 'sm',
            ariaLabel: 'Settings',
            classes: ['coalesce-settings-button'],
            onClick: handleSettingsClick
        });

        return settingsButton;
    }

    private createSettingsMenu(): Menu {
        // Create the main menu
        const menu = new Menu();

        // Add Header section
        menu.addItem((item) =>
            item
                .setTitle('Header Style')
                .setIcon('heading')
        );
        this.addHeaderStyleMenuItems(menu);

        menu.addSeparator();

        // Add Block section
        menu.addItem((item) =>
            item
                .setTitle('Block Strategy')
                .setIcon('blocks')
        );
        this.addBlockStyleMenuItems(menu);

        menu.addSeparator();

        // Add Theme section
        menu.addItem((item) =>
            item
                .setTitle('Theme')
                .setIcon('palette')
        );
        this.addThemeMenuItems(menu);

        return menu;
    }






    private addHeaderStyleMenuItems(menu: Menu): void {
        // Get available header styles dynamically from HeaderStyleFactory
        const validStyles = HeaderStyleFactory.getValidStyles();
        const styleLabels = HeaderStyleFactory.getStyleLabels();

        validStyles.forEach(style => {
            const isSelected = style === this.currentHeaderStyleState;
            menu.addItem((item) =>
                item
                    .setTitle(styleLabels[style] || style)
                    .setIcon(isSelected ? 'check-circle' : 'circle')
                    .onClick(() => {
                        // Update stored state and call change handler
                        this.currentHeaderStyleState = style;
                        HeaderComponent.currentHeaderStyle = style;
                        this.onHeaderStyleChangeHandler(style);
                    })
            );
        });
    }

    private addBlockStyleMenuItems(menu: Menu): void {
        // Get available block styles dynamically from BlockFinderFactory
        const validStrategies = BlockFinderFactory.getValidStrategies();
        const strategyLabels = BlockFinderFactory.getStrategyLabels();

        validStrategies.forEach(strategyId => {
            const isSelected = strategyId === this.currentStrategyState;
            menu.addItem((item) =>
                item
                    .setTitle(strategyLabels[strategyId] || strategyId)
                    .setIcon(isSelected ? 'check-circle' : 'circle')
                    .onClick(() => {
                        // Update stored state and call change handler
                        this.currentStrategyState = strategyId;
                        this.onStrategyChangeHandler(strategyId);
                    })
            );
        });
    }

    private addThemeMenuItems(menu: Menu): void {
        // Define themes
        const themes = [
            { id: 'default', label: 'Default' },
            { id: 'modern', label: 'Modern' },
            { id: 'compact', label: 'Compact' },
            { id: 'naked', label: 'Naked' }
        ];

        themes.forEach(theme => {
            const isSelected = theme.id === this.currentThemeState;
            menu.addItem((item) =>
                item
                    .setTitle(theme.label)
                    .setIcon(isSelected ? 'check-circle' : 'circle')
                    .onClick(() => {
                        // Update stored state and call change handler
                        this.currentThemeState = theme.id;
                        this.onThemeChangeHandler(theme.id);
                    })
            );
        });
    }


}
