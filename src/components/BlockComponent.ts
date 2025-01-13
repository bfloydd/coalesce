import { MarkdownRenderer, MarkdownView } from 'obsidian';
import { Logger } from '../Logger';

export class BlockComponent {
    private mainContainer: HTMLElement;
    private headerContainer: HTMLElement;
    private toggleButton: HTMLElement;

    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string,
        private showFullPathTitle: boolean,
        private logger: Logger
    ) {}

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string) => void): Promise<void> {
        const displayText = this.filePath.replace(/\.md$/, '');

        // Create main container
        this.mainContainer = container.createDiv({ cls: 'backlink-item' });

        // Create header container
        this.headerContainer = this.mainContainer.createDiv({ cls: 'block-header' });

        // Create the toggle button
        this.toggleButton = this.headerContainer.createEl('span', {
            cls: 'toggle-arrow',
            text: '▼',
        });

        // Block header
        const blockTitle = this.headerContainer.createEl('a', {
            text: this.getDisplayTitle(this.filePath, this.showFullPathTitle),
            cls: 'block-title',
            href: '#',
        });
        blockTitle.addEventListener('click', (event) => {
            event.preventDefault();
            onLinkClick(this.filePath);
        });

        // Create content container
        const contentPreview = this.mainContainer.createDiv('content-preview');

        await MarkdownRenderer.render(
            view.app,
            this.contents,
            contentPreview,
            this.filePath,
            view,
        );

        // Add click handlers for internal links
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
        contentPreview.style.display = 'block';

        // Show/hide a single block
        this.toggleButton.addEventListener('click', () => {
            const isCollapsed = contentPreview.style.display === 'none';
            contentPreview.style.display = isCollapsed ? 'block' : 'none';
            this.toggleButton.textContent = isCollapsed ? '▼' : '▶';
        });
    }

    getContainer(): HTMLElement {
        return this.mainContainer;
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

    public updateTitleDisplay(showFullPath: boolean): void {
        const titleElement = this.headerContainer?.querySelector('.block-title') as HTMLAnchorElement;
        if (titleElement) {
            titleElement.textContent = this.getDisplayTitle(this.filePath, showFullPath);
        }
    }

    private getFileName(path: string): string {
        return path.split('/').pop()?.replace('.md', '') || path;
    }
}
