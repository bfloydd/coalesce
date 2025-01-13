import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from '../components/BlockComponent';
import { Logger } from '../utils/Logger';
import { HeaderComponent } from '../components/HeaderComponent';
import { SettingsManager } from '../SettingsManager';
import { BlockBoundaryStrategy } from '../components/block-strategies/BlockBoundaryStrategy';
import { DefaultBlockBoundaryStrategy } from '../components/block-strategies/DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from '../components/block-strategies/SingleLineBlockBoundaryStrategy';
import { TopLineBlockBoundaryStrategy } from '../components/block-strategies/TopLineBlockBoundaryStrategy';

export class CoalesceView {
    private container: HTMLElement;
    private headerComponent: HeaderComponent = new HeaderComponent();
    private sortDescending: boolean;
    private blocksCollapsed: boolean;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];
    private currentTheme: string;
    private currentAlias: string | null = null;
    private aliases: string[] = [];
    private currentFilesLinkingToThis: string[] = [];
    private currentOnLinkClick: ((path: string) => void) | null = null;

    constructor(
        private view: MarkdownView,
        private currentNoteName: string,
        private settingsManager: SettingsManager,
        private blockBoundaryStrategy: BlockBoundaryStrategy,
        private logger: Logger
    ) {
        this.currentNoteName = currentNoteName;
        this.blockBoundaryStrategy = blockBoundaryStrategy;
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;
        this.container = this.createBacklinksContainer();
        this.logger.info("Appending backlinks container to the view");

        this.currentTheme = this.settingsManager.settings.theme;
        this.applyTheme(this.currentTheme);

        this.attachToDOM();

        // Get aliases from file frontmatter
        if (this.view.file) {
            const fileCache = this.view.app.metadataCache.getCache(this.view.file.path);
            this.aliases = fileCache?.frontmatter?.aliases || [];
            if (!Array.isArray(this.aliases)) {
                this.aliases = [this.aliases].filter(Boolean);
            }
            console.log("DEBUG - File:", this.view.file.path);
            console.log("DEBUG - FileCache:", fileCache);
            console.log("DEBUG - Aliases:", this.aliases);
        }
    }

    private createBacklinksContainer(): HTMLElement {
        const container = document.createElement('div');
        container.classList.add('custom-backlinks-container');
        return container;
    }

    private async getBlockData(filePath: string, currentNoteName: string): Promise<BlockComponent[]> {
        if (this.settingsManager.settings.onlyDailyNotes && !this.isDailyNote(filePath)) {
            return [];
        }

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

    private updateBlockBoundaryStrategy(strategy: string) {
        switch (strategy) {
            case 'single-line':
                this.blockBoundaryStrategy = new SingleLineBlockBoundaryStrategy(this.logger);
                break;
            case 'top-line':
                this.blockBoundaryStrategy = new TopLineBlockBoundaryStrategy(this.logger);
                break;
            case 'default':
            default:
                this.blockBoundaryStrategy = new DefaultBlockBoundaryStrategy(this.logger);
                break;
        }
    }

    private applyTheme(theme: string) {
        const themes = ['default', 'minimal', 'modern'];
        themes.forEach(t => {
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

        // Sort blocks
        this.allBlocks.sort((a, b) => this.sortDescending 
            ? b.sourcePath.localeCompare(a.sourcePath)
            : a.sourcePath.localeCompare(b.sourcePath));

        // Render blocks with correct initial state
        for (const { block } of this.allBlocks) {
            await block.render(linksContainer, this.view, onLinkClick);
            const blockContainer = block.getContainer();
            const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
            if (contentPreview) {
                contentPreview.style.display = this.blocksCollapsed ? 'none' : 'block';
            }
            block.setArrowState(!this.blocksCollapsed);
        }

        // Create header after blocks are rendered
        console.log("DEBUG - Creating header with aliases:", this.aliases);
        const createHeader = () => {
            return this.headerComponent.createHeader(
                this.container, 
                0,  // fileCount is no longer needed
                this.allBlocks.length,  // Simply use array length
                this.sortDescending,
                () => {
                    this.toggleSort();
                    this.updateBacklinks(filesLinkingToThis, onLinkClick);
                },
                () => {
                    this.toggleAllBlocks();
                    const oldHeader = this.container.querySelector('.backlinks-header');
                    if (oldHeader && this.container.contains(oldHeader)) {
                        const newHeader = createHeader();
                        this.container.replaceChild(newHeader, oldHeader);
                    }
                },
                this.blocksCollapsed,
                this.settingsManager.settings.blockBoundaryStrategy,
                async (strategy) => {
                    this.settingsManager.settings.blockBoundaryStrategy = strategy;
                    await this.settingsManager.saveSettings();
                    this.updateBlockBoundaryStrategy(strategy);
                    await this.updateBacklinks(filesLinkingToThis, onLinkClick);
                },
                this.currentTheme,
                async (theme) => {
                    await this.handleThemeChange(theme);
                },
                this.settingsManager.settings.showFullPathTitle,
                async (show: boolean) => {
                    this.settingsManager.settings.showFullPathTitle = show;
                    await this.settingsManager.saveSettings();
                    await this.updateBlockTitles(show);
                },
                this.settingsManager.settings.position,
                async (position: "high" | "low") => {
                    this.settingsManager.settings.position = position;
                    await this.settingsManager.saveSettings();
                    this.updatePosition();
                },
                this.settingsManager.settings.onlyDailyNotes,
                async (show: boolean) => {
                    this.settingsManager.settings.onlyDailyNotes = show;
                    await this.settingsManager.saveSettings();
                    await this.updateBacklinks(filesLinkingToThis, onLinkClick);
                },
                this.aliases,
                (alias: string | null) => {
                    this.currentAlias = alias;
                    this.filterBlocksByAlias();
                },
                this.currentAlias
            );
        };

        const header = createHeader();
        this.container.appendChild(header);
        this.container.appendChild(linksContainer);
    }

    public toggleSort(): void {
        this.sortDescending = !this.sortDescending;
        this.settingsManager.settings.sortDescending = this.sortDescending;
        this.settingsManager.saveSettings();
    }

    private toggleAllBlocks(): void {
        this.blocksCollapsed = !this.blocksCollapsed;
        this.settingsManager.settings.blocksCollapsed = this.blocksCollapsed;
        this.settingsManager.saveSettings();

        // Update all blocks based on the new state
        this.allBlocks.forEach(({ block }) => {
            const blockContainer = block.getContainer();
            const contentPreview = blockContainer.querySelector('.content-preview') as HTMLElement;
            if (contentPreview) {
                contentPreview.style.display = this.blocksCollapsed ? 'none' : 'block';
            }
            block.setArrowState(!this.blocksCollapsed);
        });
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

    private isDailyNote(filePath: string): boolean {
        const dailyNotesPlugin = (this.view.app as any).internalPlugins.plugins['daily-notes'];
        if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
            return false;
        }

        const dailyNotesFolder = dailyNotesPlugin.instance.options.folder || '';
        const dailyNotePattern = /^\d{4}-\d{2}-\d{2}\.md$/;

        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];

        return filePath.startsWith(dailyNotesFolder) && dailyNotePattern.test(fileName);
    }

    // Add getter for view
    public getView(): MarkdownView {
        return this.view;
    }

    private filterBlocksByAlias() {
        console.log("Filtering by alias:", this.currentAlias);
        
        // Show all blocks and get total counts when no alias is selected
        if (!this.currentAlias) {
            this.allBlocks.forEach(({ block }) => {
                const container = block.getContainer();
                if (container) {
                    container.style.display = '';
                }
            });

            // Update header with total counts
            const header = this.container.querySelector('.backlinks-header');
            if (header) {
                const newHeader = this.headerComponent.createHeader(
                    this.container,
                    0,
                    this.allBlocks.length,  // Simply use array length
                    this.sortDescending,
                    () => this.toggleSort(),
                    () => this.toggleAllBlocks(),
                    this.blocksCollapsed,
                    this.settingsManager.settings.blockBoundaryStrategy,
                    async (strategy) => {
                        this.settingsManager.settings.blockBoundaryStrategy = strategy;
                        await this.settingsManager.saveSettings();
                        this.updateBlockBoundaryStrategy(strategy);
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
                        await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                    },
                    this.aliases,
                    (alias) => {
                        this.currentAlias = alias;
                        this.filterBlocksByAlias();
                    },
                    this.currentAlias
                );
                header.replaceWith(newHeader);
            }
            return;
        }

        // Filter blocks that contain the selected alias
        this.allBlocks.forEach(({ block }) => {
            const container = block.getContainer();
            if (!container) return;

            const content = block.contents;
            console.log("Block content:", content);
            const hasAlias = content.includes(`[[${this.currentNoteName}|${this.currentAlias}]]`) || 
                            content.includes(`[[${this.currentAlias}]]`) ||
                            content.includes(`|${this.currentAlias}]]`);
            console.log("Has alias:", hasAlias);
            
            container.style.display = hasAlias ? '' : 'none';
        });

        // Update the block count in the header
        const visibleBlocks = this.allBlocks.filter(({ block }) => {
            const container = block.getContainer();
            return container && container.style.display !== 'none';
        }).length;

        // Update header with new counts
        const header = this.container.querySelector('.backlinks-header');
        if (header) {
            const newHeader = this.headerComponent.createHeader(
                this.container,
                0,
                visibleBlocks,  // Use count of visible blocks
                this.sortDescending,
                () => this.toggleSort(),
                () => this.toggleAllBlocks(),
                this.blocksCollapsed,
                this.settingsManager.settings.blockBoundaryStrategy,
                async (strategy) => {
                    this.settingsManager.settings.blockBoundaryStrategy = strategy;
                    await this.settingsManager.saveSettings();
                    this.updateBlockBoundaryStrategy(strategy);
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
                    await this.updateBacklinks(this.currentFilesLinkingToThis, this.currentOnLinkClick!);
                },
                this.aliases,
                (alias) => {
                    this.currentAlias = alias;
                    this.filterBlocksByAlias();
                },
                this.currentAlias
            );
            header.replaceWith(newHeader);
        }
    }
}
