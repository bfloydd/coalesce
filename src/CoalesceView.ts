import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from './BlockComponent';
import { Logger } from './Logger';
import { HeaderComponent } from './HeaderComponent';

export class CoalesceView {
    private container: HTMLElement;
    private currentNoteName: string;
    private logger: Logger = new Logger();
    private headerComponent: HeaderComponent = new HeaderComponent();

    constructor(private view: MarkdownView, currentNoteName: string) {
        this.currentNoteName = currentNoteName;
        this.container = this.createBacklinksContainer();
        this.logger.info("Appending backlinks container to the view");

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') as HTMLElement || this.view.contentEl as HTMLElement;
        if (markdownContent) {
            // Ensure the parent container respects the readable line length
            markdownContent.style.setProperty('max-width', 'var(--readable-line-length, 800px)', 'important');
            markdownContent.style.setProperty('margin-left', 'auto', 'important');
            markdownContent.style.setProperty('margin-right', 'auto', 'important');
            markdownContent.appendChild(this.container);
        } else {
            this.logger.warn("Markdown content area not found.");
        }
    }

    private createBacklinksContainer(): HTMLElement {
        const container = document.createElement('div');
        container.classList.add('custom-backlinks-container');
        container.style.borderTop = '1px solid var(--background-modifier-border)';
        container.style.marginTop = '20px';
        container.style.paddingTop = '10px';
        container.style.position = 'relative';
        container.style.zIndex = '10';
        container.style.backgroundColor = 'var(--background-primary)';
        container.style.color = 'var(--text-normal)';
        container.style.maxWidth = 'var(--readable-line-length)';
        container.style.marginLeft = 'auto';
        container.style.marginRight = 'auto';
        return container;
    }

    private async getFileContentPreview(filePath: string, currentNoteName: string): Promise<BlockComponent[]> {
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

        const header = this.headerComponent.createHeader(this.container, `${filesLinkingToThis.length} Backlinks`);
        this.logger.info("Header created:", header);

        const linksContainer = this.container.createDiv('backlinks-list');
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getFileContentPreview(sourcePath, this.currentNoteName);
            for (const block of blocks) {
                await block.render(linksContainer, this.view, onLinkClick);
            }
        }

        this.logger.info("Links container:", linksContainer);
    }

    clear() {
        // Remove the container from the DOM
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.logger.info("Backlinks view cleared");
    }
}
