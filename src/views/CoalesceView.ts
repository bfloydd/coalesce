import { MarkdownView,TFile } from 'obsidian';
import { BlockComponent } from '../components/BlockComponent';
import { Logger } from '../utils/Logger';
import { HeaderComponent } from '../components/HeaderComponent';
import { SettingsManager } from '../SettingsManager';
import { ThemeManager } from '../ThemeManager';
import { AbstractBlockFinder } from '../block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from '../block-finders/BlockFinderFactory';
import { DailyNote } from '../utils/DailyNote';

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
    private currentOnLinkClick: ((path: string) => void) | null = null;
    private blockFinder: AbstractBlockFinder;
    private sortDescending: boolean;
    private blocksCollapsed: boolean;

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
        this.blockFinder = BlockFinderFactory.createBlockFinder(
            this.settingsManager.settings.blockBoundaryStrategy,
            this.logger
        );
        
        this.initializeFromSettings();
        this.applyTheme(this.currentTheme);
        this.attachToDOM();
        this.loadAliasesFromMetadata();
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
        const container = document.createElement('div');
        container.classList.add('custom-backlinks-container');
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
                this.settingsManager.settings.hideBacklinkLine
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
        const pathCompare = this.sortDescending 
            ? b.sourcePath.localeCompare(a.sourcePath)
            : a.sourcePath.localeCompare(b.sourcePath);
        
        if (pathCompare !== 0) return pathCompare;

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

    public async updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string) => void): Promise<void> {
        this.currentFilesLinkingToThis = filesLinkingToThis;
        this.currentOnLinkClick = onLinkClick;
        this.logger.debug("Updating backlinks", { count: filesLinkingToThis.length, files: filesLinkingToThis });
        this.container.empty();

        const linksContainer = this.container.createDiv('backlinks-list');
        this.allBlocks = [];
        
        await this.collectBlocksFromFiles(filesLinkingToThis);
        
        // Extract unsaved aliases after collecting blocks
        const unsavedAliases = this.extractUnsavedAliases(filesLinkingToThis);

        // Sort blocks
        this.sortBlocks();

        // Render blocks with correct initial state
        await this.renderBlocks(linksContainer, onLinkClick);

        // Create header after blocks are rendered
        const header = this.createBacklinksHeader(unsavedAliases, filesLinkingToThis, onLinkClick);
        this.container.appendChild(header);
        this.container.appendChild(linksContainer);
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
    private async renderBlocks(linksContainer: HTMLElement, onLinkClick: (path: string) => void): Promise<void> {
        for (const { block } of this.allBlocks) {
            try {
                await block.render(linksContainer, this.view, onLinkClick);
                
                const blockContainer = block.getContainer();
                if (blockContainer) {
                    if (this.blocksCollapsed) {
                        blockContainer.classList.add('is-collapsed');
                    }
                }
            } catch (error) {
                this.logger.error('Failed to render block:', error);
            }
        }
    }

    /**
     * Creates the backlinks header with all needed event handlers
     */
    private createBacklinksHeader(
        unsavedAliases: string[], 
        filesLinkingToThis: string[], 
        onLinkClick: (path: string) => void
    ): HTMLElement {
        return this.headerComponent.createHeader(
            this.container, 
            0,
            this.allBlocks.length,
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
            this.settingsManager.settings.position,
            async (position) => this.handlePositionChange(position),
            this.settingsManager.settings.onlyDailyNotes,
            async (show: boolean) => this.handleDailyNotesChange(show),
            this.aliases,
            async (alias: string | null) => this.handleAliasSelect(alias),
            this.currentAlias,
            unsavedAliases,
            this.settingsManager.settings.headerStyle,
            async (style: string) => this.handleHeaderStyleChange(style),
            this.settingsManager.settings.hideBacklinkLine,
            async (hide: boolean) => this.handleHideBacklinkLineChange(hide)
        );
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
     * Handles the change of position setting
     */
    private async handlePositionChange(position: 'high' | 'low'): Promise<void> {
        this.settingsManager.settings.position = position;
        await this.settingsManager.saveSettings();
        this.updatePosition();
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

        // Update header to reflect new state
        this.updateHeaderWithVisibleBlockCount();
    }

    /**
     * Updates the collapse state of all blocks based on the current collapsed setting
     */
    private updateAllBlocksCollapsedState(): void {
        this.allBlocks.forEach(({ block }) => {
            const container = block.getContainer();
            if (container) {
                if (this.blocksCollapsed) {
                    container.classList.add('is-collapsed');
                } else {
                    container.classList.remove('is-collapsed');
                }
            }
        });
    }

    /**
     * Updates the header with the current count of visible blocks
     */
    private updateHeaderWithVisibleBlockCount(): void {
        const oldHeader = this.container.querySelector('.backlinks-header');
        if (oldHeader && this.container.contains(oldHeader)) {
            const visibleBlocks = this.countVisibleBlocks();
            const unsavedAliases = this.extractUnsavedAliases(this.currentFilesLinkingToThis);
            
            const newHeader = this.createBacklinksHeader(
                unsavedAliases,
                this.currentFilesLinkingToThis,
                this.currentOnLinkClick!
            );
            
            this.container.replaceChild(newHeader, oldHeader);
        }
    }

    /**
     * Counts the number of blocks that are currently visible
     */
    private countVisibleBlocks(): number {
        return this.allBlocks.filter(({ block }) => {
            const container = block.getContainer();
            return container && !container.classList.contains('no-alias');
        }).length;
    }

    public cleanup(): void {
        // Clean up the header component to prevent memory leaks
        if (this.headerComponent) {
            this.headerComponent.cleanup();
        }
        
        // Clear any stored blocks and references
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
        this.logger.debug("Cleared backlinks view");
    }

    private attachToDOM() {
        // Check if we should hide in daily notes 
        if (this.settingsManager.settings.onlyDailyNotes && 
            this.view.file && 
            DailyNote.isDaily(this.view.app, this.view.file.path)) {
            // Do not attach if we're in a daily note and setting is enabled
            this.logger.debug("Skipping Coalesce attachment in daily note (Hide in Daily Notes enabled)");
            return;
        }

        // Only create backlinks list if it doesn't exist and we're not handling this in updatePosition
        if (!this.container.querySelector('.backlinks-list') && this.allBlocks.length === 0) {
            const linksContainer = document.createElement('div');
            linksContainer.addClass('backlinks-list');
            this.container.appendChild(linksContainer);
        }

        if (this.settingsManager.settings.position === 'high') {
            // Position 1 (high)
            const markdownContent = this.view.containerEl.querySelector('.markdown-preview-section .mod-footer') as HTMLElement;
            if (markdownContent) {
                markdownContent.classList.add('markdown-content');
                markdownContent.appendChild(this.container);
            } else {
                this.logger.error("Failed to attach Coalesce: markdown content area not found");
            }
        } else {
            // Position 2 (low)
            const markdownSection = this.view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
            if (markdownSection) {
                markdownSection.insertAdjacentElement('afterend', this.container);
            } else {
                this.logger.error("Failed to attach Coalesce: markdown preview section not found");
            }
        }
    }

    // Add method to handle position changes
    public async updatePosition() {
        // Remove from current position in the DOM
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        
        // Clear the container but keep our data
        this.container.empty();
        
        // Create a new backlinks list container
        const linksContainer = document.createElement('div');
        linksContainer.addClass('backlinks-list');
        this.container.appendChild(linksContainer);
        
        // Attach to new position in DOM
        this.attachToDOM();
        
        // Restore backlinks if we had any
        if (this.allBlocks.length > 0 && this.currentFilesLinkingToThis.length > 0 && this.currentOnLinkClick) {
            // Recreate the header with the current settings
            const unsavedAliases = this.extractUnsavedAliases(this.currentFilesLinkingToThis);
            const header = this.createBacklinksHeader(unsavedAliases, this.currentFilesLinkingToThis, this.currentOnLinkClick);
            
            // Add the header to the container (no need to replace since we emptied it)
            this.container.insertBefore(header, this.container.firstChild);
            
            // Get the links container we just created
            if (linksContainer) {
                // Re-render existing blocks to the new location
                await this.renderBlocks(linksContainer, this.currentOnLinkClick);
                
                // Ensure blocks maintain their current collapsed state
                this.allBlocks.forEach(({ block }) => {
                    const blockContainer = block.getContainer();
                    if (blockContainer) {
                        if (this.blocksCollapsed) {
                            blockContainer.classList.add('is-collapsed');
                        }
                    }
                });
                
                // Update block visibility based on current alias filter
                this.updateBlockVisibilityByAlias();
                
                // Update the header with the correct block count
                this.updateHeaderWithVisibleBlockCount();
            }
        }
    }

    // Add getter for view
    public getView(): MarkdownView {
        return this.view;
    }

    private filterBlocksByAlias() {
        this.logger.debug("Filtering blocks by alias", { 
            currentAlias: this.currentAlias,
            totalBlocks: this.allBlocks.length,
            savedAliases: this.aliases
        });
        
        this.updateBlockVisibilityByAlias();
        this.updateHeaderWithVisibleBlockCount();
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
                
                if (hasAlias) {
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
        // Check if container is already in the DOM
        if (!this.container.parentElement) {
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
        }
    }

    private async handleAliasSelect(alias: string | null): Promise<void> {
        this.logger.debug("Alias selected:", { alias });
        this.currentAlias = alias;
        this.updateBlockVisibilityByAlias();
        this.updateHeaderWithVisibleBlockCount();
    }
}
