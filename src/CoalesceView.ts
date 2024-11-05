import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { Block } from './Block';
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

    private async getFileContentPreview(filePath: string, currentNoteName: string): Promise<Block[]> {
        const blocks: Block[] = [];
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
                    const startIndex = match.index;
                    const endIndex = content.indexOf('---', startIndex);
                    const nextMentionIndex = content.indexOf(`[[${currentNoteName}]]`, startIndex + 1);

                    let blockEndIndex = content.length;
                    if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
                        blockEndIndex = endIndex;
                    } else if (nextMentionIndex !== -1) {
                        blockEndIndex = nextMentionIndex;
                    }

                    const blockContent = content.substring(startIndex, blockEndIndex);
                    const block = new Block(blockContent, filePath, currentNoteName);
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
                const linkEl = linksContainer.createDiv('backlink-item');
                linkEl.style.border = '1px solid var(--background-modifier-border)';
                linkEl.style.padding = '10px';
                linkEl.style.marginBottom = '10px';

                const anchor = linkEl.createEl('a', {
                    text: block.title,
                    cls: 'internal-link',
                });
                this.logger.info("Link element created:", anchor);

                anchor.addEventListener('click', (event) => {
                    event.preventDefault();
                    onLinkClick(sourcePath);
                });

                const contentPreview = linkEl.createDiv('content-preview');
                // Use Obsidian's MarkdownRenderer to render markdown content
                await MarkdownRenderer.render(
                    this.view.app,   // app
                    block.contents, // markdown
                    contentPreview, // el
                    sourcePath,     // sourcePath
                    this.view,      // component
                );
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
