import { MarkdownView } from 'obsidian';

export class BacklinksView {
    private container: HTMLElement;

    constructor(private view: MarkdownView) {
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

    public updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string) => void): void {
        console.log("Updating backlinks:", filesLinkingToThis);
        this.container.empty();

        // Add header
        const header = this.container.createEl('h4', {
            text: `${filesLinkingToThis.length} Backlinks`
        });
        console.log("Header created:", header);

        // Add backlinks
        const linksContainer = this.container.createDiv('backlinks-list');
        filesLinkingToThis.forEach(sourcePath => {
            const linkEl = linksContainer.createDiv('backlink-item');
            const anchor = linkEl.createEl('a', {
                text: sourcePath,
                cls: 'internal-link',
            });
            console.log("Link element created:", anchor);

            anchor.addEventListener('click', (event) => {
                event.preventDefault();
                onLinkClick(sourcePath);
            });

            // Fetch and display a few lines of the file
            const fileContent = this.getFileContentPreview(sourcePath);
            const contentPreview = linkEl.createDiv('content-preview');
            contentPreview.textContent = fileContent;
        });

        console.log("Links container:", linksContainer);
    }

    private getFileContentPreview(filePath: string): string {
        // This is a placeholder function. You need to implement the logic to fetch
        // the file content and return a preview (e.g., first few lines).
        // For example, you might use this.app.vault.read(file) to read the file content.
        return "Preview of the file content...";
    }

    clear() {
        // Remove the container from the DOM
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        console.log("Backlinks view cleared");
    }
}
