import { App, ItemView, MarkdownView, WorkspaceLeaf, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from '../components/BlockComponent';
import { Logger } from '../utils/Logger';
import { HeaderComponent } from '../components/HeaderComponent';
import { SettingsManager } from '../SettingsManager';
import { BlockBoundaryStrategy } from '../components/block-strategies/BlockBoundaryStrategy';
import { DefaultBlockBoundaryStrategy } from '../components/block-strategies/DefaultBlockBoundaryStrategy';
import { TopLineBlockBoundaryStrategy } from '../components/block-strategies/TopLineBlockBoundaryStrategy';
import { HeadersOnlyBlockBoundaryStrategy } from '../components/block-strategies/HeadersOnlyBlockBoundaryStrategy';
import { isDailyNote } from '../utils/Notes';
import { ThemeManager } from '../ThemeManager';

export class CoalesceView {
    private container: HTMLElement;
    private headerComponent: HeaderComponent;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];
    private currentTheme: string;
    private currentAlias: string | null = null;
    private aliases: string[] = [];
    private currentFilesLinkingToThis: string[] = [];
    private currentOnLinkClick: ((path: string) => void) | null = null;
    private blockBoundaryStrategy: BlockBoundaryStrategy;

    // Static properties to share state across instances
    private static sortDescending: boolean;
    private static blocksCollapsed: boolean;
    private static initialized: boolean = false;

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
        this.blockBoundaryStrategy = this.getBlockBoundaryStrategy(this.settingsManager.settings.blockBoundaryStrategy);
        
        // Initialize static properties only once
        if (!CoalesceView.initialized) {
            CoalesceView.sortDescending = this.settingsManager.settings.sortDescending;
            CoalesceView.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;
            CoalesceView.initialized = true;
        }

        this.logger.info("Appending backlinks container to the view");

        this.applyTheme(this.currentTheme);

        this.attachToDOM();

        // Get aliases from file frontmatter
        if (this.view.file) {
            const fileCache = this.view.app.metadataCache.getCache(this.view.file.path);
            this.aliases = fileCache?.frontmatter?.aliases || [];
            if (!Array.isArray(this.aliases)) {
                this.aliases = [this.aliases].filter(Boolean);
            }
            this.logger.debug("DEBUG - File:", this.view.file.path);
            this.logger.debug("DEBUG - FileCache:", fileCache);
            this.logger.debug("DEBUG - Aliases:", this.aliases);
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
                const boundaries = this.blockBoundaryStrategy.findBlockBoundaries(content, currentNoteName);

                for (const { start, end } of boundaries) {
                    const blockContent = content.substring(start, end);
                    const block = new BlockComponent(
                        blockContent, 
                        filePath, 
                        currentNoteName, 
                        this.settingsManager.settings.showFullPathTitle,
                        this.logger
                    );
                    blocks.push(block);
                }
            }
        } catch (error) {
            console.error(`Error reading file content for ${filePath}:`, error);
        }
        return blocks;
    }

    private getBlockBoundaryStrategy(strategy: string): BlockBoundaryStrategy {
        switch (strategy) {
            case 'headers-only':
                return new HeadersOnlyBlockBoundaryStrategy(this.logger);
            case 'top-line':
                return new TopLineBlockBoundaryStrategy(this.logger);
            case 'default':
            default:
                return new DefaultBlockBoundaryStrategy(this.logger);
        }
    }

    private updateBlockBoundaryStrategy(strategy: string) {
        this.blockBoundaryStrategy = this.getBlockBoundaryStrategy(strategy);
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

    private async updateBlockTitles(show: boolean): Promise<void> {
        this.allBlocks.forEach(({ block }) => {
            block.updateTitleDisplay(show);
        });
    }

    private extractUnsavedAliases(filesLinkingToThis: string[]): string[] {
        const unsavedAliases = new Set<string>();
        
        // Process each block to find unsaved aliases
        this.allBlocks.forEach(({ block }) => {
            const content = block.contents;
            
            // Match [[path/notename|alias1|alias2]] pattern, escaping the note name for regex
            const escapedNoteName = this.currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}\\|([^\\]]+)\\]\\]`, 'g');
            const matches = content.matchAll(regex);
            
            for (const match of matches) {
                const aliasString = match[1];
                if (!aliasString) continue;
                
                // Split by | to get all aliases after the note name
                const aliases = aliasString.split('|');
                aliases.forEach(alias => {
                    // Only add if it's not already in the saved aliases and not the current note name
                    if (alias && !this.aliases.includes(alias) && alias !== this.currentNoteName) {
                        unsavedAliases.add(alias);
                    }
                });
            }
        });

        return Array.from(unsavedAliases).sort();
    }

    public async updateBacklinks(filesLinkingToThis: string[], onLinkClick: (path: string) => void): Promise<void> {
        this.currentFilesLinkingToThis = filesLinkingToThis;
        this.currentOnLinkClick = onLinkClick;
        this.logger.info("Updating backlinks:", filesLinkingToThis);
        this.container.empty();

        const linksContainer = this.container.createDiv('backlinks-list');
        this.logger.info("Links container:", linksContainer);

        this.allBlocks = [];
        
        // Collect all blocks first
        for (const sourcePath of filesLinkingToThis) {
            const blocks = await this.getBlockData(sourcePath, this.currentNoteName);
            blocks.forEach(block => {
                this.allBlocks.push({ block, sourcePath });
            });
        }

        // Extract unsaved aliases after collecting blocks
        const unsavedAliases = this.extractUnsavedAliases(filesLinkingToThis);

        // Sort blocks
        this.allBlocks.sort((a, b) => CoalesceView.sortDescending 
            ? b.sourcePath.localeCompare(a.sourcePath)
            : a.sourcePath.localeCompare(b.sourcePath));

        // Render blocks with correct initial state
        for (const { block } of this.allBlocks) {
            await block.render(linksContainer, this.view, onLinkClick);
            const blockContainer = block.getContainer();
            const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
            if (contentPreview) {
                contentPreview.style.display = CoalesceView.blocksCollapsed ? 'none' : 'block';
            }
            block.setArrowState(!CoalesceView.blocksCollapsed);
        }

        // Create header after blocks are rendered
        this.logger.debug("DEBUG - Creating header with aliases:", this.aliases);
        const header = this.headerComponent.createHeader(
            this.container, 
            0,
            this.allBlocks.length,
            CoalesceView.sortDescending,
            () => {
                this.toggleSort();
                this.updateBacklinks(filesLinkingToThis, onLinkClick);
            },
            () => this.toggleAllBlocks(),
            CoalesceView.blocksCollapsed,
            this.settingsManager.settings.blockBoundaryStrategy,
            async (strategy) => {
                this.settingsManager.settings.blockBoundaryStrategy = strategy;
                await this.settingsManager.saveSettings();
                this.updateBlockBoundaryStrategy(strategy);
                await this.updateBacklinks(filesLinkingToThis, onLinkClick);
            },
            this.currentTheme,
            async (theme) => this.handleThemeChange(theme),
            this.settingsManager.settings.showFullPathTitle,
            async (show) => {
                this.settingsManager.settings.showFullPathTitle = show;
                await this.settingsManager.saveSettings();
                await this.updateBlockTitles(show);
            },
            this.settingsManager.settings.position,
            async (position) => {
                this.settingsManager.settings.position = position;
                await this.settingsManager.saveSettings();
                this.updatePosition();
            },
            this.settingsManager.settings.onlyDailyNotes,
            async (show: boolean) => {
                this.settingsManager.settings.onlyDailyNotes = show;
                await this.settingsManager.saveSettings();
            },
            this.aliases,
            (alias: string | null) => {
                this.currentAlias = alias;
                this.filterBlocksByAlias();
            },
            this.currentAlias,
            unsavedAliases
        );
        this.container.appendChild(header);
        this.container.appendChild(linksContainer);
    }

    public toggleSort(): void {
        CoalesceView.sortDescending = !CoalesceView.sortDescending;
        this.settingsManager.settings.sortDescending = CoalesceView.sortDescending;
        this.settingsManager.saveSettings();
    }

    private toggleAllBlocks(): void {
        CoalesceView.blocksCollapsed = !CoalesceView.blocksCollapsed;
        this.settingsManager.settings.blocksCollapsed = CoalesceView.blocksCollapsed;
        this.settingsManager.saveSettings();

        // Update all blocks based on the new state
        this.allBlocks.forEach(({ block }) => {
            const blockContainer = block.getContainer();
            if (blockContainer) {
                const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
                if (contentPreview) {
                    contentPreview.style.display = CoalesceView.blocksCollapsed ? 'none' : 'block';
                }
                block.setArrowState(!CoalesceView.blocksCollapsed);
            }
        });

        // Update header to reflect new state
        const oldHeader = this.container.querySelector('.backlinks-header');
        if (oldHeader && this.container.contains(oldHeader)) {
            const visibleBlocks = this.allBlocks.filter(({ block }) => {
                const container = block.getContainer();
                return container && container.style.display !== 'none';
            }).length;

            const newHeader = this.headerComponent.createHeader(
                this.container,
                0,
                visibleBlocks,
                CoalesceView.sortDescending,
                () => {
                    this.toggleSort();
                    this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                },
                () => this.toggleAllBlocks(),
                CoalesceView.blocksCollapsed,
                this.settingsManager.settings.blockBoundaryStrategy,
                async (strategy) => {
                    this.settingsManager.settings.blockBoundaryStrategy = strategy;
                    await this.settingsManager.saveSettings();
                    this.updateBlockBoundaryStrategy(strategy);
                    await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                },
                this.currentTheme,
                async (theme) => this.handleThemeChange(theme),
                this.settingsManager.settings.showFullPathTitle,
                async (show) => {
                    this.settingsManager.settings.showFullPathTitle = show;
                    await this.settingsManager.saveSettings();
                    await this.updateBlockTitles(show);
                },
                this.settingsManager.settings.position,
                async (position) => {
                    this.settingsManager.settings.position = position;
                    await this.settingsManager.saveSettings();
                    this.updatePosition();
                },
                this.settingsManager.settings.onlyDailyNotes,
                async (show: boolean) => {
                    this.settingsManager.settings.onlyDailyNotes = show;
                    await this.settingsManager.saveSettings();
                },
                this.aliases,
                (alias: string | null) => {
                    this.currentAlias = alias;
                    this.filterBlocksByAlias();
                },
                this.currentAlias
            );
            this.container.replaceChild(newHeader, oldHeader);
        }
    }

    clear() {
        // Remove the container from the DOM totally
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.logger.info("Backlinks view cleared");
    }

    private attachToDOM() {
        if (this.settingsManager.settings.position === 'high') {
            // Position 1 (high)
            const markdownContent = this.view.containerEl.querySelector('.markdown-preview-section .mod-footer') as HTMLElement;
            if (markdownContent) {
                markdownContent.classList.add('markdown-content');
                markdownContent.appendChild(this.container);
            } else {
                this.logger.error("Markdown content area not found.");
            }
        } else {
            // Position 2 (low)
            const markdownSection = this.view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
            if (markdownSection) {
                markdownSection.insertAdjacentElement('afterend', this.container);
            } else {
                this.logger.error("Markdown preview section not found.");
            }
        }
    }

    // Add method to handle position changes
    public async updatePosition() {
        this.clear();
        this.attachToDOM();
    }

    // Add getter for view
    public getView(): MarkdownView {
        return this.view;
    }

    private filterBlocksByAlias() {
        this.logger.debug("Filtering by alias:", this.currentAlias);
        
        // Show all blocks and get total counts when no alias is selected
        if (!this.currentAlias) {
            this.allBlocks.forEach(({ block }) => {
                const container = block.getContainer();
                if (container) {
                    container.style.display = '';
                }
            });
        } else {
            // Filter blocks that contain the selected alias
            this.allBlocks.forEach(({ block }) => {
                const container = block.getContainer();
                if (!container) return;

                const content = block.contents;
                this.logger.debug("Block content:", content);
                
                let hasAlias = false;
                
                // First check if it's a saved alias (from file properties)
                if (this.currentAlias && this.aliases.includes(this.currentAlias)) {
                    hasAlias = content.includes(`[[${this.currentAlias}]]`);
                }
                
                // If not found and we have an alias selected, check for unsaved alias pattern
                if (!hasAlias && this.currentAlias) {
                    // Match [[path/notename|alias1|alias2]] pattern
                    const escapedNoteName = this.currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\[\\[(?:[^\\]|]*?/)?${escapedNoteName}\\|([^\\]]+)\\]\\]`, 'g');
                    const matches = Array.from(content.matchAll(regex));
                    
                    for (const match of matches) {
                        const aliasString = match[1];
                        if (!aliasString) continue;
                        
                        // Split by | to get all aliases after the note name
                        const aliases = aliasString.split('|');
                        if (aliases.includes(this.currentAlias)) {
                            hasAlias = true;
                            break;
                        }
                    }
                }
                
                this.logger.debug("Has alias:", hasAlias);
                container.style.display = hasAlias ? '' : 'none';
            });
        }

        // Update the block count in the header
        const visibleBlocks = this.allBlocks.filter(({ block }) => {
            const container = block.getContainer();
            return container && container.style.display !== 'none';
        }).length;

        // Get current unsaved aliases
        const unsavedAliases = this.extractUnsavedAliases(this.currentFilesLinkingToThis);

        // Update header with new counts
        const header = this.container.querySelector('.backlinks-header');
        if (header) {
            const newHeader = this.headerComponent.createHeader(
                this.container,
                0,
                visibleBlocks,
                CoalesceView.sortDescending,
                () => {
                    this.toggleSort();
                    this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                },
                () => this.toggleAllBlocks(),
                CoalesceView.blocksCollapsed,
                this.settingsManager.settings.blockBoundaryStrategy,
                async (strategy) => {
                    this.settingsManager.settings.blockBoundaryStrategy = strategy;
                    await this.settingsManager.saveSettings();
                    this.updateBlockBoundaryStrategy(strategy);
                    await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                },
                this.currentTheme,
                async (theme) => this.handleThemeChange(theme),
                this.settingsManager.settings.showFullPathTitle,
                async (show) => {
                    this.settingsManager.settings.showFullPathTitle = show;
                    await this.settingsManager.saveSettings();
                    await this.updateBlockTitles(show);
                },
                this.settingsManager.settings.position,
                async (position) => {
                    this.settingsManager.settings.position = position;
                    await this.settingsManager.saveSettings();
                    this.updatePosition();
                },
                this.settingsManager.settings.onlyDailyNotes,
                async (show: boolean) => {
                    this.settingsManager.settings.onlyDailyNotes = show;
                    await this.settingsManager.saveSettings();
                },
                this.aliases,
                (alias: string | null) => {
                    this.currentAlias = alias;
                    this.filterBlocksByAlias();
                },
                this.currentAlias,
                unsavedAliases
            );
            header.replaceWith(newHeader);
        }
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
                        const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
                        if (contentPreview) {
                            contentPreview.style.display = CoalesceView.blocksCollapsed ? 'none' : 'block';
                        }
                        block.setArrowState(!CoalesceView.blocksCollapsed);
                    }
                });
            } else {
                // Only if we don't have blocks rendered, do a full update
                this.attachToDOM();
            }
        }
    }
}
