import { MarkdownRenderer, MarkdownView } from 'obsidian';
import { Logger } from '../utils/Logger';
import { BlockFinderFactory } from '../block-finders/BlockFinderFactory';
import { AbstractBlockFinder } from '../block-finders/base/AbstractBlockFinder';
import { HeaderStyleFactory } from '../header-styles/HeaderStyleFactory';
import { AbstractHeaderStyle } from '../header-styles/base/AbstractHeaderStyle';

export class BlockComponent {
    private mainContainer: HTMLElement;
    private headerContainer: HTMLElement;
    private toggleButton: HTMLElement;
    private blockFinder: AbstractBlockFinder;
    private headerStyleInstance: AbstractHeaderStyle;

    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string,
        private headerStyle: string,
        private logger: Logger,
        private strategy: string = 'default',
        private hideBacklinkLine: boolean = false
    ) {
        this.logger.debug('Creating block component', {
            filePath,
            noteName,
            headerStyle,
            strategy,
            hideBacklinkLine,
            contentLength: contents.length
        });

        this.blockFinder = BlockFinderFactory.createBlockFinder(strategy, logger);
        this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(headerStyle, contents);
    }

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string) => void): Promise<void> {
        this.logger.debug('Rendering block component', {
            filePath: this.filePath,
            noteName: this.noteName,
            containerExists: !!container,
            viewExists: !!view
        });

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
            text: this.getDisplayTitle(this.filePath, this.headerStyle),
            cls: 'block-title',
            href: '#',
        });
        blockTitle.addEventListener('click', (event) => {
            event.preventDefault();
            this.logger.debug('Block title clicked', {
                filePath: this.filePath
            });
            onLinkClick(this.filePath);
        });

        // Create content container
        const contentPreview = this.mainContainer.createDiv('content-preview') as HTMLDivElement;

        // Filter content if using Headers Only strategy or hiding backlink line
        let contentToRender = this.contents;
        
        if (this.strategy === 'headers-only') {
            const lines = this.contents.split('\n');
            const headerLines = lines.filter(line => /^#{1,5}\s/.test(line));
            contentToRender = headerLines.join('\n');
            
            this.logger.debug('Filtered content for headers only', {
                totalLines: lines.length,
                headerLines: headerLines.length
            });
        } else if (this.hideBacklinkLine) {
            // Filter out any line containing a link to the note
            const lines = this.contents.split('\n');
            const escapedNoteName = this.noteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const backlinkRegex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}(?:\\|[^\\]]*)?\\]\\]`);
            
            const filteredLines = lines.filter(line => !backlinkRegex.test(line));
            
            contentToRender = filteredLines.join('\n');
            
            this.logger.debug('Filtered out backlink line', {
                totalLines: lines.length,
                filteredLines: filteredLines.length,
                noteName: this.noteName
            });
        }

        try {
            await MarkdownRenderer.render(
                view.app,
                contentToRender,
                contentPreview,
                this.filePath,
                view,
            );
            this.logger.debug('Content rendered successfully');
        } catch (error) {
            this.logger.error('Failed to render content:', error);
        }

        // Add click handler for toggle button
        this.toggleButton.addEventListener('click', () => {
            this.logger.debug('Toggle button clicked');
            this.toggle();
        });
    }

    public getContainer(): HTMLElement | null {
        return this.mainContainer || null;
    }

    public toggle(): void {
        if (!this.mainContainer) return;

        const contentPreview = this.mainContainer.querySelector('.content-preview') as HTMLDivElement;
        if (!contentPreview) return;

        const isCollapsed = contentPreview.style.display === 'none';
        this.logger.debug('Toggling block', {
            filePath: this.filePath,
            isCollapsed,
            newState: !isCollapsed
        });

        contentPreview.style.display = isCollapsed ? 'block' : 'none';
        this.toggleButton.textContent = isCollapsed ? '▼' : '▶';
    }

    public setCollapsed(collapsed: boolean): void {
        if (!this.mainContainer) return;

        const contentPreview = this.mainContainer.querySelector('.content-preview') as HTMLDivElement;
        if (!contentPreview) return;

        this.logger.debug('Setting block collapse state', {
            filePath: this.filePath,
            collapsed
        });

        contentPreview.style.display = collapsed ? 'none' : 'block';
        this.toggleButton.textContent = collapsed ? '▶' : '▼';
    }

    public updateTitleDisplay(headerStyle: string): void {
        this.logger.debug('Updating block title display', {
            filePath: this.filePath,
            oldStyle: this.headerStyle,
            newStyle: headerStyle
        });

        const titleElement = this.headerContainer?.querySelector('.block-title') as HTMLAnchorElement;
        if (titleElement) {
            titleElement.textContent = this.getDisplayTitle(this.filePath, headerStyle);
        }
    }

    private getDisplayTitle(filePath: string, headerStyle: string): string {
        this.logger.debug('Getting display title', {
            filePath,
            headerStyle
        });

        this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(headerStyle, this.contents);
        const title = this.headerStyleInstance.getDisplayTitle(filePath);

        this.logger.debug('Display title generated', {
            filePath,
            headerStyle,
            title
        });

        return title;
    }

    private getFileName(path: string): string {
        return path.split('/').pop()?.replace('.md', '') || path;
    }
}
