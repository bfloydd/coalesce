import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { CoalesceView } from './views/CoalesceView';
import { Logger } from './utils/Logger';
import { SettingsManager } from './SettingsManager';
import { AbstractBlockFinder } from './block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from './block-finders/BlockFinderFactory';
import { DailyNote } from './utils/DailyNote';

// Interface to extend WorkspaceLeaf with the id property
interface WorkspaceLeafWithID extends WorkspaceLeaf {
    id: string;
}

/** Manages view lifecycle, handles file events, and coordinates backlinks across multiple views */
export class CoalesceManager {
    private activeViews: Map<string, CoalesceView> = new Map();

    constructor(
        private app: App, 
        private settingsManager: SettingsManager,
        private logger: Logger
    ) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        this.logger.debug("Processing file open", { path: file.path });

        const allMarkdownViews = this.getAllMarkdownViews();
        const viewsToKeep = new Set<string>();

        this.processMarkdownViews(allMarkdownViews, viewsToKeep);
        this.cleanupUnusedViews(viewsToKeep);
    }

    private getAllMarkdownViews(): MarkdownView[] {
        return this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file);
    }

    private processMarkdownViews(views: MarkdownView[], viewsToKeep: Set<string>) {
        views.forEach(view => {
            const leafId = (view.leaf as WorkspaceLeafWithID).id;
            const viewFile = view.file;
            
            if (!viewFile) return;

            viewsToKeep.add(leafId);

            if (!this.activeViews.has(leafId)) {
                this.logger.debug("Initializing new view", { leafId, path: viewFile.path });
                this.initializeView(viewFile, view);
            } else {
                const existingView = this.activeViews.get(leafId);
                if (existingView) {
                    this.logger.debug("Re-attaching existing view", { leafId, path: viewFile.path });
                    existingView.ensureAttached();
                }
            }
        });
    }

    private cleanupUnusedViews(viewsToKeep: Set<string>) {
        for (const [leafId, view] of this.activeViews.entries()) {
            if (!viewsToKeep.has(leafId)) {
                this.logger.debug("Cleaning up unused view", { leafId });
                view.cleanup();
                view.clear();
                this.activeViews.delete(leafId);
            }
        }
    }

    private initializeView(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        const existingView = this.activeViews.get(leafId);
        if (existingView) {
            this.logger.debug("Clearing existing view", { leafId, path: file.path });
            existingView.clear();
        }
        
        if (this.shouldSkipDailyNote(file.path)) {
            return;
        }
        
        const currentNoteName = file.basename;
        const coalesceView = new CoalesceView(
            view, 
            currentNoteName, 
            this.settingsManager,
            this.logger
        );

        this.activeViews.set(leafId, coalesceView);
        this.updateBacklinksForView(file, coalesceView, leafId);
    }
    
    private shouldSkipDailyNote(filePath: string): boolean {
        const shouldSkip = this.settingsManager.settings.onlyDailyNotes && 
                         DailyNote.isDaily(this.app, filePath);
                         
        if (shouldSkip) {
            this.logger.debug("Skipping Coalesce view creation", {
                reason: "Hide in Daily Notes enabled",
                path: filePath
            });
        }
        
        return shouldSkip;
    }
    
    private updateBacklinksForView(file: TFile, coalesceView: CoalesceView, leafId: string) {
        const backlinks = this.app.metadataCache.resolvedLinks;
        const filesLinkingToThis = Object.entries(backlinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);

        this.logger.debug("Updating backlinks for view", {
            leafId,
            path: file.path,
            backlinksCount: filesLinkingToThis.length
        });

        coalesceView.updateBacklinks(filesLinkingToThis, (path) => {
            this.app.workspace.openLinkText(path, '', false);
        });
    }

    private getBlockFinder(strategy: string): AbstractBlockFinder {
        return BlockFinderFactory.createBlockFinder(strategy, this.logger);
    }

    clearBacklinks() {
        this.logger.debug("Clearing all backlinks", { 
            activeViewCount: this.activeViews.size 
        });

        for (const view of this.activeViews.values()) {
            view.cleanup();
            view.clear();
        }
        this.activeViews.clear();
    }

    handleModeSwitch(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug("Handling mode switch", {
            leafId,
            path: file.path,
            hasExistingView: this.activeViews.has(leafId)
        });
        
        if (this.shouldSkipDailyNote(file.path)) {
            this.clearDailyNoteView(leafId, file.path);
            return;
        }
        
        if (this.activeViews.has(leafId)) {
            this.initializeView(file, view);
        }
    }
    
    private clearDailyNoteView(leafId: string, filePath: string) {
        if (this.activeViews.has(leafId)) {
            this.logger.debug("Clearing daily note view on mode switch", { leafId, path: filePath });
            this.activeViews.get(leafId)?.clear();
            this.activeViews.delete(leafId);
        }
    }
    
    refreshActiveViews() {
        this.logger.debug("Refreshing all active views", { 
            viewCount: this.activeViews.size 
        });
        
        const allMarkdownViews = this.getAllMarkdownViews();
            
        allMarkdownViews.forEach(view => {
            if (view.file) {
                this.logger.debug("Refreshing view", { path: view.file.path });
                this.initializeView(view.file, view);
            }
        });
    }
}
