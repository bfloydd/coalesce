import { Logger } from '../shared-utilities/Logger';
import { IconProvider } from '../shared-utilities/IconProvider';
import {
    ISettingsControls,
    SortButtonOptions,
    CollapseButtonOptions,
    StrategyDropdownOptions,
    ThemeDropdownOptions,
    SettingsButtonOptions
} from './types';
import { createButton } from '../../shared/ui/Button';
import { createIconButton } from '../../shared/ui/IconButton';

/**
 * Settings Controls for Backlinks Header Slice
 * 
 * Handles sort, collapse, strategy, theme, and settings controls
 * for the vertical slice architecture.
 */
export class SettingsControls implements ISettingsControls {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child('SettingsControls');
        
        this.logger.debug('SettingsControls initialized');
    }

    /**
     * Create sort button
     */
    createSortButton(container: HTMLElement, options: SortButtonOptions): HTMLElement {
        this.logger.debug('Creating sort button', { options });

        try {
            // Optional wrapper for layout compatibility
            const buttonContainer = container.createDiv({ cls: 'sort-button' });

            const button = createButton({
                parent: buttonContainer,
                label: options.isDescending ? 'Descending' : 'Ascending',
                ariaLabel: options.isDescending ? 'Descending' : 'Ascending',
                icon: 'sort',
                iconSize: 'sm',
                variant: 'ghost',
                onClick: options.onToggle,
                classes: ['coalesce-sort-button']
            });

            // Set initial icon state for rotation
            const svg = button.querySelector('svg') as SVGElement | null;
            if (svg) {
                if (options.isDescending) {
                    svg.classList.add('sort-descending');
                    svg.classList.remove('sort-ascending');
                } else {
                    svg.classList.add('sort-ascending');
                    svg.classList.remove('sort-descending');
                }
            }

            this.logger.debug('Sort button created successfully', { buttonContainer });
            return buttonContainer;
        } catch (error) {
            this.logger.error('Failed to create sort button', { options, error });
            throw error;
        }
    }

    /**
     * Create collapse button
     */
    createCollapseButton(container: HTMLElement, options: CollapseButtonOptions): HTMLElement {
        this.logger.debug('Creating collapse button', { options });

        try {
            // Optional wrapper for layout compatibility
            const buttonContainer = container.createDiv({ cls: 'collapse-button' });

            const button = createIconButton({
                parent: buttonContainer,
                icon: options.isCollapsed ? 'chevronRight' : 'chevronDown',
                size: 'sm',
                ariaLabel: options.isCollapsed ? 'Expand all' : 'Collapse all',
                classes: ['coalesce-collapse-button'],
                onClick: options.onToggle
            });

            this.logger.debug('Collapse button created successfully', { buttonContainer });
            return buttonContainer;
        } catch (error) {
            this.logger.error('Failed to create collapse button', { options, error });
            throw error;
        }
    }

    /**
     * Create strategy dropdown
     */
    createStrategyDropdown(container: HTMLElement, options: StrategyDropdownOptions): HTMLElement {
        this.logger.debug('Creating strategy dropdown', { options });
        
        try {
            // Create dropdown container
            const dropdown = container.createDiv({ cls: 'strategy-dropdown' });
            
            // Create select element
            const select = dropdown.createEl('select', {
                cls: 'strategy-select'
            });
            
            // Add options
            for (const strategy of options.strategies) {
                const option = select.createEl('option', {
                    value: strategy,
                    text: this.getStrategyDisplayName(strategy)
                });
                
                if (options.currentStrategy === strategy) {
                    option.selected = true;
                }
            }
            
            // Add event listener
            select.addEventListener('change', (e) => {
                const value = (e.target as HTMLSelectElement).value;
                options.onStrategyChange(value);
            });
            
            this.logger.debug('Strategy dropdown created successfully', { 
                dropdown, 
                strategyCount: options.strategies.length 
            });
            
            return dropdown;
        } catch (error) {
            this.logger.error('Failed to create strategy dropdown', { options, error });
            throw error;
        }
    }

    /**
     * Create theme dropdown
     */
    createThemeDropdown(container: HTMLElement, options: ThemeDropdownOptions): HTMLElement {
        this.logger.debug('Creating theme dropdown', { options });
        
        try {
            // Create dropdown container
            const dropdown = container.createDiv({ cls: 'theme-dropdown' });
            
            // Create select element
            const select = dropdown.createEl('select', {
                cls: 'theme-select'
            });
            
            // Add options
            for (const theme of options.themes) {
                const option = select.createEl('option', {
                    value: theme,
                    text: this.getThemeDisplayName(theme)
                });
                
                if (options.currentTheme === theme) {
                    option.selected = true;
                }
            }
            
            // Add event listener
            select.addEventListener('change', (e) => {
                const value = (e.target as HTMLSelectElement).value;
                options.onThemeChange(value);
            });
            
            this.logger.debug('Theme dropdown created successfully', { 
                dropdown, 
                themeCount: options.themes.length 
            });
            
            return dropdown;
        } catch (error) {
            this.logger.error('Failed to create theme dropdown', { options, error });
            throw error;
        }
    }

    /**
     * Create settings button
     */
    createSettingsButton(container: HTMLElement, options: SettingsButtonOptions): HTMLElement {
        this.logger.debug('Creating settings button', { options });

        try {
            const buttonContainer = container.createDiv({ cls: 'settings-button' });

            createIconButton({
                parent: buttonContainer,
                icon: 'settings',
                size: 'sm',
                ariaLabel: 'Coalesce Settings',
                classes: ['coalesce-settings-button'],
                onClick: options.onClick
            });

            this.logger.debug('Settings button created successfully', { buttonContainer });
            return buttonContainer;
        } catch (error) {
            this.logger.error('Failed to create settings button', { options, error });
            throw error;
        }
    }

    /**
     * Update sort button state
     */
    updateSortButtonState(button: HTMLElement, isDescending: boolean): void {
        this.logger.debug('Updating sort button state', { isDescending });
        
        try {
            const svg = button.querySelector('svg') as SVGElement;
            if (svg) {
                if (isDescending) {
                    svg.classList.remove('sort-ascending');
                    svg.classList.add('sort-descending');
                } else {
                    svg.classList.remove('sort-descending');
                    svg.classList.add('sort-ascending');
                }
            }
        } catch (error) {
            this.logger.error('Failed to update sort button state', { button, isDescending, error });
        }
    }

    /**
     * Update collapse button state
     */
    updateCollapseButtonState(button: HTMLElement, isCollapsed: boolean): void {
        this.logger.debug('Updating collapse button state', { isCollapsed });
        
        try {
            // Update icon based on state: chevron-right when collapsed, chevron-down when expanded
            IconProvider.setIcon(
                button,
                isCollapsed ? 'chevronRight' : 'chevronDown',
                { size: 'sm' }
            );
        } catch (error) {
            this.logger.error('Failed to update collapse button state', { button, isCollapsed, error });
        }
    }

    /**
     * Update strategy dropdown selection
     */
    updateStrategySelection(dropdown: HTMLElement, strategy: string): void {
        this.logger.debug('Updating strategy selection', { strategy });
        
        try {
            const select = dropdown.querySelector('.strategy-select') as HTMLSelectElement;
            if (select) {
                select.value = strategy;
                
                // Trigger change event to update any listeners
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
            }
        } catch (error) {
            this.logger.error('Failed to update strategy selection', { dropdown, strategy, error });
        }
    }

    /**
     * Update theme dropdown selection
     */
    updateThemeSelection(dropdown: HTMLElement, theme: string): void {
        this.logger.debug('Updating theme selection', { theme });
        
        try {
            const select = dropdown.querySelector('.theme-select') as HTMLSelectElement;
            if (select) {
                select.value = theme;
                
                // Trigger change event to update any listeners
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
            }
        } catch (error) {
            this.logger.error('Failed to update theme selection', { dropdown, theme, error });
        }
    }

    /**
     * Get display name for strategy
     */
    private getStrategyDisplayName(strategy: string): string {
        switch (strategy) {
            case 'default':
                return 'Default';
            case 'headers-only':
                return 'Headers Only';
            case 'top-line':
                return 'Top Line';
            default:
                return strategy.charAt(0).toUpperCase() + strategy.slice(1).replace(/-/g, ' ');
        }
    }

    /**
     * Get display name for theme
     */
    private getThemeDisplayName(theme: string): string {
        switch (theme) {
            case 'default':
                return 'Default';
            case 'dark':
                return 'Dark';
            case 'light':
                return 'Light';
            case 'obsidian':
                return 'Obsidian';
            default:
                return theme.charAt(0).toUpperCase() + theme.slice(1);
        }
    }

    /**
     * Get current selected strategy
     */
    getCurrentSelectedStrategy(dropdown: HTMLElement): string {
        try {
            const select = dropdown.querySelector('.strategy-select') as HTMLSelectElement;
            return select ? select.value : '';
        } catch (error) {
            this.logger.error('Failed to get current selected strategy', { dropdown, error });
            return '';
        }
    }

    /**
     * Get current selected theme
     */
    getCurrentSelectedTheme(dropdown: HTMLElement): string {
        try {
            const select = dropdown.querySelector('.theme-select') as HTMLSelectElement;
            return select ? select.value : '';
        } catch (error) {
            this.logger.error('Failed to get current selected theme', { dropdown, error });
            return '';
        }
    }

    /**
     * Cleanup resources used by this settings controls
     */
    cleanup(): void {
        this.logger.debug('Cleaning up SettingsControls');
        
        try {
            // No specific cleanup needed for this component
            this.logger.debug('SettingsControls cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup SettingsControls', { error });
        }
    }
}