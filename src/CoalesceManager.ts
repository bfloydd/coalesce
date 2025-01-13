import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView } from './CoalesceView';
import { Logger } from './Logger';
import { SettingsManager } from './SettingsManager';
import { DefaultBlockBoundaryStrategy } from './DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from './SingleLineBlockBoundaryStrategy';

export class CoalesceManager {
    private activeViews: Map<string, CoalesceView> = new Map();

    constructor(
        private app: App, 
        private settingsManager: SettingsManager,
        private logger: Logger
    ) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            this.logger.debug("No active view found, retrying in 100ms");
            setTimeout(() => {
                const retryView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (retryView) {
                    this.initializeView(file, retryView);
                }
            }, 100);
            return;
        }

        this.initializeView(file, view);
    }

    private initializeView(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as any).id;
        
        // Clear existing view for this leaf if it exists
        const existingView = this.activeViews.get(leafId);
        if (existingView) {
            existingView.clear();
        }
        
        const currentNoteName = file.basename;
        const blockBoundaryStrategy = this.getStrategyFromSettings();
        const coalesceView = new CoalesceView(
            view, 
            currentNoteName, 
            this.settingsManager, 
            blockBoundaryStrategy,
            this.logger,
            async (theme: string) => {
                // Update theme in settings
                this.settingsManager.settings.theme = theme;
                await this.settingsManager.saveSettings();
                
                // Update all views
                this.updateAllViewsTheme(theme);
            }
        );

        this.activeViews.set(leafId, coalesceView);

        const backlinks = this.app.metadataCache.resolvedLinks;
        const filesLinkingToThis = Object.entries(backlinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);

        coalesceView.updateBacklinks(filesLinkingToThis, (path) => {
            this.app.workspace.openLinkText(path, '', false);
        });
    }

    private updateAllViewsTheme(theme: string) {
        for (const view of this.activeViews.values()) {
            view.updateTheme(theme);
        }
    }

    private getStrategyFromSettings() {
        const blockBoundaryStrategy = this.settingsManager.settings.blockBoundaryStrategy;
        switch (blockBoundaryStrategy) {
            case 'single-line':
                return new SingleLineBlockBoundaryStrategy(this.logger);
            case 'default':
            default:
                return new DefaultBlockBoundaryStrategy(this.logger);
        }
    }

    clearBacklinks() {
        for (const view of this.activeViews.values()) {
            view.clear();
        }
        this.activeViews.clear();
    }
}
