import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView } from './views/CoalesceView';
import { Logger } from './utils/Logger';
import { SettingsManager } from './SettingsManager';
import { AbstractBlockFinder } from './block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from './block-finders/BlockFinderFactory';
import { DailyNote } from './utils/DailyNote';

/**
 * Manages the lifecycle of views
 * Handles file open/close events
 * Coordinates multiple views for different markdown files
 * Maintains the active views map
 */

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

        // Get all markdown views
        const allMarkdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file); // Only get views with files

        // Keep track of current views that should remain
        const viewsToKeep = new Set<string>();

        // For each markdown view, initialize or update its coalesce view
        allMarkdownViews.forEach(view => {
            const leafId = (view.leaf as any).id;
            const viewFile = view.file;
            
            if (!viewFile) return;

            viewsToKeep.add(leafId);

            // If this view doesn't exist yet, create it
            if (!this.activeViews.has(leafId)) {
                this.logger.debug("Initializing new view", { leafId, path: viewFile.path });
                this.initializeView(viewFile, view);
            } else {
                // Just ensure it's properly attached to DOM
                const existingView = this.activeViews.get(leafId);
                if (existingView) {
                    this.logger.debug("Re-attaching existing view", { leafId, path: viewFile.path });
                    existingView.ensureAttached();
                }
            }
        });

        // Only remove views that are no longer in any visible pane
        for (const [leafId, view] of this.activeViews.entries()) {
            if (!viewsToKeep.has(leafId)) {
                this.logger.debug("Cleaning up unused view", { leafId });
                view.cleanup(); // First cleanup resources
                view.clear();   // Then clear DOM elements
                this.activeViews.delete(leafId);
            }
        }
    }

    private initializeView(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as any).id;
        
        // Clear existing view for this leaf if it exists
        const existingView = this.activeViews.get(leafId);
        if (existingView) {
            this.logger.debug("Clearing existing view", { leafId, path: file.path });
            existingView.clear();
        }
        
        // Check if we should skip creating a view for daily notes
        if (this.settingsManager.settings.onlyDailyNotes && 
            DailyNote.isDaily(this.app, file.path)) {
            this.logger.debug("Skipping Coalesce view creation", {
                reason: "Hide in Daily Notes enabled",
                path: file.path
            });
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

        // Ensure proper cleanup of each view
        for (const view of this.activeViews.values()) {
            view.cleanup(); // First call cleanup to release resources
            view.clear();   // Then clear the DOM elements
        }
        this.activeViews.clear();
    }

    // Add method to handle edit/view mode switches
    handleModeSwitch(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as any).id;
        
        this.logger.debug("Handling mode switch", {
            leafId,
            path: file.path,
            hasExistingView: this.activeViews.has(leafId)
        });
        
        // Skip mode switching for daily notes if the Hide in Daily Notes setting is enabled
        if (this.settingsManager.settings.onlyDailyNotes && 
            DailyNote.isDaily(this.app, file.path)) {
            // If there's an existing view for this daily note, clear it
            if (this.activeViews.has(leafId)) {
                this.logger.debug("Clearing daily note view on mode switch", { leafId, path: file.path });
                this.activeViews.get(leafId)?.clear();
                this.activeViews.delete(leafId);
            }
            return;
        }
        
        if (this.activeViews.has(leafId)) {
            this.initializeView(file, view);
        }
    }
    
    // Add method to refresh all active views when settings change
    refreshActiveViews() {
        this.logger.debug("Refreshing all active views", { 
            viewCount: this.activeViews.size 
        });
        
        // Get all markdown views
        const allMarkdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view as MarkdownView)
            .filter(view => view?.file); // Only get views with files
            
        // Reinitialize all views with current files
        allMarkdownViews.forEach(view => {
            if (view.file) {
                this.logger.debug("Refreshing view", { path: view.file.path });
                this.initializeView(view.file, view);
            }
        });
    }
}
