import { ThemeManager } from '../ThemeManager';
import { Logger } from '../utils/Logger';
import { HeaderStyleManager } from '../header-styles/HeaderStyleManager';

export class HeaderComponent {
    private static currentHeaderStyle: string = 'full';
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
        sortButton.classList.add('clickable-icon', 'sort-button');
        sortButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" style="transform: ${sortDescending ? 'none' : 'rotate(180deg)'}">
                <path fill="currentColor" d="M4 4l4 4 4-4H4z"/>
            </svg>
        `;
        sortButton.addEventListener('click', onSortToggle);
        return sortButton;
    }

    private createCollapseButton(isCollapsed: boolean, onCollapseToggle: () => void): HTMLButtonElement {
        const collapseButton = document.createElement('button');
        collapseButton.classList.add('clickable-icon', 'collapse-button');
        collapseButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'none'}">
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
        settingsButton.className = 'settings-button';
        settingsButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
            </svg>
        `;

        let popup: HTMLElement | null = null;

        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (popup) {
                popup.remove();
                popup = null;
                return;
            }

            popup = this.createSettingsPopup(
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
            
            // Position the popup below the button
            popup.style.top = `${buttonRect.bottom}px`;
            popup.style.right = `${window.innerWidth - buttonRect.right}px`;
            
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
        popup.className = 'settings-popup';

        // Add the hide backlink line setting
        const hideBacklinkLineItem = this.createHideBacklinkLineSetting(hideBacklinkLine, onHideBacklinkLineChange, popup);
        popup.appendChild(hideBacklinkLineItem);

        // Add the only daily notes setting
        const dailyNotesItem = this.createOnlyDailyNotesSetting(onlyDailyNotes, onOnlyDailyNotesChange, popup);
        popup.appendChild(dailyNotesItem);

        // Add separator after daily notes
        popup.createEl('div', { cls: 'menu-separator' });

        // Add header style settings
        this.addHeaderStyleSettings(popup, currentHeaderStyle, onHeaderStyleChange);
        
        // Add separator after header style
        popup.createEl('div', { cls: 'menu-separator' });
        
        // Add position settings
        this.addPositionSettings(popup, currentPosition, onPositionChange);
        
        // Add separator after position
        popup.createEl('div', { cls: 'menu-separator' });
        
        // Add block style settings
        this.addBlockStyleSettings(popup, currentStrategy, onStrategyChange);
        
        // Add separator after block style
        popup.createEl('div', { cls: 'menu-separator' });
        
        // Add theme settings
        this.addThemeSettings(popup, currentTheme, onThemeChange);

        return popup;
    }

    private createHideBacklinkLineSetting(
        hideBacklinkLine: boolean, 
        onHideBacklinkLineChange: (hide: boolean) => void,
        popup: HTMLElement
    ): HTMLElement {
        const hideBacklinkLineItem = document.createElement('div');
        hideBacklinkLineItem.className = 'settings-item';

        // Create left icon (filter icon)
        const hideBacklinkLineIcon = document.createElement('div');
        hideBacklinkLineIcon.className = 'setting-item-icon';
        hideBacklinkLineIcon.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
        `;

        const hideBacklinkLineLabel = document.createElement('span');
        hideBacklinkLineLabel.textContent = 'Hide Backlink Line';
        hideBacklinkLineLabel.className = 'setting-item-label';

        const hideBacklinkLineCheckContainer = document.createElement('div');
        hideBacklinkLineCheckContainer.className = 'checkmark-container';

        const hideBacklinkLineCheckmark = document.createElement('div');
        hideBacklinkLineCheckmark.className = 'checkmark';
        hideBacklinkLineCheckmark.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        hideBacklinkLineCheckmark.style.display = hideBacklinkLine ? 'block' : 'none';

        hideBacklinkLineCheckContainer.appendChild(hideBacklinkLineCheckmark);
        hideBacklinkLineItem.appendChild(hideBacklinkLineIcon);
        hideBacklinkLineItem.appendChild(hideBacklinkLineLabel);
        hideBacklinkLineItem.appendChild(hideBacklinkLineCheckContainer);

        hideBacklinkLineItem.addEventListener('click', () => {
            const newValue = !hideBacklinkLine;
            hideBacklinkLineCheckmark.style.display = newValue ? 'block' : 'none';
            onHideBacklinkLineChange(newValue);
            
            // Close the popup
            if (popup) {
                popup.remove();
            }
        });

        return hideBacklinkLineItem;
    }

    private createOnlyDailyNotesSetting(
        onlyDailyNotes: boolean,
        onOnlyDailyNotesChange: (show: boolean) => void,
        popup: HTMLElement
    ): HTMLElement {
        const dailyNotesItem = document.createElement('div');
        dailyNotesItem.className = 'settings-item';

        // Create left icon (calendar icon)
        const dailyNotesIcon = document.createElement('div');
        dailyNotesIcon.className = 'setting-item-icon';
        dailyNotesIcon.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        `;

        const dailyNotesLabel = document.createElement('span');
        dailyNotesLabel.textContent = 'Hide in Daily Notes';
        dailyNotesLabel.className = 'setting-item-label';

        const dailyNotesCheckContainer = document.createElement('div');
        dailyNotesCheckContainer.className = 'checkmark-container';

        const dailyNotesCheckmark = document.createElement('div');
        dailyNotesCheckmark.className = 'checkmark';
        dailyNotesCheckmark.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        dailyNotesCheckmark.style.display = onlyDailyNotes ? 'block' : 'none';

        dailyNotesCheckContainer.appendChild(dailyNotesCheckmark);
        dailyNotesItem.appendChild(dailyNotesIcon);
        dailyNotesItem.appendChild(dailyNotesLabel);
        dailyNotesItem.appendChild(dailyNotesCheckContainer);

        dailyNotesItem.addEventListener('click', (e) => {
            e.stopPropagation();
            const newState = !onlyDailyNotes;
            dailyNotesCheckmark.style.display = newState ? 'block' : 'none';
            onOnlyDailyNotesChange(newState);
            
            // Close popup after a short delay to ensure the click is processed
            setTimeout(() => {
                popup?.remove();
            }, 100);
        });

        return dailyNotesItem;
    }

    private addHeaderStyleSettings(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        // Create header style settings header
        const headerStyleHeader = document.createElement('div');
        headerStyleHeader.className = 'settings-item settings-header';
        headerStyleHeader.innerHTML = `
            <div class="setting-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 7V4h16v3"/>
                    <path d="M9 20h6"/>
                    <path d="M12 4v16"/>
                </svg>
            </div>
            <span class="setting-item-label">Header Style</span>
        `;
        popup.appendChild(headerStyleHeader);

        // Create header style options
        this.addHeaderStyleOptions(popup, currentHeaderStyle, onHeaderStyleChange);
    }

    private addHeaderStyleOptions(
        popup: HTMLElement,
        currentHeaderStyle: string,
        onHeaderStyleChange: (style: string) => void
    ): void {
        const styleDisplayNames: Record<string, string> = {
            'full': 'Full path',
            'short': 'Filename',
            'first-heading-short': 'Header full',
            'first-heading-tidy': 'Header tidy',
            'first-heading-tidy-bold': 'Header tidy bold caps'
        };

        HeaderStyleManager.styles.forEach(style => {
            const styleItem = document.createElement('div');
            styleItem.className = 'settings-item';

            styleItem.innerHTML = `
                <div class="setting-item-icon"></div>
                <span class="setting-item-label">${styleDisplayNames[style as keyof typeof styleDisplayNames]}</span>
                <div class="checkmark-container">
                    <div class="checkmark" style="display: ${style === HeaderComponent.currentHeaderStyle ? 'block' : 'none'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            `;

            styleItem.addEventListener('click', () => {
                if (style === HeaderComponent.currentHeaderStyle) return;
                
                HeaderComponent.currentHeaderStyle = style;
                
                // Update all header style checkmarks first
                popup.querySelectorAll('.settings-item .checkmark').forEach(check => {
                    const checkElement = check as HTMLElement;
                    const parentItem = checkElement.closest('.settings-item');
                    const itemLabel = parentItem?.querySelector('.setting-item-label')?.textContent?.toLowerCase();
                    checkElement.style.display = itemLabel === style ? 'block' : 'none';
                });
                
                onHeaderStyleChange(style);
                popup.remove();
            });

            popup.appendChild(styleItem);
        });
    }

    private setupPopupClickOutsideHandler(popup: HTMLElement, settingsButton: HTMLElement): void {
        // Use a reference to allow modification
        const popupRef: { current: HTMLElement | null } = { current: popup };
        
        const closePopup = (e: MouseEvent) => {
            if (!popupRef.current) return;
            
            // Don't close if clicking on the settings button or inside the popup
            if (e.target === settingsButton || settingsButton.contains(e.target as Node) || 
                popupRef.current.contains(e.target as Node)) {
                return;
            }
            
            popupRef.current.remove();
            popupRef.current = null;
            document.removeEventListener('click', closePopup);
        };
        
        // Delay adding the event listener to prevent immediate closing
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
        // Create position header
        const positionHeader = document.createElement('div');
        positionHeader.className = 'settings-item settings-header';
        positionHeader.innerHTML = `
            <div class="setting-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 12v8h16v-8"/>
                    <path d="M4 4v8h16V4"/>
                </svg>
            </div>
            <span class="setting-item-label">Position</span>
        `;
        popup.appendChild(positionHeader);
        
        // Add position high option
        const positionHighItem = document.createElement('div');
        positionHighItem.className = 'settings-item';
        positionHighItem.innerHTML = `
            <div class="setting-item-icon"></div>
            <span class="setting-item-label">Position high</span>
            <div class="checkmark-container">
                <div class="checkmark position-high-check" style="display: ${currentPosition === 'high' ? 'block' : 'none'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;
        positionHighItem.addEventListener('click', () => {
            popup.querySelectorAll('.position-high-check, .position-low-check').forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });
            const check = positionHighItem.querySelector('.position-high-check') as HTMLElement;
            if (check) {
                check.style.display = 'block';
            }
            // Call the actual position change handler
            onPositionChange('high');
            popup.remove();
        });
        popup.appendChild(positionHighItem);
        
        // Add position low option
        const positionLowItem = document.createElement('div');
        positionLowItem.className = 'settings-item';
        positionLowItem.innerHTML = `
            <div class="setting-item-icon"></div>
            <span class="setting-item-label">Position low</span>
            <div class="checkmark-container">
                <div class="checkmark position-low-check" style="display: ${currentPosition === 'low' ? 'block' : 'none'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;
        positionLowItem.addEventListener('click', () => {
            popup.querySelectorAll('.position-high-check, .position-low-check').forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });
            const check = positionLowItem.querySelector('.position-low-check') as HTMLElement;
            if (check) {
                check.style.display = 'block';
            }
            // Call the actual position change handler
            onPositionChange('low');
            popup.remove();
        });
        popup.appendChild(positionLowItem);
    }
    
    /**
     * Adds block style settings section to the popup
     */
    private addBlockStyleSettings(
        popup: HTMLElement,
        currentStrategy: string,
        onStrategyChange: (strategy: string) => void
    ): void {
        // Create block style header
        const blockStyleHeader = document.createElement('div');
        blockStyleHeader.className = 'settings-item settings-header';
        blockStyleHeader.innerHTML = `
            <div class="setting-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
            </div>
            <span class="setting-item-label">Block Style</span>
        `;
        popup.appendChild(blockStyleHeader);
        
        // Add block style options
        const styles = ['Default', 'Headers Only', 'Top Line'];
        const styleValues = ['default', 'headers-only', 'top-line'];
        
        styles.forEach((style, index) => {
            const styleItem = document.createElement('div');
            styleItem.className = 'settings-item';
            styleItem.innerHTML = `
                <div class="setting-item-icon"></div>
                <span class="setting-item-label">${style}</span>
                <div class="checkmark-container">
                    <div class="checkmark block-style-check block-style-${styleValues[index]}" 
                         style="display: ${currentStrategy === styleValues[index] ? 'block' : 'none'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            `;
            styleItem.addEventListener('click', () => {
                popup.querySelectorAll('.block-style-check').forEach(el => {
                    (el as HTMLElement).style.display = 'none';
                });
                const check = styleItem.querySelector(`.block-style-${styleValues[index]}`) as HTMLElement;
                if (check) {
                    check.style.display = 'block';
                }
                // Call the actual strategy change handler
                onStrategyChange(styleValues[index]);
                popup.remove();
            });
            popup.appendChild(styleItem);
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
        // Create theme header
        const themeHeader = document.createElement('div');
        themeHeader.className = 'settings-item settings-header';
        themeHeader.innerHTML = `
            <div class="setting-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            </div>
            <span class="setting-item-label">Theme</span>
        `;
        popup.appendChild(themeHeader);
        
        // Add theme options
        const themes = ['Default', 'Modern', 'Minimal', 'Naked'];
        const themeValues = ['default', 'modern', 'minimal', 'naked'];
        
        themes.forEach((theme, index) => {
            const themeItem = document.createElement('div');
            themeItem.className = 'settings-item';
            themeItem.innerHTML = `
                <div class="setting-item-icon"></div>
                <span class="setting-item-label">${theme}</span>
                <div class="checkmark-container">
                    <div class="checkmark theme-check theme-${themeValues[index]}"
                         style="display: ${currentTheme === themeValues[index] ? 'block' : 'none'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            `;
            themeItem.addEventListener('click', () => {
                popup.querySelectorAll('.theme-check').forEach(el => {
                    (el as HTMLElement).style.display = 'none';
                });
                const check = themeItem.querySelector(`.theme-${themeValues[index]}`) as HTMLElement;
                if (check) {
                    check.style.display = 'block';
                }
                // Call the actual theme change handler
                onThemeChange(themeValues[index]);
                popup.remove();
            });
            popup.appendChild(themeItem);
        });
    }
}
