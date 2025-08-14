import { App, TFile, Notice } from 'obsidian';
import { Logger } from '../utils/Logger';

export class HeadingPopupComponent {
    private app: App;
    private logger: Logger;
    private modal: HTMLDivElement | null = null;
    private input: HTMLInputElement | null = null;

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger;
    }

    show(filePath: string, onHeadingAdded: () => void): void {
        this.logger.debug('Showing heading popup', { filePath });

        // Create modal container
        this.modal = document.createElement('div');
        this.modal.className = 'heading-popup-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Create popup content
        const popup = document.createElement('div');
        popup.className = 'heading-popup-content';
        popup.style.cssText = `
            background: var(--background-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        // Create title
        const title = document.createElement('h3');
        title.textContent = 'Add a Heading';
        title.style.cssText = `
            margin: 0 0 16px 0;
            color: var(--text-normal);
            font-size: 18px;
            font-weight: 600;
        `;

        // Create input field
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Enter heading text...';
        this.input.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--background-secondary);
            color: var(--text-normal);
            font-size: 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
        `;

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;

        // Create cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--background-secondary);
            color: var(--text-normal);
            cursor: pointer;
            font-size: 14px;
        `;

        // Create add button
        const addButton = document.createElement('button');
        addButton.textContent = 'Add Heading';
        addButton.style.cssText = `
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        `;

        // Add event listeners
        cancelButton.addEventListener('click', () => this.close());
        addButton.addEventListener('click', () => this.handleAddHeading(filePath, onHeadingAdded));
        
        // Handle Enter key on input
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleAddHeading(filePath, onHeadingAdded);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Handle click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Assemble the popup
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(addButton);
        popup.appendChild(title);
        popup.appendChild(this.input);
        popup.appendChild(buttonContainer);
        this.modal.appendChild(popup);

        // Add to DOM and focus input
        document.body.appendChild(this.modal);
        this.input.focus();
        this.input.select();

        this.logger.debug('Heading popup displayed');
    }

    private async handleAddHeading(filePath: string, onHeadingAdded: () => void): Promise<void> {
        if (!this.input) return;

        const headingText = this.input.value.trim();
        if (!headingText) {
            new Notice('Please enter a heading');
            return;
        }

        // Additional validation
        if (headingText.length > 200) {
            new Notice('Heading is too long. Please keep it under 200 characters.');
            return;
        }

        // Check for potentially problematic characters
        if (/[<>:"|?*]/.test(headingText)) {
            new Notice('Heading contains invalid characters. Please avoid < > : " | ? *');
            return;
        }

        this.logger.debug('Adding heading to file', { filePath, headingText });

        // Get reference to the add button before try block
        const addButton = this.modal?.querySelector('button:last-child') as HTMLButtonElement;

        try {
            // Disable the add button to prevent double-clicks
            if (addButton) {
                addButton.disabled = true;
                addButton.textContent = 'Adding...';
            }

            await this.addHeadingToFile(filePath, headingText);
            new Notice(`Heading "${headingText}" added successfully`);
            this.close();
            onHeadingAdded();
        } catch (error) {
            this.logger.error('Failed to add heading to file', error);
            
            // Re-enable the add button
            if (addButton) {
                addButton.disabled = false;
                addButton.textContent = 'Add Heading';
            }

            // Show more specific error messages
            let errorMessage = 'Failed to add heading. Please try again.';
            if (error instanceof Error) {
                if (error.message.includes('File not found')) {
                    errorMessage = 'File not found. It may have been moved or deleted.';
                } else if (error.message.includes('Content validation failed')) {
                    errorMessage = 'Content validation failed. The file may be corrupted.';
                } else if (error.message.includes('Permission')) {
                    errorMessage = 'Permission denied. Check file permissions.';
                }
            }
            new Notice(errorMessage);
        }
    }

    private async addHeadingToFile(filePath: string, headingText: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
            throw new Error('File not found');
        }

        // Read current content
        const currentContent = await this.app.vault.read(file);
        this.logger.debug('Current file content length', { length: currentContent.length });

        // Validate that we have content to work with
        if (currentContent === null || currentContent === undefined) {
            throw new Error('File content is empty or invalid');
        }

        // Find the best place to insert the heading
        const newContent = this.insertHeadingSafely(currentContent, headingText);
        
        // Validate the new content before writing
        if (!newContent || newContent.length < headingText.length) {
            throw new Error('Generated content is invalid or too short');
        }

        // Ensure we're not losing significant content
        if (newContent.length < currentContent.length * 0.9) {
            this.logger.warn('New content is significantly shorter than original', {
                originalLength: currentContent.length,
                newLength: newContent.length,
                difference: currentContent.length - newContent.length
            });
            throw new Error('Content validation failed: new content too short');
        }
        
        // Write the new content
        await this.app.vault.modify(file, newContent);
        
        this.logger.debug('Heading added to file successfully', { 
            filePath, 
            headingText,
            originalLength: currentContent.length,
            newLength: newContent.length
        });
    }

    private insertHeadingSafely(currentContent: string, headingText: string): string {
        const lines = currentContent.split('\n');
        this.logger.debug('Processing file lines', { totalLines: lines.length });

        // Find the best place to insert the heading
        let insertIndex = 0;
        
        // Strategy 1: Look for the first non-empty line that's not a heading
        // This is usually where the backlink or content starts
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                insertIndex = i + 1; // Insert after this line
                this.logger.debug('Found insertion point after non-heading line', { 
                    lineIndex: i, 
                    lineContent: line.substring(0, 50) + (line.length > 50 ? '...' : '') 
                });
                break;
            }
        }

        // Strategy 2: If we didn't find a good spot, look for the first line with content
        if (insertIndex === 0) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim()) {
                    insertIndex = i + 1;
                    this.logger.debug('Found insertion point after first content line', { 
                        lineIndex: i, 
                        lineContent: lines[i].substring(0, 50) + (lines[i].length > 50 ? '...' : '') 
                    });
                    break;
                }
            }
        }

        // Strategy 3: If still no good spot, insert at the very beginning
        if (insertIndex === 0) {
            insertIndex = 0;
            this.logger.debug('Inserting heading at the very beginning of file');
        }

        // Create the new heading line
        const newHeadingLine = `# ${headingText}`;
        
        // Insert the heading and ensure proper spacing
        const newLines = [...lines];
        newLines.splice(insertIndex, 0, newHeadingLine, ''); // Add heading + empty line

        const newContent = newLines.join('\n');
        
        this.logger.debug('Heading insertion details', {
            insertIndex,
            newHeadingLine,
            linesBefore: lines.slice(0, insertIndex).length,
            linesAfter: lines.slice(insertIndex).length,
            totalNewLines: newLines.length,
            insertionStrategy: insertIndex === 0 ? 'beginning' : 'after-content'
        });

        return newContent;
    }

    close(): void {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
            this.input = null;
        }
        this.logger.debug('Heading popup closed');
    }
}
