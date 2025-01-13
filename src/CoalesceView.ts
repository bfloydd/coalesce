import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from './BlockComponent';
import { Logger } from './Logger';
import { HeaderComponent } from './HeaderComponent';
import { SettingsManager } from './SettingsManager';
import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { DefaultBlockBoundaryStrategy } from './DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from './SingleLineBlockBoundaryStrategy';
import { TopLineBlockBoundaryStrategy } from './TopLineBlockBoundaryStrategy';

export class CoalesceView {
    private container: HTMLElement;
    private headerComponent: HeaderComponent = new HeaderComponent();
    private sortDescending: boolean;
    private blocksCollapsed: boolean;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];
    private currentTheme: string;

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
        const createHeader = () => {
            return this.headerComponent.createHeader(
                this.container, 
                filesLinkingToThis.length,
                this.allBlocks.length,
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
}
