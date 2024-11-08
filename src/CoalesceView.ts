import { MarkdownView, TFile, MarkdownRenderer } from 'obsidian';
import { BlockComponent } from './BlockComponent';
import { Logger } from './Logger';
import { HeaderComponent } from './HeaderComponent';
import { SettingsManager } from './SettingsManager';
import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { DefaultBlockBoundaryStrategy } from './DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from './SingleLineBlockBoundaryStrategy';

export class CoalesceView {
    private container: HTMLElement;
    private currentNoteName: string;
    private logger: Logger = new Logger();
    private headerComponent: HeaderComponent = new HeaderComponent();
    private sortDescending: boolean;
    private blocksCollapsed: boolean;
    private allBlocks: { block: BlockComponent; sourcePath: string }[] = [];
    private blockBoundaryStrategy: BlockBoundaryStrategy;
    private currentTheme: string;

    constructor(
        private view: MarkdownView,
        currentNoteName: string,
        private settingsManager: SettingsManager,
        blockBoundaryStrategy: BlockBoundaryStrategy,
    ) {
        this.currentNoteName = currentNoteName;
        this.blockBoundaryStrategy = blockBoundaryStrategy;
        this.sortDescending = this.settingsManager.settings.sortDescending;
        this.blocksCollapsed = this.settingsManager.settings.blocksCollapsed;
        this.container = this.createBacklinksContainer();
        this.logger.info("Appending backlinks container to the view");

        this.currentTheme = this.settingsManager.settings.theme;
        this.applyTheme(this.currentTheme);

        // Append the container directly to the markdown view's content area
        const markdownContent = this.view.containerEl.querySelector('.markdown-preview-view') as HTMLElement || this.view.contentEl as HTMLElement;
        if (markdownContent) {
            markdownContent.classList.add('markdown-content');
            markdownContent.appendChild(this.container);

        } else {
            this.logger.warn("Markdown content area not found.");
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
                    const block = new BlockComponent(blockContent, filePath, currentNoteName, this.settingsManager.settings.showFullPathTitle);
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
                this.blockBoundaryStrategy = new SingleLineBlockBoundaryStrategy();
                break;
            case 'default':
            default:
                this.blockBoundaryStrategy = new DefaultBlockBoundaryStrategy();
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
            blockContainer.style.display = this.blocksCollapsed ? 'none' : 'block';
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
                }
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
            blockContainer.style.display = this.blocksCollapsed ? 'none' : 'block';
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
}
