import { Logger } from '../shared-utilities/Logger';
import { IFilterControls, FilterInputOptions, AliasDropdownOptions } from './types';

/**
 * Filter Controls for Backlinks Header Slice
 * 
 * Handles filter input and alias dropdown controls
 * for the vertical slice architecture.
 */
export class FilterControls implements IFilterControls {
    private logger: Logger;
    private debounceTimeout: NodeJS.Timeout | null = null;

    constructor(logger: Logger) {
        this.logger = logger.child('FilterControls');
        
        this.logger.debug('FilterControls initialized');
    }

    /**
     * Create filter input element
     */
    createFilterInput(container: HTMLElement, options: FilterInputOptions): HTMLInputElement {
        this.logger.debug('Creating filter input', { options });
        
        try {
            // Create input element
            const input = container.createEl('input', {
                type: 'text',
                cls: 'filter-input',
                attr: {
                    placeholder: options.placeholder,
                    value: options.value
                }
            });
            
            // Add event listeners
            input.addEventListener('input', (e) => {
                const value = (e.target as HTMLInputElement).value;
                this.handleFilterInput(value, options.onInput);
            });
            
            input.addEventListener('focus', () => {
                options.onFocus();
            });
            
            input.addEventListener('blur', () => {
                options.onBlur();
            });
            
            this.logger.debug('Filter input created successfully', { input });
            return input;
        } catch (error) {
            this.logger.error('Failed to create filter input', { options, error });
            throw error;
        }
    }

    /**
     * Create alias dropdown element
     */
    createAliasDropdown(container: HTMLElement, options: AliasDropdownOptions): HTMLElement {
        this.logger.debug('Creating alias dropdown', { options });
        
        try {
            // Create dropdown container
            const dropdown = container.createDiv({ cls: 'alias-dropdown' });
            
            // Create select element
            const select = dropdown.createEl('select', {
                cls: 'alias-select'
            });
            
            // Add "All Aliases" option
            const allOption = select.createEl('option', {
                value: '',
                text: 'All Aliases'
            });
            
            if (options.currentAlias === null) {
                allOption.selected = true;
            }
            
            // Add saved aliases
            for (const alias of options.aliases) {
                const option = select.createEl('option', {
                    value: alias,
                    text: alias
                });
                
                if (options.currentAlias === alias) {
                    option.selected = true;
                }
            }
            
            // Add unsaved aliases
            if (options.unsavedAliases.length > 0) {
                const separator = select.createEl('option', {
                    value: '',
                    text: '──────────'
                });
                separator.disabled = true;
                
                for (const alias of options.unsavedAliases) {
                    const option = select.createEl('option', {
                        value: alias,
                        text: `${alias} (unsaved)`
                    });
                    
                    if (options.currentAlias === alias) {
                        option.selected = true;
                    }
                }
            }
            
            // Add event listener
            select.addEventListener('change', (e) => {
                const value = (e.target as HTMLSelectElement).value;
                const selectedAlias = value || null;
                options.onAliasSelect(selectedAlias);
            });
            
            this.logger.debug('Alias dropdown created successfully', { 
                dropdown, 
                aliasCount: options.aliases.length + options.unsavedAliases.length 
            });
            
            return dropdown;
        } catch (error) {
            this.logger.error('Failed to create alias dropdown', { options, error });
            throw error;
        }
    }

    /**
     * Update filter text
     */
    updateFilterText(input: HTMLInputElement, text: string): void {
        this.logger.debug('Updating filter text', { text });
        
        try {
            if (input.value !== text) {
                input.value = text;
                
                // Trigger input event to update any listeners
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                
                this.logger.debug('Filter text updated successfully', { text });
            }
        } catch (error) {
            this.logger.error('Failed to update filter text', { input, text, error });
        }
    }

    /**
     * Update alias selection
     */
    updateAliasSelection(dropdown: HTMLElement, alias: string | null): void {
        this.logger.debug('Updating alias selection', { alias });
        
        try {
            const select = dropdown.querySelector('.alias-select') as HTMLSelectElement;
            if (select) {
                select.value = alias || '';
                
                // Trigger change event to update any listeners
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
                
                this.logger.debug('Alias selection updated successfully', { alias });
            }
        } catch (error) {
            this.logger.error('Failed to update alias selection', { dropdown, alias, error });
        }
    }

    /**
     * Get current filter text
     */
    getCurrentFilterText(input: HTMLInputElement): string {
        return input.value;
    }

    /**
     * Get current selected alias
     */
    getCurrentSelectedAlias(dropdown: HTMLElement): string | null {
        try {
            const select = dropdown.querySelector('.alias-select') as HTMLSelectElement;
            if (select) {
                const value = select.value;
                return value || null;
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to get current selected alias', { dropdown, error });
            return null;
        }
    }

    /**
     * Clear filter text
     */
    clearFilterText(input: HTMLInputElement): void {
        this.updateFilterText(input, '');
    }

    /**
     * Clear alias selection
     */
    clearAliasSelection(dropdown: HTMLElement): void {
        this.updateAliasSelection(dropdown, null);
    }

    /**
     * Handle filter input with debouncing
     */
    private handleFilterInput(value: string, onInput: (value: string) => void): void {
        // Clear existing timeout
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        // Set new timeout
        this.debounceTimeout = setTimeout(() => {
            onInput(value);
            this.debounceTimeout = null;
        }, 150); // 150ms debounce
    }

    /**
     * Cleanup resources used by this filter controls
     */
    cleanup(): void {
        this.logger.debug('Cleaning up FilterControls');
        
        try {
            // Clear debounce timeout
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = null;
            }
            
            this.logger.debug('FilterControls cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup FilterControls', { error });
        }
    }
}