import { ThemeManager } from '../ThemeManager';
import { Logger } from '../utils/Logger';
import { HeaderStyleManager } from '../header-styles/HeaderStyleManager';

export class HeaderComponent {
    private static currentHeaderStyle: string = 'full';

    constructor(private logger: Logger) {}

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
        onHeaderStyleChange: (style: string) => void
    ): HTMLElement {
        HeaderComponent.currentHeaderStyle = currentHeaderStyle;

        this.logger.debug("HeaderComponent received aliases:", aliases);
        this.logger.debug("Aliases length:", aliases.length);

        const header = document.createElement('div');
        header.classList.add('backlinks-header');

        // Create left container
        const leftContainer = document.createElement('div');
        leftContainer.classList.add('backlinks-header-left');

        // Create right container
        const rightContainer = document.createElement('div');
        rightContainer.classList.add('backlinks-header-right');

        // Create and add coalesce icon
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("fill", "currentColor");
        svg.innerHTML = `<path d="M85 40.5C85 22.5 70.5 10 52.5 10c-27.6 0-43.1 24.5-43.1 40 0 21.7 16.8 40 42.6 40 11.3 0 21.1-2.8 27.4-6.5 2.2-1.3 3.6-2.8 3.6-4.4 0-1.3-0.9-2.4-2.2-2.4-0.6 0-1.2 0.2-2 0.7-6.8 4.8-15.9 7.1-26.8 7.1-22.3 0-36.2-15.4-36.2-34.5 0-19.1 13.9-34.5 36.2-34.5 15.4 0 27.5 10.3 27.5 24.5 0 11.8-7.8 19.5-16.8 19.5-4.9 0-7.8-2.5-7.8-6.7 0-1.1 0.2-2.3 0.5-3.4l4.1-16.8c0.9-3.7-1.1-5.6-4-5.6-4.9 0-9.6 5-9.6 12.3 0 5.6 3.1 9.5 9.3 9.5 4.7 0 9.1-1.9 12.4-5.4 3.3 3.5 8.2 5.4 14.3 5.4C73.2 60 85 51.5 85 40.5z"/>`;

        // Create title
        const title = document.createElement('span');
        title.classList.add('header-title');
        title.textContent = `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;

        // Create sort button
        const sortButton = document.createElement('button');
        sortButton.classList.add('clickable-icon', 'sort-button');
        sortButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" style="transform: ${sortDescending ? 'none' : 'rotate(180deg)'}">
                <path fill="currentColor" d="M4 4l4 4 4-4H4z"/>
            </svg>
        `;
        sortButton.addEventListener('click', onSortToggle);

        // Create collapse button
        const collapseButton = document.createElement('button');
        collapseButton.classList.add('clickable-icon', 'collapse-button');
        collapseButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'none'}">
                <path fill="currentColor" d="M4 4l4 4 4-4H4z"/>
            </svg>
        `;
        collapseButton.addEventListener('click', onCollapseToggle);

        // Create dropdown
        const aliasDropdown = document.createElement('select');
        aliasDropdown.classList.add('alias-dropdown');

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'All content';
        aliasDropdown.appendChild(defaultOption);

        // Add saved aliases if they exist
        if (aliases.length > 0) {
            aliases.forEach(alias => {
                const option = document.createElement('option');
                option.value = alias;
                option.textContent = alias;
                if (currentAlias === alias) {
                    option.selected = true;
                }
                aliasDropdown.appendChild(option);
            });
        }

        // Add unsaved aliases if they exist
        if (unsavedAliases.length > 0) {
            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '-- unsaved aliases --';
            aliasDropdown.appendChild(separator);

            // Add unsaved aliases
            unsavedAliases.forEach(alias => {
                const option = document.createElement('option');
                option.value = alias;
                option.textContent = alias;
                if (currentAlias === alias) {
                    option.selected = true;
                }
                aliasDropdown.appendChild(option);
            });
        }

        // Disable dropdown if no aliases at all
        aliasDropdown.disabled = aliases.length === 0 && unsavedAliases.length === 0;

        aliasDropdown.addEventListener('change', (e) => {
            const selectedAlias = (e.target as HTMLSelectElement).value;
            onAliasSelect(selectedAlias || null);
        });

        // Add elements in order
        leftContainer.appendChild(svg);
        leftContainer.appendChild(title);
        leftContainer.appendChild(aliasDropdown);
        leftContainer.appendChild(sortButton);
        leftContainer.appendChild(collapseButton);

        // Add settings button to right container
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

        let currentFullPathState = showFullPathTitle;

        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (popup) {
                popup.remove();
                popup = null;
                return;
            }

            popup = document.createElement('div');
            popup.className = 'settings-popup';

            /***************************************************************************
             * Only daily notes settings (Moved to top)
             **************************************************************************/

            // Create Only Daily Notes setting
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
                    popup = null;
                }, 100);
            });
            popup.appendChild(dailyNotesItem);

            // Add separator after daily notes
            popup.createEl('div', { cls: 'menu-separator' });

            /***************************************************************************
             * Header Style Settings (and rest of settings follow)
             **************************************************************************/

            // Add separator before header style settings
            popup.createEl('div', { cls: 'menu-separator' });

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
            HeaderStyleManager.styles.forEach(style => {
                const styleItem = document.createElement('div');
                styleItem.className = 'settings-item';
                
                // Map style IDs to display names
                const styleDisplayNames: Record<string, string> = {
                    'full': 'Full path',
                    'short': 'Filename',
                    'first-heading-short': 'Header full',
                    'first-heading-tidy': 'Header tidy',
                    'first-heading-tidy-bold': 'Header tidy bold caps'
                };

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
                    if (!popup) return;
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
                    popup = null;
                });

                popup?.appendChild(styleItem);
            });

            /***************************************************************************
             * Position settings
             **************************************************************************/

            // Add separator before position settings
            popup.createEl('div', { cls: 'menu-separator' });

            // Position settings
            const positionHighItem = document.createElement('div');
            positionHighItem.className = 'settings-item';
            positionHighItem.innerHTML = `
                <div class="setting-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 10h14"></path>
                        <path d="M5 18h14"></path>
                        <path d="M5 14h14"></path>
                    </svg>
                </div>
                <span class="setting-item-label">Position high</span>
                <div class="checkmark-container">
                    <div class="checkmark" style="display: ${currentPosition === 'high' ? 'block' : 'none'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            `;

            const positionLowItem = document.createElement('div');
            positionLowItem.className = 'settings-item';
            positionLowItem.innerHTML = `
                <div class="setting-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 10h14"></path>
                        <path d="M5 18h14"></path>
                        <path d="M5 14h14"></path>
                    </svg>
                </div>
                <span class="setting-item-label">Position low</span>
                <div class="checkmark-container">
                    <div class="checkmark" style="display: ${currentPosition === 'low' ? 'block' : 'none'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            `;

            // Add click handlers
            positionHighItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentPosition === 'high') return;
                
                onPositionChange('high');
                currentPosition = 'high';
                
                // Update UI and close popup
                (positionHighItem.querySelector('.checkmark') as HTMLElement).style.display = 'block';
                (positionLowItem.querySelector('.checkmark') as HTMLElement).style.display = 'none';
                popup?.remove();
                popup = null;
            });

            positionLowItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentPosition === 'low') return;
                
                onPositionChange('low');
                currentPosition = 'low';
                
                // Update UI and close popup
                (positionHighItem.querySelector('.checkmark') as HTMLElement).style.display = 'none';
                (positionLowItem.querySelector('.checkmark') as HTMLElement).style.display = 'block';
                popup?.remove();
                popup = null;
            });
            popup.createEl('div', { cls: 'menu-separator' });
            popup.appendChild(positionHighItem);
            popup.appendChild(positionLowItem);


            /***************************************************************************
             * Menu behavior
             **************************************************************************/

            // Position the popup relative to the settings button
            const rect = settingsButton.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Calculate initial positions
            let top = rect.bottom + 5;
            let left = rect.left;
            
            // Check if popup would go below viewport
            if (top + 200 > viewportHeight) { // 200 is an estimated popup height
                top = rect.top - 205; // Position above the button
            }
            
            // Check if popup would go off right edge
            if (left + 180 > viewportWidth) { // 180 is the min-width of popup
                left = viewportWidth - 185; // 5px margin from edge
            }
            
            popup.style.setProperty('--popup-top', `${top}px`);
            popup.style.setProperty('--popup-left', `${left}px`);

            document.body.appendChild(popup);

            // Close popup when clicking outside
            const closePopup = (e: MouseEvent) => {
                if (popup && !popup.contains(e.target as Node) && e.target !== settingsButton) {
                    popup.remove();
                    popup = null;
                    document.removeEventListener('click', closePopup);
                }
            };
            
            document.addEventListener('click', closePopup);

            /***************************************************************************
             * Block Boundary Strategy settings
             **************************************************************************/

            // Add separator before strategy settings
            popup.createEl('div', { cls: 'menu-separator' });

            // Create strategy settings header
            const strategyHeader = document.createElement('div');
            strategyHeader.className = 'settings-item settings-header';
            strategyHeader.innerHTML = `
                <div class="setting-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 3H3v18h18V3z"></path>
                        <path d="M9 3v18"></path>
                    </svg>
                </div>
                <span class="setting-item-label">Block Style</span>
            `;
            popup.appendChild(strategyHeader);

            // Create strategy options
            const strategies = ['default', 'headers-only', 'top-line'];
            strategies.forEach(strategy => {
                const strategyItem = document.createElement('div');
                strategyItem.className = 'settings-item';
                strategyItem.innerHTML = `
                    <div class="setting-item-icon"></div>
                    <span class="setting-item-label">${strategy
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}</span>
                    <div class="checkmark-container">
                        <div class="checkmark" style="display: ${strategy === currentStrategy ? 'block' : 'none'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    </div>
                `;

                strategyItem.addEventListener('click', () => {
                    if (strategy === currentStrategy) return;
                    
                    onStrategyChange(strategy);
                    
                    // Update UI
                    popup?.querySelectorAll('.settings-item .checkmark').forEach(check => {
                        (check as HTMLElement).style.display = 'none';
                    });
                    (strategyItem.querySelector('.checkmark') as HTMLElement).style.display = 'block';
                    
                    // Close popup
                    popup?.remove();
                    popup = null;
                });

                if (popup) {
                    popup.appendChild(strategyItem);
                }
            });

            /***************************************************************************
             * Theme Settings
             **************************************************************************/

            // Add separator before theme settings
            popup.createEl('div', { cls: 'menu-separator' });

            // Create theme settings header
            const themeHeader = document.createElement('div');
            themeHeader.className = 'settings-item settings-header';
            themeHeader.innerHTML = `
                <div class="setting-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                </div>
                <span class="setting-item-label">Theme</span>
            `;
            popup.appendChild(themeHeader);

            // Create theme options
            ThemeManager.themes.forEach(theme => {
                const themeItem = document.createElement('div');
                themeItem.className = 'settings-item';
                themeItem.innerHTML = `
                    <div class="setting-item-icon"></div>
                    <span class="setting-item-label">${theme
                        .charAt(0).toUpperCase() + theme.slice(1)}</span>
                    <div class="checkmark-container">
                        <div class="checkmark" style="display: ${theme === currentTheme ? 'block' : 'none'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    </div>
                `;

                themeItem.addEventListener('click', () => {
                    if (theme === currentTheme) return;
                    
                    // Update the current theme before updating UI
                    currentTheme = theme;
                    onThemeChange(theme);
                    
                    // Update UI
                    if (popup) {
                        popup.querySelectorAll('.settings-item .checkmark').forEach(check => {
                            const checkElement = check as HTMLElement;
                            checkElement.style.display = 'none';
                            const parentItem = checkElement.closest('.settings-item');
                            const itemLabel = parentItem?.querySelector('.setting-item-label')?.textContent?.toLowerCase();
                            if (itemLabel === theme) {
                                checkElement.style.display = 'block';
                            }
                        });
                    }
                    
                    // Close popup
                    popup?.remove();
                    popup = null;
                });

                if (popup) {
                    popup.appendChild(themeItem);
                }
            });
        });

        // Add items to right container
        rightContainer.appendChild(settingsButton);

        // Add containers to header
        header.appendChild(leftContainer);
        header.appendChild(rightContainer);

        return header;
    }
}
