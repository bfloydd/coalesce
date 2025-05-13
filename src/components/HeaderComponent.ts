import { ThemeManager } from '../ThemeManager';
import { Logger } from '../utils/Logger';
import { HeaderStyleManager } from '../header-styles/HeaderStyleManager';
import { BlockFinderFactory } from '../block-finders/BlockFinderFactory';
import { HeaderStyleFactory } from '../header-styles/HeaderStyleFactory';

export class HeaderComponent {
    private static currentHeaderStyle: string = HeaderStyleFactory.getValidStyles()[0];
    private resizeObserver: ResizeObserver | null = null;
    private observedContainer: HTMLElement | null = null;

    constructor(private logger: Logger) {}

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

    /**
     * Checks if the container width is small and applies compact styling if needed
     * @param header The header element to check and update
     * @param container The container element that holds the header
     */
    private applyResponsiveLayout(header: HTMLElement, container: HTMLElement): void {
        // Clean up previous observer if it exists
        this.cleanup();
        
        this.observedContainer = container;
        
        // Set up resize observer to dynamically adjust layout
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
        
        // Initially check the container width
        const initialWidth = container.getBoundingClientRect().width;
        if (initialWidth < 450) {
            header.classList.add('compact');
        }
        
        // Start observing the container
        this.resizeObserver.observe(container);
    }

    createHeader(
        container: HTMLElement, 
        fileCount: number, 
        blockCount: number,
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
        currentPosition: string,
        onPositionChange: (position: 'high' | 'low') => void,
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        aliases: string[] = [],
        onAliasSelect: (alias: string | null) => void,
        currentAlias: string | null = null,
        unsavedAliases: string[] = [],
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        hideBacklinkLine: boolean = false,
        onHideBacklinkLineChange: (hide: boolean) => void
    ): HTMLElement {
        HeaderComponent.currentHeaderStyle = currentHeaderStyle;

        this.logger.debug("HeaderComponent aliases:", { count: aliases.length, aliases });

        const header = document.createElement('div');
        header.classList.add('backlinks-header');

        const leftContainer = this.createLeftContainer(blockCount, aliases, unsavedAliases, currentAlias, onAliasSelect, sortDescending, onSortToggle, isCollapsed, onCollapseToggle);
        const rightContainer = this.createRightContainer(
            hideBacklinkLine, 
            onHideBacklinkLineChange, 
            onlyDailyNotes, 
            onOnlyDailyNotesChange, 
            currentHeaderStyle, 
            onHeaderStyleChange,
            currentPosition,
            onPositionChange,
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
        blockCount: number,
        aliases: string[], 
        unsavedAliases: string[],
        currentAlias: string | null,
        onAliasSelect: (alias: string | null) => void,
        sortDescending: boolean,
        onSortToggle: () => void,
        isCollapsed: boolean,
        onCollapseToggle: () => void
    ): HTMLElement {
        const leftContainer = document.createElement('div');
        leftContainer.classList.add('backlinks-header-left');

        // Create and add coalesce icon
        const svg = this.createCoalesceIcon();
        
        // Create title
        const title = document.createElement('span');
        title.classList.add('header-title');
        title.textContent = `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;

        // Create alias dropdown
        const aliasDropdown = this.createAliasDropdown(aliases, unsavedAliases, currentAlias, onAliasSelect);

        // Create button group
        const buttonGroup = this.createButtonGroup(sortDescending, onSortToggle, isCollapsed, onCollapseToggle);

        // Add elements in order
        leftContainer.appendChild(svg);
        leftContainer.appendChild(title);
        leftContainer.appendChild(aliasDropdown);
        leftContainer.appendChild(buttonGroup);

        return leftContainer;
    }

    private createCoalesceIcon(): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("fill", "currentColor");
        svg.innerHTML = `<path d="M85 40.5C85 22.5 70.5 10 52.5 10c-27.6 0-43.1 24.5-43.1 40 0 21.7 16.8 40 42.6 40 11.3 0 21.1-2.8 27.4-6.5 2.2-1.3 3.6-2.8 3.6-4.4 0-1.3-0.9-2.4-2.2-2.4-0.6 0-1.2 0.2-2 0.7-6.8 4.8-15.9 7.1-26.8 7.1-22.3 0-36.2-15.4-36.2-34.5 0-19.1 13.9-34.5 36.2-34.5 15.4 0 27.5 10.3 27.5 24.5 0 11.8-7.8 19.5-16.8 19.5-4.9 0-7.8-2.5-7.8-6.7 0-1.1 0.2-2.3 0.5-3.4l4.1-16.8c0.9-3.7-1.1-5.6-4-5.6-4.9 0-9.6 5-9.6 12.3 0 5.6 3.1 9.5 9.3 9.5 4.7 0 9.1-1.9 12.4-5.4 3.3 3.5 8.2 5.4 14.3 5.4C73.2 60 85 51.5 85 40.5z"/>`;
        return svg;
    }

    private createAliasDropdown(
        aliases: string[],
        unsavedAliases: string[],
        currentAlias: string | null,
        onAliasSelect: (alias: string | null) => void
    ): HTMLSelectElement {
        const aliasDropdown = document.createElement('select');
        aliasDropdown.classList.add('alias-dropdown');

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
        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('button-group');
        
        // Create sort button
        const sortButton = this.createSortButton(sortDescending, onSortToggle);
        
        // Create collapse button
        const collapseButton = this.createCollapseButton(isCollapsed, onCollapseToggle);
        
        buttonGroup.appendChild(sortButton);
        buttonGroup.appendChild(collapseButton);
        
        return buttonGroup;
    }

    private createSortButton(sortDescending: boolean, onSortToggle: () => void): HTMLButtonElement {
        const sortButton = document.createElement('button');
        sortButton.classList.add('sort-button');
        sortButton.setAttribute('aria-label', sortDescending ? 'Sort ascending' : 'Sort descending');
        
        const svgClass = sortDescending ? 'sort-descending' : 'sort-ascending';
        sortButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" class="${svgClass}">
                <path fill="currentColor" d="M4 4l4 4 4-4H4z"/>
            </svg>
        `;
        
        sortButton.addEventListener('click', onSortToggle);
        
        return sortButton;
    }

    private createCollapseButton(isCollapsed: boolean, onCollapseToggle: () => void): HTMLButtonElement {
        const collapseButton = document.createElement('button');
        collapseButton.classList.add('collapse-button');
        collapseButton.setAttribute('aria-label', isCollapsed ? 'Expand all' : 'Collapse all');
        
        const svgClass = isCollapsed ? 'is-collapsed' : '';
        collapseButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" class="${svgClass}">
                <path fill="currentColor" d="M4 4l4 4 4-4H4z"/>
            </svg>
        `;
        
        collapseButton.addEventListener('click', onCollapseToggle);
        
        return collapseButton;
    }

    private createRightContainer(
        hideBacklinkLine: boolean,
        onHideBacklinkLineChange: (hide: boolean) => void,
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentPosition: string = 'high',
        onPositionChange: (position: 'high' | 'low') => void = () => {},
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLElement {
        const rightContainer = document.createElement('div');
        rightContainer.classList.add('backlinks-header-right');

        // Add settings button to right container
        const settingsButton = this.createSettingsButton(
            hideBacklinkLine,
            onHideBacklinkLineChange,
            onlyDailyNotes,
            onOnlyDailyNotesChange,
            currentHeaderStyle,
            onHeaderStyleChange,
            currentPosition,
            onPositionChange,
            currentStrategy,
            onStrategyChange,
            currentTheme,
            onThemeChange
        );
        
        rightContainer.appendChild(settingsButton);
        
        return rightContainer;
    }

    private createSettingsButton(
        hideBacklinkLine: boolean,
        onHideBacklinkLineChange: (hide: boolean) => void,
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentPosition: string = 'high',
        onPositionChange: (position: 'high' | 'low') => void = () => {},
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLButtonElement {
        const settingsButton = document.createElement('button');
        settingsButton.classList.add('settings-button');
        settingsButton.setAttribute('aria-label', 'Settings');
        settingsButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
            </svg>
        `;

        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent body click from being triggered immediately
            
            // Check if there's already a popup open
            const existingPopup = document.querySelector('.settings-popup');
            if (existingPopup) {
                // If popup exists and is associated with this button, close it
                existingPopup.remove();
                return;
            }

            // Create settings popup
            const popup = this.createSettingsPopup(
                hideBacklinkLine,
                onHideBacklinkLineChange,
                onlyDailyNotes,
                onOnlyDailyNotesChange,
                currentHeaderStyle,
                onHeaderStyleChange,
                currentPosition,
                onPositionChange,
                currentStrategy,
                onStrategyChange,
                currentTheme,
                onThemeChange
            );

            // Add the popup to the document body for proper positioning
            document.body.appendChild(popup);
            
            // Calculate popup position relative to button
            const buttonRect = settingsButton.getBoundingClientRect();
            
            // Position the popup below the button using setAttribute instead of direct style access
            popup.setAttribute('style', `top: ${buttonRect.bottom}px; right: ${window.innerWidth - buttonRect.right}px;`);
            
            // Close popup when clicking outside
            this.setupPopupClickOutsideHandler(popup, settingsButton);
        });

        return settingsButton;
    }

    private createSettingsPopup(
        hideBacklinkLine: boolean,
        onHideBacklinkLineChange: (hide: boolean) => void,
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void,
        currentPosition: string = 'high',
        onPositionChange: (position: 'high' | 'low') => void = () => {},
        currentStrategy: string = 'default',
        onStrategyChange: (strategy: string) => void = () => {},
        currentTheme: string = 'default',
        onThemeChange: (theme: string) => void = () => {}
    ): HTMLElement {
        const popup = document.createElement('div');
        popup.classList.add('settings-popup');
        
        // Set position values with custom attributes to be used by CSS via attr()
        // Unfortunately we still need to use inline styles for positioning as CSS can't
        // dynamically position like this without CSS-in-JS, but we're using setAttribute
        // to make it more explicit that we're applying custom styles
        const settingsButton = document.querySelector('.settings-button') as HTMLElement;
        if (settingsButton) {
            const buttonRect = settingsButton.getBoundingClientRect();
            popup.setAttribute('style', `top: ${buttonRect.bottom}px; right: ${window.innerWidth - buttonRect.right}px;`);
        }

        // Add sections to the popup
        const hideBacklinkLineSetting = this.createHideBacklinkLineSetting(hideBacklinkLine, onHideBacklinkLineChange, popup);
        popup.appendChild(hideBacklinkLineSetting);
        
        const onlyDailyNotesSetting = this.createOnlyDailyNotesSetting(onlyDailyNotes, onOnlyDailyNotesChange, popup);
        popup.appendChild(onlyDailyNotesSetting);
        
        // Add separator after top options
        const separator1 = document.createElement('div');
        separator1.classList.add('menu-separator');
        popup.appendChild(separator1);
        
        this.addHeaderStyleSettings(popup, currentHeaderStyle, onHeaderStyleChange);
        
        // Add separator after header style
        const separator2 = document.createElement('div');
        separator2.classList.add('menu-separator');
        popup.appendChild(separator2);
        
        this.addPositionSettings(popup, currentPosition, onPositionChange);
        
        // Add separator after position
        const separator3 = document.createElement('div');
        separator3.classList.add('menu-separator');
        popup.appendChild(separator3);
        
        this.addBlockStyleSettings(popup, currentStrategy, onStrategyChange);
        
        // Add separator after block style
        const separator4 = document.createElement('div');
        separator4.classList.add('menu-separator');
        popup.appendChild(separator4);
        
        this.addThemeSettings(popup, currentTheme, onThemeChange);
        
        this.setupPopupClickOutsideHandler(popup, settingsButton);

        return popup;
    }

    private createHideBacklinkLineSetting(
        hideBacklinkLine: boolean, 
        onHideBacklinkLineChange: (hide: boolean) => void,
        popup: HTMLElement
    ): HTMLElement {
        const item = document.createElement('div');
        item.classList.add('settings-item');
        
        // Add icon
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.classList.add('setting-item-icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '16');
        icon.setAttribute('height', '16');
        icon.innerHTML = '<path fill="currentColor" d="M12.968 16L10 20H3l4-6H3l3-4h6l-3 4h3.968zm5.991-7.474a.997.997 0 0 1-.028 1.136l-7.99 11.985a1 1 0 0 1-1.664-1.11l7.99-11.987a1 1 0 0 1 1.692-.024z"/>';
        
        const label = document.createElement('span');
        label.classList.add('setting-item-label');
        label.textContent = 'Hide Backlink Line';
        
        const checkmarkContainer = document.createElement('div');
        checkmarkContainer.classList.add('checkmark-container');
        if (hideBacklinkLine) {
            checkmarkContainer.classList.add('is-checked');
        }
        
        const hideBacklinkLineCheckmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hideBacklinkLineCheckmark.classList.add('checkmark');
        hideBacklinkLineCheckmark.setAttribute('viewBox', '0 0 24 24');
        hideBacklinkLineCheckmark.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
        
        checkmarkContainer.appendChild(hideBacklinkLineCheckmark);
        
        item.appendChild(icon);
        item.appendChild(label);
        item.appendChild(checkmarkContainer);
        
        item.addEventListener('click', () => {
            const newValue = !hideBacklinkLine;
            checkmarkContainer.classList.toggle('is-checked');
            onHideBacklinkLineChange(newValue);
        });

        return item;
    }

    private createOnlyDailyNotesSetting(
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        popup: HTMLElement
    ): HTMLElement {
        const item = document.createElement('div');
        item.classList.add('settings-item');
        
        // Add icon
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.classList.add('setting-item-icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '16');
        icon.setAttribute('height', '16');
        icon.innerHTML = '<path fill="currentColor" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>';
        
        const label = document.createElement('span');
        label.classList.add('setting-item-label');
        label.textContent = 'Hide in Daily Notes';
        
        const checkmarkContainer = document.createElement('div');
        checkmarkContainer.classList.add('checkmark-container');
        if (onlyDailyNotes) {
            checkmarkContainer.classList.add('is-checked');
        }
        
        const dailyNotesCheckmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dailyNotesCheckmark.classList.add('checkmark');
        dailyNotesCheckmark.setAttribute('viewBox', '0 0 24 24');
        dailyNotesCheckmark.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
        
        checkmarkContainer.appendChild(dailyNotesCheckmark);
        
        item.appendChild(icon);
        item.appendChild(label);
        item.appendChild(checkmarkContainer);
        
        item.addEventListener('click', () => {
            const newState = !onlyDailyNotes;
            checkmarkContainer.classList.toggle('is-checked');
            onOnlyDailyNotesChange(newState);
        });

        return item;
    }

    private addHeaderStyleSettings(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        // Create header style settings header
        const headerStyleHeader = document.createElement('div');
        headerStyleHeader.classList.add('settings-item', 'settings-header');
        
        // Add header icon
        const headerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        headerIcon.classList.add('setting-item-icon');
        headerIcon.setAttribute('viewBox', '0 0 24 24');
        headerIcon.setAttribute('width', '16');
        headerIcon.setAttribute('height', '16');
        headerIcon.innerHTML = '<path fill="currentColor" d="M3 7h6v6H3V7m0 10h6v-2H3v2m8 0h10v-2H11v2m0-4h10v-2H11v2m0-4h10V7H11v2z"/>';
        
        headerStyleHeader.appendChild(headerIcon);
        
        const headerText = document.createElement('span');
        headerText.textContent = 'Header Style';
        headerStyleHeader.appendChild(headerText);
        
        popup.appendChild(headerStyleHeader);

        // Add header style options
        this.addHeaderStyleOptions(popup, currentHeaderStyle, onHeaderStyleChange);
    }

    private addHeaderStyleOptions(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        // Get available header styles dynamically from HeaderStyleFactory
        const validStyles = HeaderStyleFactory.getValidStyles();
        const styleLabels = HeaderStyleFactory.getStyleLabels();
        
        validStyles.forEach(style => {
            const item = document.createElement('div');
            item.classList.add('settings-item', 'settings-submenu-item');
            item.setAttribute('data-style', style);
            
            // Add label
            const itemLabel = document.createElement('span');
            itemLabel.classList.add('setting-item-label');
            itemLabel.textContent = styleLabels[style] || style;
            
            // Add checkmark container
            const checkContainer = document.createElement('div');
            checkContainer.classList.add('checkmark-container');
            if (style === currentHeaderStyle) {
                checkContainer.classList.add('is-checked');
            }
            
            // Add checkmark
            const checkElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkElement.classList.add('checkmark');
            checkElement.setAttribute('viewBox', '0 0 24 24');
            checkElement.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
            
            checkContainer.appendChild(checkElement);
            
            item.appendChild(itemLabel);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                // Update all checkmarks in this section
                popup.querySelectorAll('.settings-item[data-style]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                
                // Set our internal tracking of current style
                HeaderComponent.currentHeaderStyle = style;
                
                // Call the change handler with the new style
                onHeaderStyleChange(style);
            });

            popup.appendChild(item);
        });
    }

    private setupPopupClickOutsideHandler(popup: HTMLElement, settingsButton: HTMLElement): void {
        const closePopup = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Only close if clicking outside both popup and settings button
            if (!popup.contains(target) && target !== settingsButton && !settingsButton.contains(target)) {
            document.removeEventListener('click', closePopup);
                popup.remove();
            }
        };
        
        // Use setTimeout to avoid closing immediately due to the click that opened it
        setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 10);
    }

    /**
     * Adds position settings section to the popup
     */
    private addPositionSettings(
        popup: HTMLElement,
        currentPosition: string,
        onPositionChange: (position: 'high' | 'low') => void
    ): void {
        // Add settings header
        const header = document.createElement('div');
        header.classList.add('settings-item', 'settings-header');
        
        // Add header icon
        const headerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        headerIcon.classList.add('setting-item-icon');
        headerIcon.setAttribute('viewBox', '0 0 24 24');
        headerIcon.setAttribute('width', '16');
        headerIcon.setAttribute('height', '16');
        headerIcon.innerHTML = '<path fill="currentColor" d="M9 20.42L2.79 14.21L5.62 11.38L9 14.77L18.88 4.88L21.71 7.71L9 20.42Z"/>';
        
        header.appendChild(headerIcon);
        
        const headerText = document.createElement('span');
        headerText.textContent = 'Position';
        header.appendChild(headerText);
        
        popup.appendChild(header);
        
        // Add high option
        const highItem = document.createElement('div');
        highItem.classList.add('settings-item', 'settings-submenu-item');
        highItem.setAttribute('data-position', 'high');
        
        const highLabel = document.createElement('span');
        highLabel.classList.add('setting-item-label');
        highLabel.textContent = 'Position high';
        
        const highCheckContainer = document.createElement('div');
        highCheckContainer.classList.add('checkmark-container');
        if (currentPosition === 'high') {
            highCheckContainer.classList.add('is-checked');
        }
        
        const highCheck = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        highCheck.classList.add('checkmark');
        highCheck.setAttribute('viewBox', '0 0 24 24');
        highCheck.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
        
        highCheckContainer.appendChild(highCheck);
        highItem.appendChild(highLabel);
        highItem.appendChild(highCheckContainer);
        
        popup.appendChild(highItem);
        
        // Add low option
        const lowItem = document.createElement('div');
        lowItem.classList.add('settings-item', 'settings-submenu-item');
        lowItem.setAttribute('data-position', 'low');
        
        const lowLabel = document.createElement('span');
        lowLabel.classList.add('setting-item-label');
        lowLabel.textContent = 'Position low';
        
        const lowCheckContainer = document.createElement('div');
        lowCheckContainer.classList.add('checkmark-container');
        if (currentPosition === 'low') {
            lowCheckContainer.classList.add('is-checked');
        }
        
        const lowCheck = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lowCheck.classList.add('checkmark');
        lowCheck.setAttribute('viewBox', '0 0 24 24');
        lowCheck.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
        
        lowCheckContainer.appendChild(lowCheck);
        lowItem.appendChild(lowLabel);
        lowItem.appendChild(lowCheckContainer);
        
        popup.appendChild(lowItem);
        
        // Add event listeners
        highItem.addEventListener('click', () => {
            popup.querySelectorAll('.settings-item[data-position]').forEach(el => {
                (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
            });
            highCheckContainer.classList.add('is-checked');
            onPositionChange('high');
        });
        
        lowItem.addEventListener('click', () => {
            popup.querySelectorAll('.settings-item[data-position]').forEach(el => {
                (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
            });
            lowCheckContainer.classList.add('is-checked');
            onPositionChange('low');
        });
    }
    
    /**
     * Adds block style settings section to the popup
     */
    private addBlockStyleSettings(
        popup: HTMLElement,
        currentStrategy: string,
        onStrategyChange: (strategy: string) => void
    ): void {
        // Add settings header
        const header = document.createElement('div');
        header.classList.add('settings-item', 'settings-header');
        
        // Add header icon
        const headerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        headerIcon.classList.add('setting-item-icon');
        headerIcon.setAttribute('viewBox', '0 0 24 24');
        headerIcon.setAttribute('width', '16');
        headerIcon.setAttribute('height', '16');
        headerIcon.innerHTML = '<path fill="currentColor" d="M3 5h18v4H3V5m0 10h18v4H3v-4z"/>';
        
        header.appendChild(headerIcon);
        
        const headerText = document.createElement('span');
        headerText.textContent = 'Block Style';
        header.appendChild(headerText);
        
        popup.appendChild(header);
        
        // Get available block styles dynamically from BlockFinderFactory
        const validStrategies = BlockFinderFactory.getValidStrategies();
        const strategyLabels = BlockFinderFactory.getStrategyLabels();
        
        // Add each block style option
        validStrategies.forEach(strategyId => {
            const item = document.createElement('div');
            item.classList.add('settings-item', 'settings-submenu-item');
            item.setAttribute('data-strategy', strategyId);
            
            const label = document.createElement('span');
            label.classList.add('setting-item-label');
            label.textContent = strategyLabels[strategyId] || strategyId;
            
            const checkContainer = document.createElement('div');
            checkContainer.classList.add('checkmark-container');
            if (currentStrategy === strategyId) {
                checkContainer.classList.add('is-checked');
            }
            
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            check.classList.add('checkmark');
            check.setAttribute('viewBox', '0 0 24 24');
            check.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
            
            checkContainer.appendChild(check);
            item.appendChild(label);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                popup.querySelectorAll('.settings-item[data-strategy]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                onStrategyChange(strategyId);
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
        // Add settings header
        const header = document.createElement('div');
        header.classList.add('settings-item', 'settings-header');
        
        // Add header icon
        const headerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        headerIcon.classList.add('setting-item-icon');
        headerIcon.setAttribute('viewBox', '0 0 24 24');
        headerIcon.setAttribute('width', '16');
        headerIcon.setAttribute('height', '16');
        headerIcon.innerHTML = '<path fill="currentColor" d="M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3Z"/>';
        
        header.appendChild(headerIcon);
        
        const headerText = document.createElement('span');
        headerText.textContent = 'Theme';
        header.appendChild(headerText);
        
        popup.appendChild(header);
        
        // Define themes
        const themes = [
            { id: 'default', label: 'Default' },
            { id: 'modern', label: 'Modern' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'naked', label: 'Naked' }
        ];
        
        // Add each theme option
        themes.forEach(theme => {
            const item = document.createElement('div');
            item.classList.add('settings-item', 'settings-submenu-item');
            item.setAttribute('data-theme', theme.id);
            
            const label = document.createElement('span');
            label.classList.add('setting-item-label');
            label.textContent = theme.label;
            
            const checkContainer = document.createElement('div');
            checkContainer.classList.add('checkmark-container');
            if (currentTheme === theme.id) {
                checkContainer.classList.add('is-checked');
            }
            
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            check.classList.add('checkmark');
            check.setAttribute('viewBox', '0 0 24 24');
            check.innerHTML = '<path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>';
            
            checkContainer.appendChild(check);
            item.appendChild(label);
            item.appendChild(checkContainer);
            
            item.addEventListener('click', () => {
                popup.querySelectorAll('.settings-item[data-theme]').forEach(el => {
                    (el as HTMLElement).querySelector('.checkmark-container')?.classList.remove('is-checked');
                });
                checkContainer.classList.add('is-checked');
                onThemeChange(theme.id);
            });
            
            popup.appendChild(item);
        });
    }
}
