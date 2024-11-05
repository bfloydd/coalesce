import { MarkdownRenderer, MarkdownView } from 'obsidian';

export class BlockComponent {
    constructor(
        public contents: string,
        public filePath: string,
        public title: string
    ) {}

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string) => void): Promise<void> {
        // Create a block container
        const blockContainer = container.createDiv('backlink-item');
        blockContainer.style.border = '1px solid var(--background-modifier-border)';
        blockContainer.style.padding = '10px';
        blockContainer.style.marginBottom = '10px';

        // Create and style the link
        const anchor = blockContainer.createEl('a', {
            text: this.title,
            cls: 'internal-link',
        });

        anchor.addEventListener('click', (event) => {
            event.preventDefault();
            onLinkClick(this.filePath);
        });

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
