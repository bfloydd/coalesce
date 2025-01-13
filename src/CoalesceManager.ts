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

        // Get all markdown views that have this file open
        const markdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file?.path === file.path);

        // Initialize view for each matching leaf
        markdownViews.forEach(view => {
            this.initializeView(file, view);
        });

        // If no views were found and this is the active file, try to get the active view
        if (markdownViews.length === 0) {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView?.file?.path === file.path) {
                this.initializeView(file, activeView);
            }
        }
    }

    // Initialize all existing markdown views
    initializeAllViews() {
        const markdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file);

        markdownViews.forEach(view => {
            if (view.file) {
                this.initializeView(view.file, view);
            }
        });
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
            this.logger
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
