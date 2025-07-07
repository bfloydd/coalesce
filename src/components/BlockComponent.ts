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
        private hideBacklinkLine: boolean = false,
        private hideFirstHeader: boolean = false
    ) {
        this.logger.debug('Creating block component', {
            filePath,
            noteName,
            headerStyle,
            strategy,
            hideBacklinkLine,
            hideFirstHeader,
            contentLength: contents.length
        });

        this.blockFinder = BlockFinderFactory.createBlockFinder(strategy, logger);
        this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(headerStyle, contents);
    }

    async render(container: HTMLElement, view: MarkdownView, onLinkClick: (path: string, openInNewTab?: boolean) => void): Promise<void> {
        this.logger.debug('Rendering block component', {
            filePath: this.filePath,
            noteName: this.noteName,
            containerExists: !!container,
            viewExists: !!view
        });

        this.createContainers(container);
        this.createToggleButton();
        this.createBlockTitle(onLinkClick);
        await this.renderContent(view);
    }

    private createContainers(container: HTMLElement): void {
        this.mainContainer = container.createDiv({ cls: 'backlink-item' });
        this.headerContainer = this.mainContainer.createDiv({ cls: 'block-header' });
        
        // Make the entire header clickable for toggling
        this.headerContainer.addEventListener('click', (event) => {
            // Only toggle if the click wasn't on a child element with its own click handler
            if (event.target === this.headerContainer) {
                this.logger.debug('Header container clicked');
                this.toggle();
            }
        });
    }

    private createToggleButton(): void {
        this.toggleButton = this.headerContainer.createEl('span', {
            cls: 'toggle-arrow',
            text: '▼',
        });

        this.toggleButton.addEventListener('click', (event) => {
            this.logger.debug('Toggle button clicked');
            event.stopPropagation(); // Prevent header click from also triggering
            this.toggle();
        });
    }

    private createBlockTitle(onLinkClick: (path: string, openInNewTab?: boolean) => void): void {
        const blockTitle = this.headerContainer.createEl('a', {
            text: this.getDisplayTitle(this.filePath, this.headerStyle),
            cls: 'block-title',
            href: '#',
        });
        
        blockTitle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation(); // Prevent header click from also triggering
            this.logger.debug('Block title clicked', {
                filePath: this.filePath,
                ctrlKey: event.ctrlKey
            });
            onLinkClick(this.filePath, event.ctrlKey);
        });
    }

    private async renderContent(view: MarkdownView): Promise<void> {
        const contentPreview = this.mainContainer.createDiv('content-preview') as HTMLDivElement;
        const contentToRender = this.getContentToRender();

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
    }

    private getContentToRender(): string {
        if (this.strategy === 'headers-only') {
            return this.filterHeadersOnly();
        } else if (this.hideBacklinkLine) {
            return this.filterBacklinkLines();
        }
        return this.contents;
    }

    private filterHeadersOnly(): string {
        const lines = this.contents.split('\n');
        const headerLines = lines.filter(line => /^\s*#{1,5}\s/.test(line));
        
        this.logger.debug('Filtered content for headers only', {
            totalLines: lines.length,
            headerLines: headerLines.length
        });
        
        return headerLines.join('\n');
    }

    private filterBacklinkLines(): string {
        const lines = this.contents.split('\n');
        const escapedNoteName = this.escapeRegexChars(this.noteName);
        const backlinkRegex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}(?:\\|[^\\]]*)?\\]\\]`);
        
        let filteredLines = lines.filter(line => !backlinkRegex.test(line));
        
        // If hideFirstHeader is enabled, also hide the first header line
        if (this.hideFirstHeader && filteredLines.length > 0) {
            const content = filteredLines.join('\n');
            const headingMatch = content.match(/^#{1,5}\s+(.+?)$/m);
            if (headingMatch) {
                // Find the line index of the first header
                const contentLines = content.split('\n');
                const headerLineIndex = contentLines.findIndex(line => /^#{1,5}\s+(.+?)$/.test(line));
                if (headerLineIndex !== -1) {
                    // Remove the header line from filteredLines
                    const removedLine = filteredLines.splice(headerLineIndex, 1)[0];
                    this.logger.debug('Filtered out first header line', {
                        headerLine: removedLine,
                        lineIndex: headerLineIndex
                    });
                }
            }
        }
        
        this.logger.debug('Filtered out backlink line', {
            totalLines: lines.length,
            filteredLines: filteredLines.length,
            noteName: this.noteName,
            hideFirstHeader: this.hideFirstHeader
        });
        
        return filteredLines.join('\n');
    }

    private escapeRegexChars(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    public getContainer(): HTMLElement | null {
        return this.mainContainer || null;
    }

    public toggle(): void {
        if (!this.mainContainer) return;

        const contentPreview = this.getContentPreviewElement();
        if (!contentPreview) return;

        const isCollapsed = this.mainContainer.classList.contains('is-collapsed');
        this.logger.debug('Toggling block', {
            filePath: this.filePath,
            isCollapsed,
            newState: !isCollapsed
        });

        this.updateCollapsedState(!isCollapsed);
    }

    public setCollapsed(collapsed: boolean): void {
        if (!this.mainContainer) return;

        const contentPreview = this.getContentPreviewElement();
        if (!contentPreview) return;

        this.logger.debug('Setting block collapse state', {
            filePath: this.filePath,
            collapsed
        });

        this.updateCollapsedState(collapsed);
    }

    private getContentPreviewElement(): HTMLDivElement | null {
        return this.mainContainer.querySelector('.content-preview') as HTMLDivElement;
    }

    private updateCollapsedState(collapsed: boolean): void {
        if (collapsed) {
            this.mainContainer.classList.add('is-collapsed');
        } else {
            this.mainContainer.classList.remove('is-collapsed');
        }
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


}
