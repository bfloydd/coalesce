import { MarkdownRenderer, MarkdownView } from 'obsidian';
import { Logger } from './Logger';

export class BlockComponent {
    private blockContainer: HTMLElement;
    private toggleButton: HTMLElement;
    private logger: Logger;

    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string,
        private showFullPathTitle: boolean
    ) {
        this.logger = new Logger();
    }

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string) => void): Promise<void> {
        const displayText = this.filePath.replace(/\.md$/, '');

        // Create a container for the display text and toggle button
        const headerContainer = container.createDiv({ cls: 'block-header' });

        // Create the toggle button
        this.toggleButton = headerContainer.createEl('span', {
            cls: 'toggle-arrow',
            text: '▼', // Down-pointing arrow for open state
        });

        // Block header
        const blockTitle = headerContainer.createEl('a', {
            text: this.getDisplayTitle(this.filePath, this.showFullPathTitle),
            cls: 'block-title',
            href: '#',
        });
        blockTitle.addEventListener('click', (event) => {
            event.preventDefault();
            onLinkClick(this.filePath);
        });

        // Create a block container with the class 'backlink-item'
        const blockContainer = container.createDiv({ cls: 'backlink-item' });

        // Render the markdown content
        const contentPreview = blockContainer.createDiv('content-preview');

        await MarkdownRenderer.render(
            view.app,
            this.contents,
            contentPreview,
            this.filePath,
            view,
        );

        // Add click handlers for internal links, without debug logging
        contentPreview.querySelectorAll('a.internal-link').forEach((link: HTMLElement) => {
            link.addEventListener('click', (event) => {
                this.logger.info("Link clicked!");

                event.preventDefault();
                const href = link.getAttribute('href');
                if (href) {
                    const decodedPath = decodeURI(href);
                    // Check if it's a canvas file first, otherwise handle as markdown
                    const fullPath = decodedPath.endsWith('.canvas') 
                        ? decodedPath 
                        : decodedPath.endsWith('.md') 
                            ? decodedPath 
                            : `${decodedPath}.md`;
                    onLinkClick(fullPath);
                }
            });
        });

        // Initially show the entire block container
        blockContainer.style.display = 'block';

        // Show/hide a single block
        this.toggleButton.addEventListener('click', () => {
            const isCollapsed = blockContainer.style.display === 'none';
            blockContainer.style.display = isCollapsed ? 'block' : 'none';
            this.toggleButton.textContent = isCollapsed ? '▼' : '▶'; // Toggle arrow direction
        });

        this.blockContainer = blockContainer; // Save the reference
    }

    getContainer(): HTMLElement {
        return this.blockContainer;
    }

    setArrowState(isExpanded: boolean): void {
        if (this.toggleButton) {
            this.toggleButton.textContent = isExpanded ? '▼' : '▶';
        }
    }

    private getDisplayTitle(filePath: string, showFullPath: boolean): string {
        if (showFullPath) {
            return filePath.replace(/\.md$/, '');
        } else {
            const parts = filePath.split('/');
            return parts[parts.length - 1].replace(/\.md$/, '');
        }
    }
}
