import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from './BlockComponent';
import { Logger } from './Logger';
import { HeaderComponent } from './HeaderComponent';
import { SettingsManager } from './SettingsManager';

export class CoalesceView {
    private container: HTMLElement;
    private currentNoteName: string;
    private logger: Logger = new Logger();
    private headerComponent: HeaderComponent = new HeaderComponent();
    private sortDescending: boolean;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];

    constructor(private view: MarkdownView, currentNoteName: string, private settingsManager: SettingsManager) {
        this.currentNoteName = currentNoteName;
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.container = this.createBacklinksContainer();
        this.logger.info("Appending backlinks container to the view");

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') as HTMLElement || this.view.contentEl as HTMLElement;
        if (markdownContent) {
            // Add the markdown-content class for styling
            markdownContent.classList.add('markdown-content');
            markdownContent.appendChild(this.container);

        } else {
            this.logger.warn("Markdown content area not found.");
        }
    }

    private createBacklinksContainer(): HTMLElement {
        const container = document.createElement('div');
        container.classList.add('custom-backlinks-container');
        return container;
    }

    private async getBlockData(filePath: string, currentNoteName: string): Promise<BlockComponent[]> {
        const blocks: BlockComponent[] = [];
        
        try {
            const file = this.view.app.vault.getAbstractFileByPath(filePath);
            
            if (file && file instanceof TFile) {
                const content = await this.view.app.vault.read(file);
                const regex = new RegExp(`\\[\\[${currentNoteName}\\]\\]`, 'g');
                let match;

                /**
                 * There are three conditions of how a block can end:
                 * 1. --- is found.
                 * 2. End of the note.
                 * 3. Another block is found.
                 */
                
                while ((match = regex.exec(content)) !== null) {
                    // Find the start of the line containing the match
                    const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
                    const endIndex = content.indexOf('---', match.index);
                    const nextMentionIndex = content.indexOf(`[[${currentNoteName}]]`, match.index + 1);

                    let blockEndIndex = content.length;
                    if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
                        blockEndIndex = endIndex;
                    } else if (nextMentionIndex !== -1) {
                        blockEndIndex = nextMentionIndex;
                    }

                    const blockContent = content.substring(lineStartIndex, blockEndIndex);
                    const block = new BlockComponent(blockContent, filePath, currentNoteName);
                    blocks.push(block);
                }
            }
        } catch (error) {
            console.error(`Error reading file content for ${filePath}:`, error);
        }
        return blocks;
    }

    public async updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string) => void): Promise<void> {
        this.logger.info("Updating backlinks:", filesLinkingToThis);
        this.container.empty();

        const linksContainer = this.container.createDiv('backlinks-list');
        this.logger.info("Links container:", linksContainer);

        this.allBlocks = [];
        
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getBlockData(sourcePath, this.currentNoteName);
            blocks.forEach(block => {
                this.allBlocks.push({ block, sourcePath });
            });
        }

        this.allBlocks.sort((a, b) => this.sortDescending 
            ? b.sourcePath.localeCompare(a.sourcePath)
            : a.sourcePath.localeCompare(b.sourcePath));

        for (const { block } of this.allBlocks) {
            await block.render(linksContainer, this.view, onLinkClick);
        }

        const header = this.headerComponent.createHeader(
            this.container, 
            filesLinkingToThis.length, 
            this.allBlocks.length,
            this.sortDescending,
            () => {
                this.toggleSort();
                this.updateBacklinks(filesLinkingToThis, onLinkClick);
            },
            () => {
                this.toggleAllBlocks();
            }
        );
        this.logger.info("Header created:", header);

        this.container.insertBefore(header, linksContainer);
    }

    public toggleSort(): void {
        this.sortDescending = !this.sortDescending;
        this.settingsManager.settings.sortDescending = this.sortDescending;
        this.settingsManager.saveSettings();
    }

    private toggleAllBlocks(): void {
        const isAnyBlockVisible = this.allBlocks.some(({ block }) => {
            const blockContainer = block.getContainer();
            return blockContainer.style.display !== 'none';
        });

        this.allBlocks.forEach(({ block }) => {
            const blockContainer = block.getContainer();
            blockContainer.style.display = isAnyBlockVisible ? 'none' : 'block';
        });
    }

    clear() {
        // Remove the container from the DOM
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.logger.info("Backlinks view cleared");
    }
}
