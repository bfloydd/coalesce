import { MarkdownRenderer, MarkdownView } from 'obsidian';

export class BlockComponent {
    private blockContainer: HTMLElement;
    private toggleButton: HTMLElement;

    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string
    ) {}

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
            text: displayText,
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
}
