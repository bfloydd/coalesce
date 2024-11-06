import { MarkdownRenderer, MarkdownView } from 'obsidian';

export class BlockComponent {
    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string
    ) {}

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string) => void): Promise<void> {
        // Remove the .md extension from the filePath for display
        const displayText = this.filePath.replace(/\.md$/, '');

        // Create a separate clickable element for displayText above the block border
        const displayTextEl = container.createEl('a', {
            text: displayText,
            cls: 'display-text',
            href: '#', // Use a placeholder href
        });
        displayTextEl.style.display = 'block'; // Ensure it behaves like a block element
        displayTextEl.style.marginBottom = '5px'; // Add some space between the text and the block

        displayTextEl.addEventListener('click', (event) => {
            event.preventDefault();
            onLinkClick(this.filePath);
        });

        // Create a block container with the class 'backlink-item'
        const blockContainer = container.createDiv({ cls: 'backlink-item' });

        // Render the markdown content
        const contentPreview = blockContainer.createDiv('content-preview');

        await MarkdownRenderer.render(
            view.app,       // app
            this.contents,  // markdown
            contentPreview, // el
            this.filePath,  // sourcePath
            view,           // component
        );
    }
}
