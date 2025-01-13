import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView } from './views/CoalesceView';
import { Logger } from './utils/Logger';
import { SettingsManager } from './SettingsManager';
import { DefaultBlockBoundaryStrategy } from './components/block-strategies/DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from './components/block-strategies/SingleLineBlockBoundaryStrategy';

export class CoalesceManager {
    private activeViews: Map<string, CoalesceView> = new Map();

    constructor(
        private app: App, 
        private settingsManager: SettingsManager,
        private logger: Logger
    ) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        // Don't clear existing views anymore, as we want to keep other panes' views
        // this.clearBacklinks();

        // Get all markdown views
        const allMarkdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file); // Only get views with files

        // For each markdown view, initialize or update its coalesce view
        allMarkdownViews.forEach(view => {
            const leafId = (view.leaf as any).id;
            const viewFile = view.file;
            
            if (!viewFile) return;

            // If this view already has a coalesce view and it's for a different file,
            // clear it before creating a new one
            const existingView = this.activeViews.get(leafId);
            if (existingView && existingView.getView().file?.path !== viewFile.path) {
                existingView.clear();
                this.activeViews.delete(leafId);
            }

            // Only create a new view if one doesn't exist for this leaf
            if (!this.activeViews.has(leafId)) {
                this.initializeView(viewFile, view);
            }
        });

        // Clean up any views that are no longer visible
        const currentLeafIds = new Set(allMarkdownViews.map(view => (view.leaf as any).id));
        for (const [leafId, view] of this.activeViews.entries()) {
            if (!currentLeafIds.has(leafId)) {
                view.clear();
                this.activeViews.delete(leafId);
            }
        }
    }

    // Initialize all existing markdown views
    initializeAllViews() {
        const allMarkdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file);

        // Clear all existing views first
        this.clearBacklinks();

        // Initialize views for all visible markdown files
        allMarkdownViews.forEach(view => {
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
        // Ensure proper cleanup of each view
        for (const view of this.activeViews.values()) {
            view.clear();
        }
        this.activeViews.clear();
    }
}
