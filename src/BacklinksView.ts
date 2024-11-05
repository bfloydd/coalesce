import { MarkdownView, TFile } from 'obsidian';
import { Block } from './Block';

export class BacklinksView {
    private container: HTMLElement;
    private currentNoteName: string;

    constructor(private view: MarkdownView, currentNoteName: string) {
        this.currentNoteName = currentNoteName;
        this.container = this.createBacklinksContainer();
        console.log("Appending backlinks container to the view");

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') as HTMLElement || this.view.contentEl as HTMLElement;
        if (markdownContent) {
            // Ensure the parent container respects the readable line length
            markdownContent.style.setProperty('max-width', 'var(--readable-line-length, 800px)', 'important');
            markdownContent.style.setProperty('margin-left', 'auto', 'important');
            markdownContent.style.setProperty('margin-right', 'auto', 'important');
            markdownContent.appendChild(this.container);
        } else {
            console.warn("Markdown content area not found.");
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
                const mentionIndex = content.indexOf('[[' + currentNoteName + ']]');

                if (mentionIndex !== -1) {
                    const lines = content.substring(mentionIndex).split('---')[0];
                    const block = new Block(lines, filePath, currentNoteName);
                    blocks.push(block);
                } else {
                    console.warn(`Current note name "${currentNoteName}" not found in file ${filePath}.`);
                }
            }
        } catch (error) {
            console.error(`Error reading file content for ${filePath}:`, error);
        }
        return blocks;
    }

    public async updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string) => void): Promise<void> {
        console.log("Updating backlinks:", filesLinkingToThis);
        this.container.empty();

        const header = this.container.createEl('h4', {
            text: `${filesLinkingToThis.length} Backlinks`
        });
        console.log("Header created:", header);

        const linksContainer = this.container.createDiv('backlinks-list');
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getFileContentPreview(sourcePath, this.currentNoteName);
            for (const block of blocks) {
                const linkEl = linksContainer.createDiv('backlink-item');
                const anchor = linkEl.createEl('a', {
                    text: block.title,
                    cls: 'internal-link',
                });
                console.log("Link element created:", anchor);

                anchor.addEventListener('click', (event) => {
                    event.preventDefault();
                    onLinkClick(sourcePath);
                });

                const contentPreview = linkEl.createDiv('content-preview');
                contentPreview.textContent = block.contents;
            }
        }

        console.log("Links container:", linksContainer);
    }

    clear() {
        // Remove the container from the DOM
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        console.log("Backlinks view cleared");
    }
}
