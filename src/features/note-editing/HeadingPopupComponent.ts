import { App, TFile, Modal, Setting } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IHeadingPopupComponent } from './types';

/**
 * Heading Popup Component for Note Editing Slice
 * 
 * Handles the UI for adding headings to files
 * for the vertical slice architecture.
 */
export class HeadingPopupComponent extends Modal implements IHeadingPopupComponent {
    private logger: Logger;
    private onHeadingAdded?: (heading: string) => void | Promise<void>;
    private filePath: string;
    private inputElement?: HTMLInputElement;
    private isPopupVisible = false;

    constructor(app: App, filePath: string, onHeadingAdded?: (heading: string) => void | Promise<void>) {
        super(app);
        this.filePath = filePath;
        this.onHeadingAdded = onHeadingAdded;
        this.logger = new Logger('HeadingPopupComponent');
        
        this.logger.debug('HeadingPopupComponent initialized', { filePath });
    }

    /**
     * Show the heading popup
     */
    show(options: {
        filePath: string;
        onHeadingAdded?: (heading: string) => void | Promise<void>;
        initialText?: string;
    }): void {
        this.logger.debug('Showing heading popup', { options });
        
        try {
            // Update properties
            this.filePath = options.filePath;
            this.onHeadingAdded = options.onHeadingAdded;
            
            // Open the modal
            this.open();
            
            // Set initial text if provided
            if (options.initialText && this.inputElement) {
                this.inputElement.value = options.initialText;
            }
            
            // Focus the input
            this.focusInput();
            
            this.isPopupVisible = true;
            
            this.logger.debug('Heading popup shown successfully', { filePath: this.filePath });
        } catch (error) {
            this.logger.error('Failed to show heading popup', { options, error });
        }
    }

    /**
     * Hide the heading popup
     */
    hide(): void {
        this.logger.debug('Hiding heading popup');
        
        try {
            this.close();
            this.isPopupVisible = false;
            
            this.logger.debug('Heading popup hidden successfully');
        } catch (error) {
            this.logger.error('Failed to hide heading popup', { error });
        }
    }

    /**
     * Check if popup is visible
     */
    isVisible(): boolean {
        return this.isPopupVisible;
    }

    /**
     * Focus the input field
     */
    focusInput(): boolean {
        this.logger.debug('Focusing input field');
        
        try {
            if (this.inputElement) {
                this.inputElement.focus();
                this.inputElement.select();
                
                this.logger.debug('Input field focused successfully');
                return true;
            }
            
            this.logger.debug('Input element not available for focusing');
            return false;
        } catch (error) {
            this.logger.error('Failed to focus input field', { error });
            return false;
        }
    }

    /**
     * Get current input value
     */
    getInputValue(): string {
        this.logger.debug('Getting input value');
        
        try {
            if (this.inputElement) {
                const value = this.inputElement.value;
                this.logger.debug('Input value retrieved', { value });
                return value;
            }
            
            this.logger.debug('Input element not available');
            return '';
        } catch (error) {
            this.logger.error('Failed to get input value', { error });
            return '';
        }
    }

    /**
     * Set input value
     */
    setInputValue(value: string): void {
        this.logger.debug('Setting input value', { value });
        
        try {
            if (this.inputElement) {
                this.inputElement.value = value;
                this.logger.debug('Input value set successfully', { value });
            } else {
                this.logger.debug('Input element not available for setting value');
            }
        } catch (error) {
            this.logger.error('Failed to set input value', { value, error });
        }
    }

    /**
     * Override the onOpen method to set up the modal content
     */
    onOpen(): void {
        this.logger.debug('Heading popup opened');
        
        try {
            const { contentEl } = this;
            
            // Set up the modal content
            contentEl.createEl('h2', { text: 'Add Heading' });
            
            // Create the input field
            new Setting(contentEl)
                .setName('Heading Text')
                .setDesc('Enter the heading text to add to the file')
                .addText(text => {
                    this.inputElement = text.inputEl;
                    text.inputEl.placeholder = 'Enter heading...';
                    
                    // Handle Enter key
                    text.inputEl.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void this.handleAddHeading();
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            this.hide();
                        }
                    });
                });
            
            // Create buttons
            const buttonContainer = contentEl.createDiv('modal-button-container');
            
            // Add button
            const addButton = buttonContainer.createEl('button', {
                text: 'Add Heading',
                cls: 'mod-cta'
            });
            
            addButton.addEventListener('click', () => {
                void this.handleAddHeading();
            });
            
            // Cancel button
            const cancelButton = buttonContainer.createEl('button', {
                text: 'Cancel'
            });
            
            cancelButton.addEventListener('click', () => {
                this.hide();
            });
            
            // Focus the input field
            setTimeout(() => {
                this.focusInput();
            }, 100);
            
            this.logger.debug('Heading popup content set up successfully');
        } catch (error) {
            this.logger.error('Failed to set up heading popup content', { error });
        }
    }

    /**
     * Override the onClose method to clean up
     */
    onClose(): void {
        this.logger.debug('Heading popup closed');
        
        try {
            const { contentEl } = this;
            contentEl.empty();
            
            this.isPopupVisible = false;
            this.inputElement = undefined;
            
            this.logger.debug('Heading popup cleanup completed');
        } catch (error) {
            this.logger.error('Failed to clean up heading popup', { error });
        }
    }

    /**
     * Handle adding the heading
     */
    private async handleAddHeading(): Promise<void> {
        this.logger.debug('Handling add heading');
        
        try {
            const headingText = this.getInputValue().trim();
            
            if (!headingText) {
                this.logger.debug('Empty heading text, not adding');
                return;
            }
            
            // Call the callback if provided
            if (this.onHeadingAdded) {
                await this.onHeadingAdded(headingText);
            }
            
            // Hide the popup
            this.hide();
            
            this.logger.debug('Heading added successfully', { 
                filePath: this.filePath, 
                headingText 
            });
        } catch (error) {
            this.logger.error('Failed to handle add heading', { error });
        }
    }

    /**
     * Validate the current input
     */
    validateInput(): {
        isValid: boolean;
        errors: string[];
    } {
        this.logger.debug('Validating input');
        
        const result = {
            isValid: true,
            errors: [] as string[]
        };
        
        try {
            const value = this.getInputValue().trim();
            
            // Check if empty
            if (!value) {
                result.isValid = false;
                result.errors.push('Heading text cannot be empty');
            }
            
            // Check for invalid characters
            const invalidChars = ['\n', '\r', '\t'];
            for (const char of invalidChars) {
                if (value.includes(char)) {
                    result.isValid = false;
                    result.errors.push(`Heading cannot contain ${char}`);
                }
            }
            
            // Check length
            if (value.length > 200) {
                result.isValid = false;
                result.errors.push('Heading is too long (max 200 characters)');
            }
            
            this.logger.debug('Input validation completed', { 
                value, 
                isValid: result.isValid, 
                errorCount: result.errors.length 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to validate input', { error });
            
            result.isValid = false;
            result.errors.push('Validation failed due to error');
            
            return result;
        }
    }

    /**
     * Get statistics about popup usage
     */
    getStatistics(): {
        timesShown: number;
        timesHidden: number;
        headingsAdded: number;
    } {
        // This would need actual tracking in a real implementation
        // For now, return basic statistics
        return {
            timesShown: 0,
            timesHidden: 0,
            headingsAdded: 0
        };
    }

    /**
     * Cleanup resources used by this popup component
     */
    cleanup(): void {
        this.logger.debug('Cleaning up HeadingPopupComponent');
        
        try {
            // Hide the popup if visible
            if (this.isVisible()) {
                this.hide();
            }
            
            // Clear references
            this.onHeadingAdded = undefined;
            this.inputElement = undefined;
            
            this.logger.debug('HeadingPopupComponent cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup HeadingPopupComponent', { error });
        }
    }
}