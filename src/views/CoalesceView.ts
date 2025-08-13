import { MarkdownView,TFile } from 'obsidian';
import { BlockComponent } from '../components/BlockComponent';
import { Logger } from '../utils/Logger';
import { HeaderComponent } from '../components/HeaderComponent';
import { SettingsManager } from '../SettingsManager';
import { ThemeManager } from '../ThemeManager';
import { AbstractBlockFinder } from '../block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from '../block-finders/BlockFinderFactory';
import { DailyNote } from '../utils/DailyNote';
import { AppWithInternalPlugins } from '../types';

/** 
 * Handles backlink UI representation, DOM management, user interactions, and coordination between block finders and UI 
 */
export class CoalesceView {
    private container: HTMLElement;
    private headerComponent: HeaderComponent;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];
    private currentTheme: string;
    private currentAlias: string | null = null;
    private aliases: string[] = [];
    private currentFilesLinkingToThis: string[] = [];
    private currentOnLinkClick: ((path: string, openInNewTab?: boolean) => void) | null = null;
    private blockFinder: AbstractBlockFinder;
    private sortDescending: boolean;
    private blocksCollapsed: boolean;
    private currentFilter: string = '';
    private currentHeader: HTMLElement | null = null;
    private focusPending: boolean = false;
    private focusAttempts: number = 0;
    private maxFocusAttempts: number = 10;
    private hasBeenFocused: boolean = false;
    
    // Performance optimizations
    private filterDebounceTimeout: NodeJS.Timeout | null = null;
    private headerUpdatePending: boolean = false;
    private focusTimeout: NodeJS.Timeout | null = null;
    private styleObserver: MutationObserver | null = null;

    constructor(
        private view: MarkdownView,
        private currentNoteName: string,
        private settingsManager: SettingsManager,
        private logger: Logger
    ) {
        this.currentNoteName = currentNoteName;
        this.container = this.createBacklinksContainer();
        this.currentTheme = this.settingsManager.settings.theme;
        this.headerComponent = new HeaderComponent(this.logger);
        this.headerComponent.setSettingsManager(this.settingsManager);
        this.blockFinder = BlockFinderFactory.createBlockFinder(
            this.settingsManager.settings.blockBoundaryStrategy,
            this.logger
        );
        
        this.initializeFromSettings();
        this.applyTheme(this.currentTheme);
        this.attachToDOM();
        this.loadAliasesFromMetadata();
        this.setupFocusListeners();
    }

    private initializeFromSettings(): void {
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;
        this.logger.debug("Appending backlinks container to view");
    }

    private loadAliasesFromMetadata(): void {
        if (this.view.file) {
            const fileCache = this.view.app.metadataCache.getCache(this.view.file.path);
            this.aliases = fileCache?.frontmatter?.aliases || [];
            if (!Array.isArray(this.aliases)) {
                this.aliases = [this.aliases].filter(Boolean);
            }
            this.logger.debug("File metadata:", {
                path: this.view.file.path,
                cache: fileCache,
                aliases: this.aliases
            });
        }
    }

    private createBacklinksContainer(): HTMLElement {
        // Create a temporary container to use Obsidian's helper methods
        const tempContainer = document.createElement('div');
        const container = tempContainer.createDiv({ cls: 'custom-backlinks-container' });
        this.logger.debug("Created backlinks container", { container: container });
        return container;
    }

    private async getBlockData(filePath: string, currentNoteName: string): Promise<BlockComponent[]> {
        const blocks: BlockComponent[] = [];
        
        try {
            const file = this.view.app.vault.getAbstractFileByPath(filePath);
            
            if (file && file instanceof TFile) {
                const content = await this.view.app.vault.read(file);
                const boundaries = this.blockFinder.findBlockBoundaries(content, currentNoteName);
                blocks.push(...this.createBlocksFromBoundaries(content, filePath, boundaries));
            }
        } catch (error) {
            this.logger.error(`Failed to read file content for ${filePath}:`, error);
        }
        return blocks;
    }

    private createBlocksFromBoundaries(content: string, filePath: string, boundaries: {start: number, end: number}[]): BlockComponent[] {
        const blocks: BlockComponent[] = [];
        
        for (const { start, end } of boundaries) {
            const blockContent = content.substring(start, end);
            const block = new BlockComponent(
                blockContent, 
                filePath, 
                this.currentNoteName, 
                this.settingsManager.settings.headerStyle,
                this.logger,
                this.settingsManager.settings.blockBoundaryStrategy,
                this.settingsManager.settings.hideBacklinkLine,
                this.settingsManager.settings.hideFirstHeader
            );
            blocks.push(block);
        }
        
        return blocks;
    }

    private updateBlockBoundaryStrategy(strategy: string) {
        this.blockFinder = BlockFinderFactory.createBlockFinder(strategy, this.logger);
    }

    private applyTheme(theme: string) {
        ThemeManager.themes.forEach(t => {
            this.container.classList.remove(`theme-${t}`);
        });
        this.container.classList.add(`theme-${theme}`);
    }

    private async handleThemeChange(theme: string) {
        this.currentTheme = theme;
        this.settingsManager.settings.theme = theme;
        await this.settingsManager.saveSettings();
        this.applyTheme(theme);
    }

    private async updateBlockTitles(style: string): Promise<void> {
        this.allBlocks.forEach(({ block }) => {
            block.updateTitleDisplay(style);
        });
    }

    private extractUnsavedAliases(filesLinkingToThis: string[]): string[] {
        const unsavedAliases = new Set<string>();
        this.processBlocksForAliases(unsavedAliases);
        return Array.from(unsavedAliases).sort();
    }
    
    private processBlocksForAliases(unsavedAliases: Set<string>): void {
        this.allBlocks.forEach(({ block }) => {
            const content = block.contents;
            const escapedNoteName = this.escapeRegexChars(this.currentNoteName);
            const regex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}\\|([^\\]]+)\\]\\]`, 'g');
            const matches = content.matchAll(regex);
            
            for (const match of matches) {
                this.processAliasMatch(match, unsavedAliases);
            }
        });
    }
    
    private escapeRegexChars(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    private processAliasMatch(match: RegExpMatchArray, unsavedAliases: Set<string>): void {
        const aliasString = match[1];
        if (!aliasString) return;
        
        const aliases = aliasString.split('|');
        aliases.forEach(alias => {
            if (alias && !this.aliases.includes(alias) && alias !== this.currentNoteName) {
                unsavedAliases.add(alias);
            }
        });
    }

    private sortBlocks(): void {
        this.allBlocks.sort(this.compareBlocks.bind(this));
        this.updateDomOrder();
    }
    
    private compareBlocks(a: { block: BlockComponent; sourcePath: string }, b: { block: BlockComponent; sourcePath: string }): number {
        const sortByFullPath = this.settingsManager.settings.sortByFullPath;
        let aKey: string, bKey: string;
        if (sortByFullPath) {
            aKey = a.sourcePath;
            bKey = b.sourcePath;
        } else {
            aKey = a.sourcePath.split(/[/\\]/).pop() || a.sourcePath;
            bKey = b.sourcePath.split(/[/\\]/).pop() || b.sourcePath;
        }
        const keyCompare = this.sortDescending 
            ? bKey.localeCompare(aKey)
            : aKey.localeCompare(bKey);
        if (keyCompare !== 0) return keyCompare;
        // If keys are equal, compare block content
        const aContent = a.block.contents;
        const bContent = b.block.contents;
        return this.sortDescending 
            ? bContent.localeCompare(aContent)
            : aContent.localeCompare(bContent);
    }
    
    private updateDomOrder(): void {
        const linksContainer = this.container.querySelector('.backlinks-list');
        if (linksContainer) {
            this.allBlocks.forEach(({ block }) => {
                const blockContainer = block.getContainer();
                if (blockContainer && blockContainer.parentElement === linksContainer) {
                    linksContainer.appendChild(blockContainer);
                }
            });
        }
    }

    public toggleSort(): void {
        this.sortDescending = !this.sortDescending;
        this.settingsManager.settings.sortDescending = this.sortDescending;
        this.settingsManager.saveSettings();
        
        this.sortBlocks();
        this.updateSortButtonState();
    }
    
    private updateSortButtonState(): void {
        const header = this.container.querySelector('.backlinks-header');
        if (header) {
            const sortButton = header.querySelector('.sort-button svg') as SVGElement;
            if (sortButton) {
                if (this.sortDescending) {
                    sortButton.classList.remove('sort-ascending');
                    sortButton.classList.add('sort-descending');
                } else {
                    sortButton.classList.remove('sort-descending');
                    sortButton.classList.add('sort-ascending');
                }
            }
        }
    }

    public async updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string, openInNewTab?: boolean) => void): Promise<void> {
        this.currentFilesLinkingToThis = filesLinkingToThis;
        this.currentOnLinkClick = onLinkClick;
        this.logger.debug("Updating backlinks", { count: filesLinkingToThis.length, files: filesLinkingToThis });
        
        // Ensure container is attached to DOM before updating
        const isProperlyAttached = this.container.parentElement && 
                                   this.container.parentElement.isConnected && 
                                   this.view.containerEl.contains(this.container);
        
        if (!isProperlyAttached) {
            this.logger.debug("Container not attached, reattaching before update");
            this.attachToDOM();
        }
        
        this.container.empty();

        // Reset filter when updating backlinks
        this.currentFilter = '';

        const linksContainer = this.container.createDiv({ cls: 'backlinks-list' });
        
        // Handle different states based on backlinks and focus
        if (filesLinkingToThis.length === 0) {
            // State 1: No backlinks found
            const noBacklinksMessage = linksContainer.createDiv({ 
                cls: 'no-backlinks-message',
                text: `No backlinks found for "${this.currentNoteName}". Create links to this note from other notes to see them here.`
            });
            noBacklinksMessage.style.padding = '20px';
            noBacklinksMessage.style.textAlign = 'center';
            noBacklinksMessage.style.color = 'var(--text-muted)';
            noBacklinksMessage.style.fontStyle = 'italic';
            noBacklinksMessage.style.border = '1px dashed var(--background-modifier-border)';
            noBacklinksMessage.style.borderRadius = '4px';
            noBacklinksMessage.style.margin = '10px 0';
            noBacklinksMessage.style.backgroundColor = 'var(--background-secondary)';
            
            // Create a minimal header for no-backlinks state
            const header = this.createMinimalHeader();
            this.container.appendChild(header);
            this.container.appendChild(linksContainer);
        } else if (!this.hasBeenFocused) {
            // State 2: Backlinks exist but view hasn't been focused yet - show suspended state WITHOUT processing files
            this.logger.debug("Showing suspended state, deferring content loading", {
                backlinksCount: filesLinkingToThis.length
            });
            this.showSuspendedState(linksContainer);
            
            // Create a minimal header for suspended state
            const header = this.createMinimalHeader();
            this.container.appendChild(header);
            this.container.appendChild(linksContainer);
        } else {
            // State 3: Backlinks exist and view has been focused - do the full loading
            await this.loadAndRenderContent(linksContainer, onLinkClick, filesLinkingToThis);
        }
        
        this.logger.debug("Backlinks update complete", {
            backlinksCount: filesLinkingToThis.length,
            hasBeenFocused: this.hasBeenFocused,
            hasActiveContent: this.hasActiveContent()
        });
    }

    /**
     * Creates a minimal header for states that don't need full functionality
     */
    private createMinimalHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'backlinks-header';
        
        // Just show the Coalesce logo and title
        const headerLeft = header.createDiv({ cls: 'backlinks-header-left' });
        
        // Add the Coalesce logo
        const logoSvg = headerLeft.createSvg('svg');
        logoSvg.setAttribute('viewBox', '0 0 100 100');
        logoSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        logoSvg.innerHTML = `
            <circle cx="50" cy="25" r="8" fill="currentColor" opacity="0.8"/>
            <circle cx="25" cy="50" r="8" fill="currentColor" opacity="0.6"/>
            <circle cx="75" cy="50" r="8" fill="currentColor" opacity="0.6"/>
            <circle cx="50" cy="75" r="8" fill="currentColor" opacity="0.8"/>
            <path d="M50,33 L50,42 M42,50 L33,50 M58,50 L67,50 M50,58 L50,67" stroke="currentColor" stroke-width="2" opacity="0.4"/>
        `;
        
        // Add title
        const title = headerLeft.createSpan({ text: 'Coalesce' });
        title.style.marginLeft = '8px';
        title.style.fontWeight = '600';
        title.style.color = 'var(--text-muted)';
        
        return header;
    }

    /**
     * Loads and renders the full content (blocks, header with functionality)
     */
    private async loadAndRenderContent(linksContainer: HTMLElement, onLinkClick: (path: string, openInNewTab?: boolean) => void, filesLinkingToThis: string[]): Promise<void> {
        this.allBlocks = [];
        
        await this.collectBlocksFromFiles(filesLinkingToThis);
        
        // Extract unsaved aliases after collecting blocks
        const unsavedAliases = this.extractUnsavedAliases(filesLinkingToThis);

        // Sort blocks
        this.sortBlocks();

        // Render blocks with correct initial state
        await this.renderBlocks(linksContainer, onLinkClick);

        // Create full header with all functionality
        const header = this.createBacklinksHeader(unsavedAliases, filesLinkingToThis, onLinkClick);
        this.container.appendChild(header);
        this.container.appendChild(linksContainer);
        
        this.logger.debug("Full content loaded and rendered", {
            blocksCount: this.allBlocks.length,
            backlinksCount: filesLinkingToThis.length
        });
    }

    /**
     * Collects blocks from all provided files
     */
    private async collectBlocksFromFiles(filesLinkingToThis: string[]): Promise<void> {
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getBlockData(sourcePath, this.currentNoteName);
            blocks.forEach(block => {
                this.allBlocks.push({ block, sourcePath });
            });
        }
    }

    /**
     * Renders all blocks into the provided container
     */
    private async renderBlocks(linksContainer: HTMLElement, onLinkClick: (path: string, openInNewTab?: boolean) => void): Promise<void> {
        for (const { block } of this.allBlocks) {
            try {
                await block.render(linksContainer, this.view, onLinkClick);
                
                // Set the initial collapsed state using the block's method
                block.setCollapsed(this.blocksCollapsed);
            } catch (error) {
                this.logger.error('Failed to render block:', error);
            }
        }
        
        // Update the header collapse button state after rendering all blocks
        this.updateCollapseButtonState();
    }

    /**
     * Creates the backlinks header with all needed event handlers
     */
    private createBacklinksHeader(
        unsavedAliases: string[], 
        filesLinkingToThis: string[], 
        onLinkClick: (path: string, openInNewTab?: boolean) => void
    ): HTMLElement {
        const header = this.headerComponent.createHeader(
            this.container, 
            0,
            this.sortDescending,
            () => this.toggleSort(),
            () => this.toggleAllBlocks(),
            this.blocksCollapsed,
            this.settingsManager.settings.blockBoundaryStrategy,
            async (strategy) => this.handleStrategyChange(strategy),
            this.currentTheme,
            async (theme) => this.handleThemeChange(theme),
            this.settingsManager.settings.showFullPathTitle,
            async (show) => this.handleFullPathTitleChange(show),
            this.aliases,
            async (alias: string | null) => this.handleAliasSelect(alias),
            this.currentAlias,
            unsavedAliases,
            this.settingsManager.settings.headerStyle,
            async (style: string) => this.handleHeaderStyleChange(style),
            (filterText: string) => this.handleFilterChange(filterText),
            this.currentFilter
        );
        
        this.currentHeader = header;
        this.logger.debug("Header created", { 
            header: header,
            hasFilterInput: !!header.querySelector('.filter-input')
        });
        
        return header;
    }

    /**
     * Handles the change of block boundary strategy
     */
    private async handleStrategyChange(strategy: string): Promise<void> {
        this.settingsManager.settings.blockBoundaryStrategy = strategy;
        await this.settingsManager.saveSettings();
        this.updateBlockBoundaryStrategy(strategy);
        await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
    }

    /**
     * Handles the change of full path title setting
     */
    private async handleFullPathTitleChange(show: boolean): Promise<void> {
        this.settingsManager.settings.showFullPathTitle = show;
        await this.settingsManager.saveSettings();
        await this.updateBlockTitles(show ? 'full' : 'short');
    }



    /**
     * Handles the change of daily notes setting
     */
    private async handleDailyNotesChange(show: boolean): Promise<void> {
        this.settingsManager.settings.onlyDailyNotes = show;
        await this.settingsManager.saveSettings();
    }

    /**
     * Handles the change of header style
     */
    private async handleHeaderStyleChange(style: string): Promise<void> {
        this.settingsManager.settings.headerStyle = style;
        await this.settingsManager.saveSettings();
        await this.updateBlockTitles(style);
    }

    /**
     * Handles the change of hide backlink line setting
     */
    private async handleHideBacklinkLineChange(hide: boolean): Promise<void> {
        this.settingsManager.settings.hideBacklinkLine = hide;
        await this.settingsManager.saveSettings();
        // Refresh blocks to apply the new setting
        await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
    }

    private toggleAllBlocks(): void {
        this.blocksCollapsed = !this.blocksCollapsed;
        this.settingsManager.settings.blocksCollapsed = this.blocksCollapsed;
        this.settingsManager.saveSettings();

        // Update all blocks based on the new state
        this.updateAllBlocksCollapsedState();
    }

    /**
     * Updates the collapse state of all blocks based on the current collapsed setting
     */
    private updateAllBlocksCollapsedState(): void {
        this.allBlocks.forEach(({ block }) => {
            // Use setCollapsed method to update both the container class and the toggle icon
            block.setCollapsed(this.blocksCollapsed);
        });
        
        // Also update the header collapse button state
        this.updateCollapseButtonState();
    }
    
    /**
     * Updates the collapse button icon in the header
     */
    private updateCollapseButtonState(): void {
        const header = this.container.querySelector('.backlinks-header');
        if (header) {
            const collapseButton = header.querySelector('.collapse-button svg') as SVGElement;
            if (collapseButton) {
                if (this.blocksCollapsed) {
                    collapseButton.classList.add('is-collapsed');
                } else {
                    collapseButton.classList.remove('is-collapsed');
                }
            }
        }
    }





    public cleanup(): void {
        // Clean up the header component to prevent memory leaks
        if (this.headerComponent) {
            this.headerComponent.cleanup();
        }
        
        // Clear filter debounce timeout
        if (this.filterDebounceTimeout) {
            clearTimeout(this.filterDebounceTimeout);
            this.filterDebounceTimeout = null;
        }
        
        // Clear focus timeout
        if (this.focusTimeout) {
            clearTimeout(this.focusTimeout);
            this.focusTimeout = null;
        }
        
        // Stop style monitoring
        this.stopStyleMonitoring();
        
        // Clean up focus event listeners
        this.cleanupFocusListeners();
        
        // Clear caches and data
        this.allBlocks = [];
        this.currentFilesLinkingToThis = [];
        this.currentOnLinkClick = null;
    }

    public clear(): void {
        // Clean up resources first
        this.cleanup();
        
        // Then clear the container
        if (this.container) {
            // Remove the container from the DOM
            if (this.container.parentElement) {
                this.container.parentElement.removeChild(this.container);
            }
            this.container.empty();
        }
        
        // Clear header reference
        this.currentHeader = null;
        
        this.logger.debug("Cleared backlinks view");
    }

    private attachToDOM() {
        // Check if we should hide in daily notes 
        if (this.settingsManager.settings.onlyDailyNotes && 
            this.view.file && 
            DailyNote.isDaily(this.view.app as AppWithInternalPlugins, this.view.file.path)) {
            this.logger.debug("Skipping Coalesce attachment in daily note (Hide in Daily Notes enabled)");
            return;
        }

        // Check if container is already properly attached
        const isProperlyAttached = this.container.parentElement && 
                                   this.container.parentElement.isConnected && 
                                   this.view.containerEl.contains(this.container);

        if (isProperlyAttached) {
            this.logger.debug("Container already properly attached, skipping attachment");
            return;
        }

        // If container has a parent but it's not properly attached, remove it first
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }

        // Only create backlinks list if it doesn't exist and we're not handling this in updatePosition
        if (!this.container.querySelector('.backlinks-list') && this.allBlocks.length === 0) {
            const linksContainer = this.container.createDiv({ cls: 'backlinks-list' });
            // Add a placeholder to make it visible
            linksContainer.createDiv({ text: 'Coalesce loaded - waiting for backlinks...' });
        }

        // Always place below content
        const markdownSection = this.view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
        
        if (markdownSection) {
            // Insert after the markdown section
            markdownSection.insertAdjacentElement('afterend', this.container);
            
            // Ensure the container is always visible with minimum styles
            this.container.style.minHeight = '50px';
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            
            this.logger.debug("Coalesce container attached successfully");
            
            // Start monitoring for unwanted style changes
            this.startStyleMonitoring();
        } else {
            this.logger.error("Failed to attach Coalesce: markdown preview section not found");
        }
    }

    // Add getter for view
    public getView(): MarkdownView {
        return this.view;
    }

    /**
     * Checks if the view has content and is not in suspended state
     */
    public hasActiveContent(): boolean {
        const hasSuspendedMessage = this.container.querySelector('.suspended-state-message') !== null;
        const hasNoBacklinksMessage = this.container.querySelector('.no-backlinks-message') !== null;
        const hasBlocksRendered = this.allBlocks.length > 0;
        const hasBeenFocused = this.hasBeenFocused;
        
        // View has active content if it's been focused and either has blocks or shows "no backlinks" message
        // but is NOT showing the suspended message
        return hasBeenFocused && (hasBlocksRendered || hasNoBacklinksMessage) && !hasSuspendedMessage;
    }

    /**
     * Checks if the provided backlinks are different from current ones
     */
    public areBacklinksDifferent(newBacklinks: string[]): boolean {
        if (this.currentFilesLinkingToThis.length !== newBacklinks.length) {
            return true;
        }
        
        // Sort both arrays for comparison
        const currentSorted = [...this.currentFilesLinkingToThis].sort();
        const newSorted = [...newBacklinks].sort();
        
        for (let i = 0; i < currentSorted.length; i++) {
            if (currentSorted[i] !== newSorted[i]) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Start monitoring for unwanted style changes that push Coalesce down
     */
    private startStyleMonitoring(): void {
        // Stop any existing observer
        this.stopStyleMonitoring();
        
        // Find elements that Obsidian might add styles to
        const markdownSection = this.view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
        const markdownSizer = this.view.containerEl.querySelector('.markdown-preview-sizer') as HTMLElement;
        
        if (!markdownSection && !markdownSizer) return;
        
        // Create observer to watch for style attribute changes
        this.styleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target as HTMLElement;
                    this.removeUnwantedStyles(target);
                }
            });
        });
        
        // Observe both elements if they exist
        const observeOptions = {
            attributes: true,
            attributeFilter: ['style']
        };
        
        if (markdownSection) {
            this.styleObserver.observe(markdownSection, observeOptions);
        }
        if (markdownSizer) {
            this.styleObserver.observe(markdownSizer, observeOptions);
        }
        
        // Also clean up any existing unwanted styles
        if (markdownSection) this.removeUnwantedStyles(markdownSection);
        if (markdownSizer) this.removeUnwantedStyles(markdownSizer);
    }

    /**
     * Stop monitoring for style changes
     */
    private stopStyleMonitoring(): void {
        if (this.styleObserver) {
            this.styleObserver.disconnect();
            this.styleObserver = null;
        }
    }

    /**
     * Remove unwanted inline styles that affect positioning
     */
    private removeUnwantedStyles(element: HTMLElement): void {
        if (!element || !element.style) return;
        
        // Remove problematic inline styles
        if (element.style.paddingBottom) {
            element.style.removeProperty('padding-bottom');
        }
        if (element.style.minHeight) {
            element.style.removeProperty('min-height');
        }
        
        this.logger.debug("Removed unwanted styles from element", {
            tagName: element.tagName,
            className: element.className
        });
    }

    private filterBlocksByAlias() {
        this.logger.debug("Filtering blocks by alias", { 
            currentAlias: this.currentAlias,
            totalBlocks: this.allBlocks.length,
            savedAliases: this.aliases
        });
        
        this.updateBlockVisibilityByAlias();
    }

    /**
     * Updates block visibility based on current alias filter
     */
    private updateBlockVisibilityByAlias(): void {
        if (!this.currentAlias) {
            this.showAllBlocks();
            return;
        }
        
        this.allBlocks.forEach(({ block }) => {
            const container = block.getContainer();
            if (container) {
                const hasAlias = this.blockContainsAlias(block);
                const matchesFilter = this.currentFilter ? 
                    (block.contents.toLowerCase().includes(this.currentFilter.toLowerCase()) || 
                     block.getTitle().toLowerCase().includes(this.currentFilter.toLowerCase())) : true;
                
                if (hasAlias && matchesFilter) {
                    container.classList.add('has-alias');
                    container.classList.remove('no-alias');
                } else {
                    container.classList.add('no-alias');
                    container.classList.remove('has-alias');
                }
            }
        });
    }

    /**
     * Shows all blocks regardless of alias
     */
    private showAllBlocks(): void {
        this.allBlocks.forEach(({ block }) => {
            const container = block.getContainer();
            if (container) {
                container.classList.remove('no-alias');
                container.classList.add('has-alias');
            }
        });
    }

    /**
     * Checks if a block contains the currently selected alias
     */
    private blockContainsAlias(block: BlockComponent): boolean {
        if (!this.currentAlias) return true;
        
        const content = block.contents;
        
        // First check if it's a saved alias (from file properties)
        if (this.aliases.includes(this.currentAlias)) {
            if (content.includes(`[[${this.currentAlias}]]`)) {
                return true;
            }
        }
        
        // Check for unsaved alias pattern
        return this.blockContainsUnsavedAlias(content);
    }

    /**
     * Checks if a block content contains the currently selected alias as an unsaved alias
     */
    private blockContainsUnsavedAlias(content: string): boolean {
        if (!this.currentAlias) return false;
        
        // Match [[path/notename|alias1|alias2]] pattern
        const escapedNoteName = this.escapeRegexChars(this.currentNoteName);
        const regex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}\\|([^\\]]+)\\]\\]`, 'g');
        const matches = Array.from(content.matchAll(regex));
        
        for (const match of matches) {
            const aliasString = match[1];
            if (!aliasString) continue;
            
            // Split by | to get all aliases after the note name
            const aliases = aliasString.split('|');
            if (aliases.includes(this.currentAlias)) {
                return true;
            }
        }
        
        return false;
    }

    // Add method to ensure view is attached to DOM without re-rendering
    public ensureAttached(): void {
        // Check if container is properly attached to the DOM
        const isProperlyAttached = this.container.parentElement && 
                                   this.container.parentElement.isConnected && 
                                   this.view.containerEl.contains(this.container);

        if (!isProperlyAttached) {
            // If we have blocks already rendered, just reattach
            if (this.allBlocks.length > 0) {
                this.attachToDOM();
                
                // Ensure blocks maintain their current collapsed state
                this.allBlocks.forEach(({ block }) => {
                    const blockContainer = block.getContainer();
                    if (blockContainer) {
                        if (this.blocksCollapsed) {
                            blockContainer.classList.add('is-collapsed');
                        }
                    }
                });
            } else {
                // Only if we don't have blocks rendered, do a full update
                this.attachToDOM();
            }
        } else {
            // Container is already attached, but ensure style monitoring is active
            this.startStyleMonitoring();
        }
    }

    private async handleAliasSelect(alias: string | null): Promise<void> {
        this.logger.debug("Alias selected:", { alias });
        this.currentAlias = alias;
        this.updateBlockVisibilityByAlias();
    }

    private handleFilterChange(filterText: string): void {
        this.logger.debug("Filter changed:", { filterText });
        
        // Clear previous debounce timeout
        if (this.filterDebounceTimeout) {
            clearTimeout(this.filterDebounceTimeout);
        }
        
        // Debounce filter updates for better performance
        this.filterDebounceTimeout = setTimeout(() => {
            this.currentFilter = filterText;
            this.updateBlockVisibilityByFilter();
            
            // Only schedule header update if we have a filter or if blocks are being shown/hidden
            // This prevents unnecessary header updates when clearing the filter
            if (filterText || this.currentAlias) {
                this.scheduleHeaderUpdate();
            }
        }, 150); // Reduced from 300ms for better responsiveness
    }

    /**
     * Schedules a header update to avoid excessive DOM operations
     */
    private scheduleHeaderUpdate(): void {
        if (!this.headerUpdatePending) {
            this.headerUpdatePending = true;
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                // Since we removed the block count display, we don't need to update the header
                // based on block count changes anymore
                this.headerUpdatePending = false;
            });
        }
    }

    public clearFilter(): void {
        this.currentFilter = '';
        this.updateBlockVisibilityByFilter();
        this.scheduleHeaderUpdate();
    }

    public getCurrentFilter(): string {
        return this.currentFilter;
    }

    /**
     * Focuses the filter input if the header exists
     * @returns true if focus was successful, false otherwise
     */
    public focusFilterInput(): boolean {
        this.logger.debug("Attempting to focus filter input", {
            hasHeader: !!this.currentHeader,
            headerElement: this.currentHeader,
            headerInDOM: this.currentHeader ? this.container.contains(this.currentHeader) : false,
            containerExists: !!this.container,
            containerInDOM: this.container.parentElement !== null
        });
        
        let headerToUse = this.currentHeader;
        
        // If current header reference is stale, try to find it in the DOM
        if (!headerToUse || !this.container.contains(headerToUse)) {
            headerToUse = this.container.querySelector('.backlinks-header') as HTMLElement;
            this.logger.debug("Found header in DOM", { 
                foundHeader: !!headerToUse,
                headerClasses: headerToUse ? headerToUse.className : null
            });
        }
        
        if (headerToUse && this.container.contains(headerToUse)) {
            this.currentHeader = headerToUse; // Update the reference
            this.logger.debug("Calling headerComponent.focusFilterInput");
            const result = this.headerComponent.focusFilterInput(headerToUse);
            this.logger.debug("HeaderComponent focus result", { result });
            return result;
        } else {
            this.logger.debug("No current header found or header not in DOM", {
                headerToUse: !!headerToUse,
                containerContains: headerToUse ? this.container.contains(headerToUse) : false
            });
            return false;
        }
    }

    /**
     * Checks if the view is ready for focusing (has content and is attached)
     */
    private isViewReadyForFocus(): boolean {
        const hasContent = this.allBlocks.length > 0;
        const isAttached = this.container.parentElement !== null;
        const hasHeader = this.container.querySelector('.backlinks-header') !== null;
        
        this.logger.debug("View readiness check", {
            hasContent,
            isAttached,
            hasHeader
        });
        
        return hasContent && isAttached && hasHeader;
    }

    /**
     * Requests focus when the header becomes available using Obsidian's recommended pattern
     */
    public requestFocusWhenReady(): void {
        this.logger.debug("Requesting focus when header is ready");
        
        // Clear any existing focus timeout
        if (this.focusTimeout) {
            clearTimeout(this.focusTimeout);
            this.focusTimeout = null;
        }
        
        // Reset focus attempts
        this.focusAttempts = 0;
        
        // Use Obsidian's recommended pattern: requestAnimationFrame for DOM readiness
        requestAnimationFrame(() => {
            this.attemptFocusWithRetry();
        });
    }

    /**
     * Attempts to focus with retry logic using proper timing
     */
    private attemptFocusWithRetry(): void {
        this.focusAttempts++;
        
        this.logger.debug("Focus attempt", { 
            attempt: this.focusAttempts,
            maxAttempts: this.maxFocusAttempts,
            isReady: this.isViewReadyForFocus()
        });
        
        if (this.isViewReadyForFocus()) {
            const success = this.focusFilterInput();
            this.logger.debug("Focus attempt result", { success, attempt: this.focusAttempts });
            
            if (success) {
                this.focusAttempts = 0;
                return;
            }
        }
        
        // If not ready or focus failed, retry with exponential backoff
        if (this.focusAttempts < this.maxFocusAttempts) {
            const delay = Math.min(50 * Math.pow(2, this.focusAttempts - 1), 500);
            this.focusTimeout = setTimeout(() => {
                this.attemptFocusWithRetry();
            }, delay);
        } else {
            this.logger.debug("Max focus attempts reached, giving up");
            this.focusAttempts = 0;
        }
    }

    /**
     * Test method to manually trigger focus for debugging
     */
    public testFocus(): void {
        this.logger.debug("Manual focus test triggered");
        this.focusFilterInput();
    }

    /**
     * Direct focus test - bypass all checks
     */
    public directFocusTest(): void {
        this.logger.debug("Direct focus test triggered");
        
        // Try to find the filter input directly
        const filterInput = this.container.querySelector('.filter-input') as HTMLInputElement;
        this.logger.debug("Direct filter input search", {
            found: !!filterInput,
            inputType: filterInput ? filterInput.type : null,
            inputVisible: filterInput ? filterInput.offsetParent !== null : false,
            inputDimensions: filterInput ? { width: filterInput.offsetWidth, height: filterInput.offsetHeight } : null
        });
        
        if (filterInput) {
            this.logger.debug("Attempting direct focus on filter input");
            filterInput.focus();
            this.logger.debug("Direct focus called");
        } else {
            this.logger.debug("No filter input found for direct focus");
        }
    }

    /**
     * Test window focus event manually
     */
    public testWindowFocus(): void {
        this.logger.debug("Testing window focus event");
        this.requestFocusWhenReady();
    }

    private updateBlockVisibilityByFilter(): void {
        if (!this.currentFilter) {
            // If no filter, show all blocks that match the current alias filter
            this.updateBlockVisibilityByAlias();
            return;
        }

        const filterLower = this.currentFilter.toLowerCase();
        
        // Apply filtering directly to blocks for accuracy
        this.allBlocks.forEach(({ block }, index) => {
            const container = block.getContainer();
            if (container) {
                const contentMatch = block.contents.toLowerCase().includes(filterLower);
                const titleMatch = block.getTitle().toLowerCase().includes(filterLower);
                const matchesFilter = contentMatch || titleMatch;
                const matchesAlias = this.currentAlias ? this.blockContainsAlias(block) : true;
                const shouldShow = matchesFilter && matchesAlias;
                
                if (shouldShow) {
                    container.classList.add('has-alias');
                    container.classList.remove('no-alias');
                } else {
                    container.classList.add('no-alias');
                    container.classList.remove('has-alias');
                }
            }
        });
    }

    /**
     * Shows the suspended state message when backlinks exist but view hasn't been focused
     */
    private showSuspendedState(linksContainer: HTMLElement): void {
        // Clear any existing blocks since we're showing suspended state
        linksContainer.empty();
        
        const suspendedMessage = linksContainer.createDiv({ 
            cls: 'suspended-state-message',
            text: 'Suspended until focused. Focus to load Coalesce content.'
        });
        suspendedMessage.style.padding = '20px';
        suspendedMessage.style.textAlign = 'center';
        suspendedMessage.style.color = 'var(--text-accent)';
        suspendedMessage.style.fontStyle = 'italic';
        suspendedMessage.style.border = '1px dashed var(--accent-color)';
        suspendedMessage.style.borderRadius = '4px';
        suspendedMessage.style.margin = '10px 0';
        suspendedMessage.style.backgroundColor = 'var(--background-secondary)';
        suspendedMessage.style.cursor = 'pointer';
        
        // Add click handler to activate the view when clicked
        suspendedMessage.addEventListener('click', () => {
            this.activateView();
        });
        
        this.logger.debug("Suspended state displayed", {
            hasBeenFocused: this.hasBeenFocused,
            backlinksCount: this.currentFilesLinkingToThis.length
        });
    }

    /**
     * Activates the view by marking it as focused and loading content
     */
    private async activateView(): Promise<void> {
        this.hasBeenFocused = true;
        this.logger.debug("View activated by user interaction");
        
        // Load the actual content now
        if (this.currentFilesLinkingToThis.length > 0 && this.currentOnLinkClick) {
            // Clear the container and rebuild with full content
            this.container.empty();
            const linksContainer = this.container.createDiv({ cls: 'backlinks-list' });
            
            // Load and render the full content
            await this.loadAndRenderContent(linksContainer, this.currentOnLinkClick, this.currentFilesLinkingToThis);
        }
    }

    /**
     * Sets up focus event listeners to detect when the view becomes focused
     */
    private setupFocusListeners(): void {
        // Listen for focus events on the view container
        this.view.containerEl.addEventListener('focusin', () => {
            this.handleViewFocus();
        });

        // Listen for click events as an alternative to focus
        this.view.containerEl.addEventListener('click', () => {
            this.handleViewFocus();
        });

        // Listen for workspace active leaf changes
        this.view.app.workspace.on('active-leaf-change', () => {
            // Check if this leaf is the active one
            if (this.view.app.workspace.activeLeaf === this.view.leaf) {
                this.handleViewFocus();
            }
        });
    }

    /**
     * Handles when the view receives focus
     */
    private handleViewFocus(): void {
        if (!this.hasBeenFocused) {
            this.logger.debug("View focused for the first time, activating content");
            this.activateView(); // No need to await here, let it run async
        }
    }

    /**
     * Public method to mark view as focused (called from CoalesceManager)
     */
    public markAsFocused(): void {
        if (!this.hasBeenFocused) {
            this.hasBeenFocused = true;
            this.logger.debug("View marked as focused externally");
            
            // If we're currently showing suspended state and have backlinks, activate
            if (this.currentFilesLinkingToThis.length > 0 && this.currentOnLinkClick) {
                const suspendedMessage = this.container.querySelector('.suspended-state-message');
                if (suspendedMessage) {
                    this.logger.debug("Activating suspended view");
                    this.activateView(); // No need to await, let it run async
                }
            }
        } else {
            this.logger.debug("View already focused, no action needed");
        }
    }

    /**
     * Cleans up focus event listeners
     */
    private cleanupFocusListeners(): void {
        // Remove DOM event listeners (these will be cleaned up automatically when the element is removed)
        // The workspace event listener will be cleaned up when the plugin is disabled
        this.logger.debug("Focus listeners cleaned up");
    }
}
