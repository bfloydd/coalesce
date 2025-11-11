import { ThemeManager } from '../ThemeManager';
import { Logger } from '../utils/Logger';
import { HeaderStyleManager } from '../header-styles/HeaderStyleManager';
import { BlockFinderFactory } from '../block-finders/BlockFinderFactory';
import { HeaderStyleFactory } from '../header-styles/HeaderStyleFactory';
import { setIcon, ButtonComponent, ExtraButtonComponent } from 'obsidian';

export class HeaderComponent {
    private static currentHeaderStyle: string = HeaderStyleFactory.getValidStyles()[0];
    private resizeObserver: ResizeObserver | null = null;
    private observedContainer: HTMLElement | null = null;
    private settingsManager: any = null;

    constructor(private logger: Logger) {}

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
        currentFilter: string = ''
    ): HTMLElement {
        HeaderComponent.currentHeaderStyle = currentHeaderStyle;

        this.logger.debug("HeaderComponent aliases:", { count: aliases.length, aliases });

        const header = container.createDiv({ cls: 'coalesce-backlinks-header' });

        const leftContainer = this.createLeftContainer(aliases, unsavedAliases, currentAlias, onAliasSelect, sortDescending, onSortToggle, isCollapsed, onCollapseToggle, onFilterChange, currentFilter);
        const rightContainer = this.createRightContainer(
            currentHeaderStyle, 
            onHeaderStyleChange,
            currentStrategy,
            onStrategyChange,
            currentTheme,
            onThemeChange
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
        currentFilter: string = ''
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
        const buttonGroup = this.createButtonGroup(sortDescending, onSortToggle, isCollapsed, onCollapseToggle);

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

        // Disable dropdown if no aliases at all
        aliasDropdown.disabled = aliases.length === 0 && unsavedAliases.length === 0;

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
        onCollapseToggle: () => void
    ): HTMLElement {
        // Create a temporary container to use createDiv
        const tempContainer = document.createElement('div');
        const buttonGroup = tempContainer.createDiv({ cls: 'coalesce-button-group' });
        
        // Create sort button
        const sortButton = this.createSortButton(sortDescending, onSortToggle);
        
        // Create collapse button
        const collapseButton = this.createCollapseButton(isCollapsed, onCollapseToggle);
        
        buttonGroup.appendChild(sortButton);
        buttonGroup.appendChild(collapseButton);
        
        return buttonGroup;
    }

    private createSortButton(sortDescending: boolean, onSortToggle: () => void): HTMLElement {
        // Create simple custom button with proper hover isolation
        const tempContainer = document.createElement('div');
        const sortButton = tempContainer.createEl('button', {
            cls: 'coalesce-sort-button',
            attr: { 
                'aria-label': sortDescending ? 'Sort ascending' : 'Sort descending',
                'type': 'button'
            }
        });
        
        // Use Obsidian's setIcon for the icon
        setIcon(sortButton, 'arrow-up-down');
        
        // Add classes for custom rotation based on state
        const svg = sortButton.querySelector('svg');
        if (svg) {
            if (sortDescending) {
                svg.classList.add('sort-descending');
                svg.classList.remove('sort-ascending');
            } else {
                svg.classList.add('sort-ascending'); 
                svg.classList.remove('sort-descending');
            }
        }
        
        // Add click handler
        sortButton.addEventListener('click', onSortToggle);
        
        return sortButton;
    }

    private createCollapseButton(isCollapsed: boolean, onCollapseToggle: () => void): HTMLElement {
        // Create simple custom button with proper hover isolation
        const tempContainer = document.createElement('div');
        const collapseButton = tempContainer.createEl('button', {
            cls: 'coalesce-collapse-button',
            attr: { 
                'aria-label': isCollapsed ? 'Expand all' : 'Collapse all',
                'type': 'button'
            }
        });
        
        // Use Obsidian's setIcon for the icon
        setIcon(collapseButton, 'chevron-down');
        
        // Add classes for custom rotation based on state
        const svg = collapseButton.querySelector('svg');
        if (svg) {
            if (isCollapsed) {
                svg.classList.add('is-collapsed');
            } else {
                svg.classList.remove('is-collapsed');
            }
        }
        
        // Add click handler
        collapseButton.addEventListener('click', onCollapseToggle);
        
        return collapseButton;
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
        // Create a temporary container to host the Obsidian component
        const tempContainer = document.createElement('div');
        
        // Create simple custom button with proper hover isolation
        const settingsButton = tempContainer.createEl('button', {
            cls: 'coalesce-settings-button',
            attr: { 
                'aria-label': 'Settings',
                'type': 'button'
            }
        });
        
        // Use Obsidian's setIcon for the icon
        setIcon(settingsButton, 'more-horizontal');

        // Create the click handler function for the settings popup
        const handleSettingsClick = (e: MouseEvent) => {
            e.stopPropagation(); // Prevent body click from being triggered immediately
            
            // Check if there's already a popup open
            const existingPopup = document.querySelector('.coalesce-settings-popup');
            if (existingPopup) {
                // If popup exists and is associated with this button, close it
                existingPopup.remove();
                return;
            }

            // Create settings popup
            const popup = this.createSettingsPopup(
                currentHeaderStyle,
                onHeaderStyleChange,
                currentStrategy,
                onStrategyChange,
                currentTheme,
                onThemeChange
            );

            // Add the popup to the document body for proper positioning
            document.body.appendChild(popup);
            
            // Get the button element for positioning
            const buttonRect = settingsButton.getBoundingClientRect();
            
            // Position the popup below the button using setCssStyles
            popup.setCssStyles({
                top: `${buttonRect.bottom}px`,
                right: `${window.innerWidth - buttonRect.right}px`
            });
            
            // Close popup when clicking outside
            this.setupPopupClickOutsideHandler(popup, settingsButton);
        };
        
        // Add click handler
        settingsButton.addEventListener('click', handleSettingsClick);
        
        return settingsButton;
    }

    private createSettingsPopup(
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLElement {
        // Get current values from settings manager if available
        const currentHeaderStyleValue = this.settingsManager?.settings?.headerStyle || currentHeaderStyle;
        const currentStrategyValue = this.settingsManager?.settings?.blockBoundaryStrategy || currentStrategy;
        const currentThemeValue = this.settingsManager?.settings?.theme || currentTheme;
        
        // Create a temporary container to use createDiv
        const tempContainer = document.createElement('div');
        const popup = tempContainer.createDiv({ cls: 'coalesce-settings-popup' });
        
        // Set position values with custom attributes to be used by CSS via attr()
        // We use setCssStyles for dynamic positioning as it's more type-safe and readable
        const settingsButton = document.querySelector('.coalesce-settings-button') as HTMLElement;
        if (settingsButton) {
            const buttonRect = settingsButton.getBoundingClientRect();
            popup.setCssStyles({
                top: `${buttonRect.bottom}px`,
                right: `${window.innerWidth - buttonRect.right}px`
            });
        }

        // Add sections to the popup
        
        // Add separator after top options
        const separator1 = popup.createDiv({ cls: 'menu-separator' });
        
        this.addHeaderStyleSettings(popup, currentHeaderStyleValue, onHeaderStyleChange);
        
        // Add separator after header style
        const separator2 = popup.createDiv({ cls: 'menu-separator' });

        // Add separator after position
        const separator3 = popup.createDiv({ cls: 'menu-separator' });
        
        this.addBlockStyleSettings(popup, currentStrategyValue, onStrategyChange);
        
        // Add separator after block style
        const separator4 = popup.createDiv({ cls: 'menu-separator' });
        
        this.addThemeSettings(popup, currentThemeValue, onThemeChange);
        
        this.setupPopupClickOutsideHandler(popup, settingsButton);

        return popup;
    }





    private addHeaderStyleSettings(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        // Create a temporary container to use createSvg
        const tempContainer = document.createElement('div');
        
        // Create header style settings header
        const headerStyleHeader = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-header' });
        
        // Add header icon
        const headerIcon = tempContainer.createSvg('svg', {
            cls: 'coalesce-setting-item-icon',
            attr: {
                viewBox: '0 0 24 24',
                width: '16',
                height: '16'
            }
        });
        
        const iconPath = tempContainer.createSvg('path', {
            attr: {
                fill: 'currentColor',
                d: 'M3 7h6v6H3V7m0 10h6v-2H3v2m8 0h10v-2H11v2m0-4h10v-2H11v2m0-4h10V7H11v2z'
            }
        });
        
        headerIcon.appendChild(iconPath);
        
        headerStyleHeader.appendChild(headerIcon);
        
        const headerText = headerStyleHeader.createSpan({ text: 'Header' });
        
        popup.appendChild(headerStyleHeader);

        // Add header style options
        this.addHeaderStyleOptions(popup, currentHeaderStyle, onHeaderStyleChange);
    }

    private addHeaderStyleOptions(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        // Create a temporary container to use createSvg
        const tempContainer = document.createElement('div');
        
        // Get available header styles dynamically from HeaderStyleFactory
        const validStyles = HeaderStyleFactory.getValidStyles();
        const styleLabels = HeaderStyleFactory.getStyleLabels();
        
        validStyles.forEach(style => {
            const item = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-submenu-item' });
            item.setAttribute('data-style', style);
            
            // Add label
            const itemLabel = item.createSpan({ cls: 'coalesce-setting-item-label', text: styleLabels[style] || style });
            
            // Add checkmark container
            const checkContainer = item.createDiv({ cls: 'coalesce-checkmark-container' });
            if (style === currentHeaderStyle) {
                checkContainer.classList.add('is-checked');
            }
            
            // Add checkmark
            const checkElement = tempContainer.createSvg('svg', {
                cls: 'coalesce-checkmark',
                attr: {
                    viewBox: '0 0 24 24'
                }
            });
            
            const checkPath = tempContainer.createSvg('path', {
                attr: {
                    fill: 'currentColor',
                    d: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'
                }
            });
            
            checkElement.appendChild(checkPath);
            checkContainer.appendChild(checkElement);
            
            item.appendChild(itemLabel);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                // Update all checkmarks in this section
                popup.querySelectorAll('.coalesce-settings-item[data-style]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                
                // Set our internal tracking of current style
                HeaderComponent.currentHeaderStyle = style;
                
                // Call the change handler with the new style
                onHeaderStyleChange(style);
                
                // Close the popup after a brief delay so user can see the checkmark change
                setTimeout(() => popup.remove(), 150);
            });

            popup.appendChild(item);
        });
    }

    private setupPopupClickOutsideHandler(popup: HTMLElement, settingsButton: HTMLElement): void {
        const closePopup = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Add null checks to prevent errors
            if (!target || !popup || !settingsButton) {
                return;
            }
            
            // Only close if clicking outside both popup and settings button
            if (!popup.contains(target) && target !== settingsButton && !settingsButton.contains(target)) {
                document.removeEventListener('click', closePopup);
                popup.remove();
            }
        };
        
        // Use setTimeout to avoid closing immediately due to the click that opened it
        window.setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 10);
    }

    /**
     * Adds block style settings section to the popup
     */
    private addBlockStyleSettings(
        popup: HTMLElement,
        currentStrategy: string,
        onStrategyChange: (strategy: string) => void
    ): void {
        // Create a temporary container to use createSvg
        const tempContainer = document.createElement('div');
        
        // Add settings header
        const header = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-header' });
        
        // Add header icon
        const headerIcon = tempContainer.createSvg('svg', {
            cls: 'coalesce-setting-item-icon',
            attr: {
                viewBox: '0 0 24 24',
                width: '16',
                height: '16'
            }
        });
        
        const iconPath = tempContainer.createSvg('path', {
            attr: {
                fill: 'currentColor',
                d: 'M3 5h18v4H3V5m0 10h18v4H3v-4z'
            }
        });
        
        headerIcon.appendChild(iconPath);
        
        const headerText = header.createSpan({ text: 'Block' });
        
        popup.appendChild(header);
        
        // Get available block styles dynamically from BlockFinderFactory
        const validStrategies = BlockFinderFactory.getValidStrategies();
        const strategyLabels = BlockFinderFactory.getStrategyLabels();
        
        // Add each block style option
        validStrategies.forEach(strategyId => {
            const item = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-submenu-item' });
            item.setAttribute('data-strategy', strategyId);
            
            const label = item.createSpan({ cls: 'coalesce-setting-item-label', text: strategyLabels[strategyId] || strategyId });
            
            const checkContainer = item.createDiv({ cls: 'coalesce-checkmark-container' });
            if (currentStrategy === strategyId) {
                checkContainer.classList.add('is-checked');
            }
            
            const check = tempContainer.createSvg('svg', {
                cls: 'coalesce-checkmark',
                attr: {
                    viewBox: '0 0 24 24'
                }
            });
            
            const checkPath = tempContainer.createSvg('path', {
                attr: {
                    fill: 'currentColor',
                    d: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'
                }
            });
            
            check.appendChild(checkPath);
            checkContainer.appendChild(check);
            item.appendChild(label);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                popup.querySelectorAll('.coalesce-settings-item[data-strategy]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                onStrategyChange(strategyId);
                
                // Close the popup after a brief delay so user can see the checkmark change
                setTimeout(() => popup.remove(), 150);
            });
            
            popup.appendChild(item);
        });
    }
    
    /**
     * Adds theme settings section to the popup
     */
    private addThemeSettings(
        popup: HTMLElement,
        currentTheme: string,
        onThemeChange: (theme: string) => void
    ): void {
        // Create a temporary container to use createSvg
        const tempContainer = document.createElement('div');
        
        // Add settings header
        const header = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-header' });
        
        // Add header icon
        const headerIcon = tempContainer.createSvg('svg', {
            cls: 'coalesce-setting-item-icon',
            attr: {
                viewBox: '0 0 24 24',
                width: '16',
                height: '16'
            }
        });
        
        const iconPath = tempContainer.createSvg('path', {
            attr: {
                fill: 'currentColor',
                d: 'M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3Z'
            }
        });
        
        headerIcon.appendChild(iconPath);
        
        const headerText = header.createSpan({ text: 'Theme' });
        
        popup.appendChild(header);
        
        // Define themes
        const themes = [
            { id: 'default', label: 'Default' },
            { id: 'modern', label: 'Modern' },
            { id: 'compact', label: 'Compact' },
            { id: 'naked', label: 'Naked' }
        ];
        
        // Add each theme option
        themes.forEach(theme => {
            const item = popup.createDiv({ cls: 'coalesce-settings-item coalesce-settings-submenu-item' });
            item.setAttribute('data-theme', theme.id);
            
            const label = item.createSpan({ cls: 'coalesce-setting-item-label', text: theme.label });
            
            const checkContainer = item.createDiv({ cls: 'coalesce-checkmark-container' });
            if (currentTheme === theme.id) {
                checkContainer.classList.add('is-checked');
            }
            
            const check = tempContainer.createSvg('svg', {
                cls: 'coalesce-checkmark',
                attr: {
                    viewBox: '0 0 24 24'
                }
            });
            
            const checkPath = tempContainer.createSvg('path', {
                attr: {
                    fill: 'currentColor',
                    d: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'
                }
            });
            
            check.appendChild(checkPath);
            checkContainer.appendChild(check);
            item.appendChild(label);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                popup.querySelectorAll('.coalesce-settings-item[data-theme]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                onThemeChange(theme.id);
                
                // Close the popup after a brief delay so user can see the checkmark change
                setTimeout(() => popup.remove(), 150);
            });
            
            popup.appendChild(item);
        });
    }
}
