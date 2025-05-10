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
 * Handles the UI representation of backlinks
 * Manages the DOM elements and rendering
 * Handles user interactions (clicking, toggling, etc.)
 * Coordinates between the block finders and the UI
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
        
        // Initialize instance properties from settings
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;

        this.logger.debug("Appending backlinks container to view");

        this.applyTheme(this.currentTheme);

        this.attachToDOM();

        // Get aliases from file frontmatter
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

                for (const { start, end } of boundaries) {
                    const blockContent = content.substring(start, end);
                    const block = new BlockComponent(
                        blockContent, 
                        filePath, 
                        currentNoteName, 
                        this.settingsManager.settings.headerStyle,
                        this.logger,
                        this.settingsManager.settings.blockBoundaryStrategy
                    );
                    blocks.push(block);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to read file content for ${filePath}:`, error);
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

    private sortBlocks(): void {
        // Sort blocks in place
        this.allBlocks.sort((a, b) => {
            // First sort by source path
            const pathCompare = this.sortDescending 
                ? b.sourcePath.localeCompare(a.sourcePath)
                : a.sourcePath.localeCompare(b.sourcePath);
            
            if (pathCompare !== 0) return pathCompare;

            // If paths are equal, sort by block position in file
            const aContent = a.block.contents;
            const bContent = b.block.contents;
            return this.sortDescending 
                ? bContent.localeCompare(aContent)
                : aContent.localeCompare(bContent);
        });

        // Update DOM order to match sorted order
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
        
        // Sort blocks and update UI
        this.sortBlocks();
        
        // Update sort button state
        const header = this.container.querySelector('.backlinks-header');
        if (header) {
            const sortButton = header.querySelector('.sort-button svg') as SVGElement;
            if (sortButton) {
                sortButton.style.transform = this.sortDescending ? 'none' : 'rotate(180deg)';
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
        this.sortBlocks();

        // Render blocks with correct initial state
        for (const { block } of this.allBlocks) {
            await block.render(linksContainer, this.view, onLinkClick);
            const blockContainer = block.getContainer();
            if (blockContainer) {
                const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
                if (contentPreview) {
                    contentPreview.style.display = this.blocksCollapsed ? 'none' : 'block';
                }
                block.setCollapsed(!this.blocksCollapsed);
            }
        }

        // Create header after blocks are rendered
        const header = this.headerComponent.createHeader(
            this.container, 
            0,
            this.allBlocks.length,
            this.sortDescending,
            () => this.toggleSort(),
            () => this.toggleAllBlocks(),
            this.blocksCollapsed,
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
                await this.updateBlockTitles(show ? 'full' : 'short');
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
            unsavedAliases,
            this.settingsManager.settings.headerStyle,
            async (style: string) => {
                this.settingsManager.settings.headerStyle = style;
                await this.settingsManager.saveSettings();
                await this.updateBlockTitles(style);
            }
        );
        this.container.appendChild(header);
        this.container.appendChild(linksContainer);
    }

    private toggleAllBlocks(): void {
        this.blocksCollapsed = !this.blocksCollapsed;
        this.settingsManager.settings.blocksCollapsed = this.blocksCollapsed;
        this.settingsManager.saveSettings();

        // Update all blocks based on the new state
        this.allBlocks.forEach(({ block }) => {
            const blockContainer = block.getContainer();
            if (blockContainer) {
                const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
                if (contentPreview) {
                    contentPreview.style.display = this.blocksCollapsed ? 'none' : 'block';
                }
                block.setCollapsed(!this.blocksCollapsed);
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
                this.sortDescending,
                () => this.toggleSort(),
                () => this.toggleAllBlocks(),
                this.blocksCollapsed,
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
                    await this.updateBlockTitles(show ? 'full' : 'short');
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
                this.extractUnsavedAliases(this.currentFilesLinkingToThis),
                this.settingsManager.settings.headerStyle,
                async (style: string) => {
                    this.settingsManager.settings.headerStyle = style;
                    await this.settingsManager.saveSettings();
                    await this.updateBlockTitles(style);
                }
            );
            this.container.replaceChild(newHeader, oldHeader);
        }
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
        this.clear();
        this.attachToDOM();
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
                this.sortDescending,
                () => this.toggleSort(),
                () => this.toggleAllBlocks(),
                this.blocksCollapsed,
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
                    await this.updateBlockTitles(show ? 'full' : 'short');
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
                unsavedAliases,
                this.settingsManager.settings.headerStyle,
                async (style: string) => {
                    this.settingsManager.settings.headerStyle = style;
                    await this.settingsManager.saveSettings();
                    await this.updateBlockTitles(style);
                }
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
                            contentPreview.style.display = this.blocksCollapsed ? 'none' : 'block';
                        }
                        block.setCollapsed(!this.blocksCollapsed);
                    }
                });
            } else {
                // Only if we don't have blocks rendered, do a full update
                this.attachToDOM();
            }
        }
    }
}
