import { MarkdownView } from 'obsidian';

export class BacklinksView {
    private container: HTMLElement;

    constructor(private view: MarkdownView) {
        this.container = this.createBacklinksContainer();
        console.log("Appending backlinks container to the view");

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') || this.view.contentEl;
        if (markdownContent) {
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
        container.style.position = 'relative'; // Ensure it's positioned relative to its parent
        container.style.zIndex = '10'; // Ensure it appears above other elements
        container.style.backgroundColor = 'var(--background-primary)'; // Use theme variable for background
        container.style.color = 'var(--text-normal)'; // Use theme variable for text color
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
        });

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
