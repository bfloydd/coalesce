import { MarkdownRenderer, MarkdownView, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IconProvider } from '../shared-utilities/IconProvider';
import { HeaderStyleFactory } from './header-styles/HeaderStyleFactory';
import { AbstractHeaderStyle } from './header-styles/base/AbstractHeaderStyle';
import type { INoteEditingSlice } from '../shared-contracts/slice-interfaces';

export class BlockComponent {
    private mainContainer: HTMLElement;
    private headerContainer: HTMLElement;
    private toggleButton: HTMLElement;
    private headerStyleInstance: AbstractHeaderStyle;
    private app: any; // Obsidian App instance

    // Compiled regex patterns for better performance
    private static readonly HEADER_PATTERN = /^\s*#{1,5}\s/;
    private static readonly HEADER_WITH_CONTENT_PATTERN = /^#{1,5}\s+(.+?)$/m;
    private cachedBacklinkRegex: RegExp | null = null;

    constructor(
        public contents: string,
        public filePath: string,
        public noteName: string,
        private headerStyle: string,
        private logger: Logger,
        private strategy: string = 'default',
        private hideBacklinkLine: boolean = false,
        private hideFirstHeader: boolean = false,
        private noteEditingSlice?: INoteEditingSlice,
        app?: any,
        private blockId?: string,
        private startLine?: number
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

        this.app = app;
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
        this.mainContainer = container.createDiv({
            cls: 'coalesce-backlink-item',
            attr: { 'data-path': this.filePath }
        });
        this.headerContainer = this.mainContainer.createDiv({ cls: 'coalesce-block-header' });

        // Make the entire header clickable for toggling
        this.headerContainer.addEventListener('click', (event) => {
            // Only toggle if the click wasn't on a child element with its own click handler
            if (event.target === this.headerContainer) {
                this.logger.debug('Header container clicked');
                this.toggle();
            }
        });
    }

    /**
     * Normalize the file path into a vault path (no wiki-link brackets).
     * Some upstream code paths may pass wiki-link formatted strings like [[path/to/file.md]].
     * Downstream navigation code will wrap paths into wiki-links, so we must keep this clean
     * to avoid accidental `[[[[...]]]]` formatting.
     */
    private getCleanVaultPath(): string {
        let p = (this.filePath || '').trim();
        while (p.startsWith('[[')) p = p.slice(2);
        while (p.endsWith(']]')) p = p.slice(0, -2);
        return p;
    }

    /**
     * Get a clean, user-friendly file title for display in the block header.
     * This is used for the "filename" link when the header style is showing an "Add a heading" prompt.
     */
    private getFileTitleForLink(): string {
        const cleanFilePath = this.getCleanVaultPath().replace(/\.md$/, '');
        const parts = cleanFilePath.split('/');
        return parts[parts.length - 1] || cleanFilePath;
    }

    /**
     * Dispatch the navigation event used by the backlinks UI to open a note (and optionally a block).
     */
    private dispatchNavigateEvent(openInNewTab: boolean): void {
        const navigationEvent = new CustomEvent('coalesce-navigate', {
            detail: { filePath: this.getCleanVaultPath(), openInNewTab, blockId: this.blockId },
            bubbles: true
        });
        this.headerContainer!.dispatchEvent(navigationEvent);
    }

    private createToggleButton(): void {
        this.toggleButton = this.headerContainer.createEl('span', {
            cls: 'coalesce-toggle-arrow',
        });

        // Use chevron icon instead of text characters for consistency with header
        IconProvider.setIcon(this.toggleButton, 'chevronDown', { size: 'sm' });

        this.toggleButton.addEventListener('click', (event) => {
            this.logger.debug('Toggle button clicked');
            event.stopPropagation(); // Prevent header click from also triggering
            this.toggle();
        });
    }

    private createBlockTitle(onLinkClick: (path: string, openInNewTab?: boolean) => void): void {
        const showsAddHeading = this.headerStyleInstance.showsAddHeadingPrompt();

        if (showsAddHeading && this.noteEditingSlice) {
            // Filename link (navigates to the note)
            const fileLink = this.headerContainer.createEl('a', {
                text: this.getFileTitleForLink(),
                cls: 'coalesce-block-title coalesce-block-title-link',
                href: '#'
            });
            fileLink.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.logger.debug('File title clicked (add heading state)', {
                    filePath: this.filePath,
                    ctrlKey: event.ctrlKey,
                    blockId: this.blockId
                });
                this.dispatchNavigateEvent(event.ctrlKey);
            });

            // Separator
            this.headerContainer.createEl('span', {
                text: ' — ',
                cls: 'coalesce-add-heading-separator',
                attr: { 'aria-hidden': 'true' }
            });

            // "Add a heading" action (opens modal)
            const addHeadingAction = this.headerContainer.createEl('span', {
                cls: 'coalesce-add-heading-prompt',
                attr: {
                    role: 'button',
                    tabindex: '0',
                    'aria-label': 'Add a heading'
                }
            });

            const addHeadingIcon = addHeadingAction.createEl('span', {
                cls: 'coalesce-add-heading-icon',
                attr: { 'aria-hidden': 'true' }
            });
            IconProvider.setIcon(addHeadingIcon, 'heading', { size: 'sm' });
            addHeadingAction.createSpan({ text: 'Add a heading' });

            const openAddHeadingModal = async (): Promise<void> => {
                this.logger.debug('Add heading prompt clicked', { filePath: this.filePath });
                this.noteEditingSlice!.showHeadingPopup(this.getCleanVaultPath(), async () => {
                    await this.refreshContentFromFile();
                });
            };

            addHeadingAction.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                void openAddHeadingModal();
            });
            addHeadingAction.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    void openAddHeadingModal();
                }
            });

            // Add a small open-note icon next to the prompt
            const linkIcon = this.headerContainer.createEl('span', {
                cls: 'coalesce-add-heading-open-note',
                attr: {
                    'role': 'button',
                    'tabindex': '0',
                    'aria-label': 'Open note'
                }
            });
            IconProvider.setIcon(linkIcon, 'external-link', { size: 'sm' });
            linkIcon.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const openInNewTab = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;
                this.dispatchNavigateEvent(openInNewTab);
            });
            linkIcon.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (linkIcon as HTMLElement).click();
                }
            });
        } else {
            // Create regular clickable title
            const displayTitle = this.getDisplayTitle(this.filePath, this.headerStyle);
            const blockTitle = this.headerContainer.createEl('a', {
                text: displayTitle,
                cls: 'coalesce-block-title',
                href: '#',
            });

            blockTitle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation(); // Prevent header click from also triggering
                this.logger.debug('Block title clicked', {
                    filePath: this.filePath,
                    ctrlKey: event.ctrlKey,
                    blockId: this.blockId
                });

                // Handle navigation directly
                const cleanFilePath = this.getCleanVaultPath(); // Remove surrounding brackets if present
                if (this.startLine && this.app) {
                    // Open file and scroll to the block's start line
                    const file = this.app.vault.getAbstractFileByPath(cleanFilePath);
                    if (file && file instanceof TFile) {
                        // Open the file in current tab or new tab
                        const leaf = event.ctrlKey ?
                            this.app.workspace.getLeaf(true) :
                            this.app.workspace.getLeaf(false);

                        leaf.openFile(file).then(() => {
                            // Ensure the leaf is active for UI updates
                            this.app.workspace.setActiveLeaf(leaf, { focus: true });

                            // Emit event to update Coalesce UI for the new file
                            const navCompleteEvent = new CustomEvent('coalesce-navigate-complete', {
                                detail: { filePath: cleanFilePath },
                                bubbles: true
                            });
                            document.dispatchEvent(navCompleteEvent);

                            // Delay scrolling to ensure view is ready
                            setTimeout(() => {
                                const view = leaf.view;
                                if (view && view instanceof MarkdownView) {
                                    const editor = view.editor;
                                    if (editor) {
                                        const lineIndex = Math.max(0, this.startLine! - 1);
                                        const lineStart = { line: lineIndex, ch: 0 };
                                        editor.setCursor(lineStart);
                                        editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
                                    }
                                }
                            }, 100);
                        });
                    }
                } else {
                    // Fallback to the provided onLinkClick
                    onLinkClick(cleanFilePath, event.ctrlKey);
                }
            });
        }
    }

    private async renderContent(view: MarkdownView): Promise<void> {
        const contentPreview = this.mainContainer.createDiv('coalesce-content-preview') as HTMLDivElement;
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

    public getContentToRender(): string {
        if (this.strategy === 'headers-only') {
            return this.filterHeadersOnly();
        } else if (this.hideBacklinkLine) {
            return this.filterBacklinkLines();
        }
        return this.contents;
    }

    private filterHeadersOnly(): string {
        const lines = this.contents.split('\n');
        const headerLines = lines.filter(line => BlockComponent.HEADER_PATTERN.test(line));

        this.logger.debug('Filtered content for headers only', {
            totalLines: lines.length,
            headerLines: headerLines.length
        });

        return headerLines.join('\n');
    }

    private filterBacklinkLines(): string {
        const lines = this.contents.split('\n');

        // Use cached regex or create new one
        if (!this.cachedBacklinkRegex) {
            const escapedNoteName = this.escapeRegexChars(this.noteName);
            this.cachedBacklinkRegex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}(?:\\|[^\\]]*)?\\]\\]`);
        }

        const filteredLines = lines.filter(line => !this.cachedBacklinkRegex!.test(line));

        // If hideFirstHeader is enabled, also hide the first header line
        if (this.hideFirstHeader && filteredLines.length > 0) {
            const content = filteredLines.join('\n');
            const headingMatch = content.match(BlockComponent.HEADER_WITH_CONTENT_PATTERN);
            if (headingMatch) {
                // Find the line index of the first header
                const contentLines = content.split('\n');
                const headerLineIndex = contentLines.findIndex(line => BlockComponent.HEADER_WITH_CONTENT_PATTERN.test(line));
                if (headerLineIndex !== -1) {
                    // Remove the header line from filteredLines
                    const removedLine = filteredLines.splice(headerLineIndex, 1)[0];
                    this.logger.debug('Filtered out first header line', {
                        headerLine: removedLine,
                        lineIndex: headerLineIndex,
                        headerContent: headingMatch[1]
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

    public getTitle(): string {
        return this.getDisplayTitle(this.filePath, this.headerStyle);
    }

    public toggle(): void {
        if (!this.mainContainer) return;

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

        this.logger.debug('Setting block collapse state', {
            filePath: this.filePath,
            collapsed
        });

        this.updateCollapsedState(collapsed);
    }

    private getContentPreviewElement(): HTMLDivElement | null {
        return this.mainContainer.querySelector('.coalesce-content-preview') as HTMLDivElement;
    }

    private updateCollapsedState(collapsed: boolean): void {
        if (collapsed) {
            this.mainContainer.classList.add('is-collapsed');
        } else {
            this.mainContainer.classList.remove('is-collapsed');
        }
        
        // Update icon based on state: chevron-right when collapsed, chevron-down when expanded
        IconProvider.setIcon(
            this.toggleButton,
            collapsed ? 'chevronRight' : 'chevronDown',
            { size: 'sm' }
        );
    }

    public updateTitleDisplay(headerStyle: string): void {
        this.logger.debug('Updating block title display', {
            filePath: this.filePath,
            oldStyle: this.headerStyle,
            newStyle: headerStyle
        });

        const displayTitle = this.getDisplayTitle(this.filePath, headerStyle);
        const showsAddHeading = this.headerStyleInstance.showsAddHeadingPrompt();

        // Remove existing title elements (filename link, add heading action, separator, open-note icon)
        const elementsToRemove = this.headerContainer?.querySelectorAll(
            '.coalesce-block-title, .coalesce-add-heading-prompt, .coalesce-add-heading-open-note, .coalesce-add-heading-separator'
        );
        elementsToRemove?.forEach(el => el.remove());

        // Create the appropriate title element based on current state
        if (showsAddHeading && this.noteEditingSlice) {
            this.createAddHeadingPrompt(displayTitle);
        } else {
            this.createRegularTitle(displayTitle);
        }
    }

    private createAddHeadingPrompt(displayTitle: string): void {
        // Filename link (navigates to the note)
        const fileLink = this.headerContainer!.createEl('a', {
            text: this.getFileTitleForLink(),
            cls: 'coalesce-block-title coalesce-block-title-link',
            href: '#'
        });
        fileLink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.dispatchNavigateEvent(event.ctrlKey);
        });

        // Separator
        this.headerContainer!.createEl('span', {
            text: ' — ',
            cls: 'coalesce-add-heading-separator',
            attr: { 'aria-hidden': 'true' }
        });

        // "Add a heading" action (opens modal)
        const addHeadingAction = this.headerContainer!.createEl('span', {
            cls: 'coalesce-add-heading-prompt',
            attr: {
                role: 'button',
                tabindex: '0',
                'aria-label': 'Add a heading'
            }
        });

        const addHeadingIcon = addHeadingAction.createEl('span', {
            cls: 'coalesce-add-heading-icon',
            attr: { 'aria-hidden': 'true' }
        });
        IconProvider.setIcon(addHeadingIcon, 'heading', { size: 'sm' });
        addHeadingAction.createSpan({ text: 'Add a heading' });

        const openAddHeadingModal = async (): Promise<void> => {
            this.logger.debug('Add heading prompt clicked', { filePath: this.filePath });
            this.noteEditingSlice!.showHeadingPopup(this.getCleanVaultPath(), async () => {
                await this.refreshContentFromFile();
            });
        };

        addHeadingAction.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void openAddHeadingModal();
        });
        addHeadingAction.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                void openAddHeadingModal();
            }
        });

        // Add a small open-note icon next to the prompt
        const linkIcon = this.headerContainer!.createEl('span', {
            cls: 'coalesce-add-heading-open-note',
            attr: {
                'role': 'button',
                'tabindex': '0',
                'aria-label': 'Open note'
            }
        });
        IconProvider.setIcon(linkIcon, 'external-link', { size: 'sm' });
        linkIcon.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const openInNewTab = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;
            this.dispatchNavigateEvent(openInNewTab);
        });
        linkIcon.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (linkIcon as HTMLElement).click();
            }
        });
    }

    private createRegularTitle(displayTitle: string): void {
        const blockTitle = this.headerContainer!.createEl('a', {
            text: displayTitle,
            cls: 'coalesce-block-title',
            href: '#',
        });

        blockTitle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.logger.debug('Block title clicked', { filePath: this.filePath, blockId: this.blockId });

            // Use Obsidian's built-in navigation for reliable block scrolling
            this.logger.debug('Dispatching navigation event for block', {
                blockId: this.blockId,
                filePath: this.filePath,
                openInNewTab: event.ctrlKey
            });
            this.dispatchNavigateEvent(event.ctrlKey);
        });
    }

    public refreshContent(): void {
        this.logger.debug('Refreshing block content', { filePath: this.filePath });

        // Recreate the header style instance with updated content
        this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(this.headerStyle, this.contents);

        // Update the title display
        this.updateTitleDisplay(this.headerStyle);
    }

    public async refreshContentFromFile(): Promise<void> {
        this.logger.debug('Refreshing block content from file', { filePath: this.filePath });

        try {
            // Read the updated file content
            const file = this.app.vault.getAbstractFileByPath(this.getCleanVaultPath());
            if (file && file instanceof TFile) {
                const newContent = await this.app.vault.read(file);
                this.contents = newContent;

                // Recreate the header style instance with new content
                this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(this.headerStyle, this.contents);

                // Update the title display
                this.updateTitleDisplay(this.headerStyle);

                this.logger.debug('Block content refreshed from file', {
                    filePath: this.filePath,
                    newContentLength: newContent.length
                });
            }
        } catch (error) {
            this.logger.error('Failed to refresh block content from file', error);
        }
    }

    private getDisplayTitle(filePath: string, headerStyle: string): string {
        this.logger.debug('Getting display title', {
            filePath,
            headerStyle
        });

        // Only recreate header style instance if the style has changed
        if (this.headerStyle !== headerStyle) {
            this.headerStyle = headerStyle;
            this.headerStyleInstance = HeaderStyleFactory.createHeaderStyle(headerStyle, this.contents);
        }

        const title = this.headerStyleInstance.getDisplayTitle(filePath);

        this.logger.debug('Display title generated', {
            filePath,
            headerStyle,
            title
        });

        return title;
    }


}