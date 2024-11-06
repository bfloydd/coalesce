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
    private blocksCollapsed: boolean;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];

    constructor(private view: MarkdownView, currentNoteName: string, private settingsManager: SettingsManager) {
        this.currentNoteName = currentNoteName;
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;
        this.container = this.createBacklinksContainer();
        this.logger.info("Appending backlinks container to the view");

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') as HTMLElement || this.view.contentEl as HTMLElement;
        if (markdownContent) {
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
        
        // Collect all blocks first
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getBlockData(sourcePath, this.currentNoteName);
            blocks.forEach(block => {
                this.allBlocks.push({ block, sourcePath });
            });
        }

        // Sort blocks
        this.allBlocks.sort((a, b) => this.sortDescending 
            ? b.sourcePath.localeCompare(a.sourcePath)
            : a.sourcePath.localeCompare(b.sourcePath));

        // Render blocks with correct initial state
        for (const { block } of this.allBlocks) {
            await block.render(linksContainer, this.view, onLinkClick);
            const blockContainer = block.getContainer();
            // Use the class property instead of accessing settings directly
            blockContainer.style.display = this.blocksCollapsed ? 'none' : 'block';
            block.setArrowState(!this.blocksCollapsed);
        }

        // Create header after blocks are rendered
        const createHeader = () => {
            return this.headerComponent.createHeader(
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
                    // Update header
                    const oldHeader = this.container.querySelector('.backlinks-header');
                    if (oldHeader) {
                        const newHeader = createHeader();
                        this.container.replaceChild(newHeader, oldHeader);
                    }
                },
                this.blocksCollapsed
            );
        };

        const header = createHeader();
        this.container.insertBefore(header, linksContainer);
    }

    public toggleSort(): void {
        this.sortDescending = !this.sortDescending;
        this.settingsManager.settings.sortDescending = this.sortDescending;
        this.settingsManager.saveSettings();
    }

    private toggleAllBlocks(): void {
        this.blocksCollapsed = !this.blocksCollapsed;
        this.settingsManager.settings.blocksCollapsed = this.blocksCollapsed;
        this.settingsManager.saveSettings();

        // Update all blocks based on the new state
        this.allBlocks.forEach(({ block }) => {
            const blockContainer = block.getContainer();
            blockContainer.style.display = this.blocksCollapsed ? 'none' : 'block';
            block.setArrowState(!this.blocksCollapsed);
        });
    }

    clear() {
        // Remove the container from the DOM totally
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.logger.info("Backlinks view cleared");
    }
}
