import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { CoalesceView } from './views/CoalesceView';
import { Logger } from './utils/Logger';
import { SettingsManager } from './SettingsManager';
import { AbstractBlockFinder } from './block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from './block-finders/BlockFinderFactory';
import { DailyNote } from './utils/DailyNote';
import { AppWithInternalPlugins } from './types';

// Interface to extend WorkspaceLeaf with the id property
interface WorkspaceLeafWithID extends WorkspaceLeaf {
    id: string;
}

/** Manages view lifecycle, handles file events, and coordinates backlinks across multiple views */
export class CoalesceManager {
    private activeViews: Map<string, CoalesceView> = new Map();
    private pendingInitializations: Map<string, NodeJS.Timeout> = new Map();

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
        
        // Check if we should auto-focus the filter input for the active view
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file?.path === file.path) {
            this.checkAndFocusFilterInput(activeView);
            
            // Mark the active view as focused if it's the current file
            const leafId = (activeView.leaf as WorkspaceLeafWithID).id;
            const coalesceView = this.activeViews.get(leafId);
            if (coalesceView) {
                this.logger.debug("Marking view as focused due to file open", { leafId, path: file.path });
                coalesceView.markAsFocused();
            }
        }
        
        // Also check after a delay in case the active view changes
        setTimeout(() => {
            const delayedActiveView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (delayedActiveView && delayedActiveView.file?.path === file.path) {
                const leafId = (delayedActiveView.leaf as WorkspaceLeafWithID).id;
                const coalesceView = this.activeViews.get(leafId);
                if (coalesceView) {
                    this.logger.debug("Delayed focus marking for file open", { leafId, path: file.path });
                    coalesceView.markAsFocused();
                }
            }
        }, 100);
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
                    // Use smart refresh logic instead of always re-attaching
                    if (this.needsViewRefresh(existingView, viewFile, view)) {
                        this.logger.debug("Re-initializing view due to meaningful changes", { leafId, path: viewFile.path });
                        this.initializeView(viewFile, view);
                    } else {
                        this.logger.debug("Re-attaching existing view, no refresh needed", { leafId, path: viewFile.path });
                        existingView.ensureAttached();
                        // Still need to update backlinks even when preserving the view
                        this.updateBacklinksForView(viewFile, existingView, leafId);
                    }
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
        
        // Clear any pending initialization for this leaf to prevent duplicates
        if (this.pendingInitializations.has(leafId)) {
            clearTimeout(this.pendingInitializations.get(leafId)!);
            this.pendingInitializations.delete(leafId);
        }
        
        // Debounce initialization to prevent rapid successive calls on mobile
        this.pendingInitializations.set(leafId, setTimeout(() => {
            this.pendingInitializations.delete(leafId);
            this.doInitializeView(file, view);
        }, 50)); // 50ms debounce
    }
    
    private doInitializeView(file: TFile, view: MarkdownView) {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug("Initializing view", { leafId, path: file.path });
        
        // Before creating a new view, clean up any orphaned Coalesce containers in this view
        const existingContainers = view.containerEl.querySelectorAll('.custom-backlinks-container');
        if (existingContainers.length > 0) {
            this.logger.debug("Found orphaned Coalesce containers, cleaning up", { 
                count: existingContainers.length,
                leafId,
                path: file.path
            });
            existingContainers.forEach(container => container.remove());
        }
        
        const existingView = this.activeViews.get(leafId);
        if (existingView) {
            this.logger.debug("Clearing existing view", { leafId, path: file.path });
            existingView.clear();
        }
        
        if (this.shouldSkipDailyNote(file.path)) {
            this.logger.debug("Skipping daily note", { path: file.path });
            return;
        }
        
        const currentNoteName = file.basename;
        this.logger.debug("Creating new coalesce view", { leafId, currentNoteName });
        
        const coalesceView = new CoalesceView(
            view, 
            currentNoteName, 
            this.settingsManager,
            this.logger
        );

        this.activeViews.set(leafId, coalesceView);
        this.logger.debug("Coalesce view created and stored", { 
            leafId, 
            activeViewsCount: this.activeViews.size 
        });
        
        this.updateBacklinksForView(file, coalesceView, leafId);
    }
    
    private shouldSkipDailyNote(filePath: string): boolean {
        const shouldSkip = this.settingsManager.settings.onlyDailyNotes && 
                         DailyNote.isDaily(this.app as AppWithInternalPlugins, filePath);
                         
        if (shouldSkip) {
            this.logger.debug("Skipping Coalesce view creation", {
                reason: "Hide in Daily Notes enabled",
                path: filePath
            });
        }
        
        return shouldSkip;
    }
    
    private updateBacklinksForView(file: TFile, coalesceView: CoalesceView, leafId: string) {
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
        
        // Check resolved links
        const resolvedBacklinks = Object.entries(resolvedLinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);
            
        // Check unresolved links (might be linking by name)
        const unresolvedBacklinks = Object.entries(unresolvedLinks)
            .filter(([_, links]) => {
                const linkMap = links as Record<string, unknown>;
                return file.basename in linkMap || file.name in linkMap || file.path in linkMap;
            })
            .map(([sourcePath]) => sourcePath);
            
        const filesLinkingToThis = [...new Set([...resolvedBacklinks, ...unresolvedBacklinks])];

        this.logger.debug("Checking backlinks for view", {
            leafId,
            path: file.path,
            backlinksCount: filesLinkingToThis.length,
            files: filesLinkingToThis
        });

        // Only update if backlinks have actually changed OR if view has no content yet
        const needsUpdate = coalesceView.areBacklinksDifferent(filesLinkingToThis) || !coalesceView.hasActiveContent();
        
        if (needsUpdate) {
            const reason = coalesceView.areBacklinksDifferent(filesLinkingToThis) ? "backlinks changed" : "no active content";
            this.logger.debug(`Updating view: ${reason}`, {
                leafId,
                path: file.path,
                newCount: filesLinkingToThis.length,
                hasActiveContent: coalesceView.hasActiveContent()
            });
            
            coalesceView.updateBacklinks(filesLinkingToThis, (path: string, openInNewTab: boolean = false) => {
                this.app.workspace.openLinkText(path, '', openInNewTab);
            });
        } else {
            this.logger.debug("Backlinks unchanged and view has content, skipping update", {
                leafId,
                path: file.path,
                count: filesLinkingToThis.length,
                hasActiveContent: coalesceView.hasActiveContent()
            });
        }
    }

    private getBlockFinder(strategy: string): AbstractBlockFinder {
        return BlockFinderFactory.createBlockFinder(strategy, this.logger);
    }

    clearBacklinks() {
        this.logger.debug("Clearing all backlinks", { 
            activeViewsCount: this.activeViews.size 
        });
        
        // Clear any pending initializations
        for (const timeout of this.pendingInitializations.values()) {
            clearTimeout(timeout);
        }
        this.pendingInitializations.clear();
        
        for (const [leafId, view] of this.activeViews.entries()) {
            this.logger.debug("Clearing view", { leafId });
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
        
        const existingView = this.activeViews.get(leafId);
        
        // Smart refresh logic: only reinitialize if there's a meaningful change
        if (!existingView) {
            // No existing view, need to initialize
            this.logger.debug("No existing view found, initializing new view", { leafId });
            this.initializeView(file, view);
        } else if (this.needsViewRefresh(existingView, file, view)) {
            // View needs refresh due to meaningful changes
            this.logger.debug("View needs refresh due to meaningful changes", { leafId });
            this.initializeView(file, view);
        } else {
            // Just ensure the view is attached and handle focus
            this.logger.debug("Ensuring existing view is attached, no refresh needed", { leafId });
            existingView.ensureAttached();
            // Still need to update backlinks even when preserving the view
            this.updateBacklinksForView(file, existingView, leafId);
        }
        
        // Use requestAnimationFrame to ensure DOM is ready before checking focus
        requestAnimationFrame(() => {
            this.checkAndFocusFilterInput(view);
            
            // If this is the active view being switched to, mark it as focused
            if (this.app.workspace.activeLeaf === view.leaf) {
                const coalesceView = this.activeViews.get(leafId);
                if (coalesceView) {
                    this.logger.debug("Marking view as focused due to active leaf", { leafId });
                    coalesceView.markAsFocused();
                }
            }
        });
        
        // Additional check after a brief delay to catch cases where the leaf becomes active
        setTimeout(() => {
            if (this.app.workspace.activeLeaf === view.leaf) {
                const coalesceView = this.activeViews.get(leafId);
                if (coalesceView) {
                    this.logger.debug("Delayed focus marking for active leaf", { leafId });
                    coalesceView.markAsFocused();
                }
            }
        }, 100);
    }

    /**
     * Determines if a view needs to be refreshed based on meaningful changes
     */
    private needsViewRefresh(existingView: CoalesceView, file: TFile, view: MarkdownView): boolean {
        // Check if the view mode changed from edit to preview or vice versa
        const currentMode = view.getMode();
        const wasInPreviewMode = existingView.getView().getMode() === 'preview';
        const isNowInPreviewMode = currentMode === 'preview';
        
        // Check if the file changed
        const existingFile = existingView.getView().file;
        if (!existingFile || existingFile.path !== file.path) {
            this.logger.debug("File changed, refresh needed", {
                previousFile: existingFile?.path,
                currentFile: file.path
            });
            return true;
        }
        
        // Both in preview mode, same file - check if we need refresh based on content state
        if (wasInPreviewMode && isNowInPreviewMode) {
            // If view has active content, preserve it; if not, refresh it
            const hasActiveContent = existingView.hasActiveContent();
            
            if (hasActiveContent) {
                this.logger.debug("Same file, preview mode, with active content - preserving view", {
                    path: file.path,
                    mode: currentMode,
                    hasActiveContent: true
                });
                return false; // Don't refresh, but backlinks will still be updated in calling code
            } else {
                this.logger.debug("Same file, preview mode, but no active content - refreshing", {
                    path: file.path,
                    mode: currentMode,
                    hasActiveContent: false
                });
                return true; // Refresh to load content
            }
        }
        
        // Check if switching from edit to preview (should show CoalesceView)
        if (!wasInPreviewMode && isNowInPreviewMode) {
            this.logger.debug("Switching from edit to preview mode, refresh needed", {
                path: file.path,
                previousMode: existingView.getView().getMode(),
                currentMode: currentMode
            });
            return true;
        }
        
        // No meaningful change detected
        this.logger.debug("No meaningful change detected, no refresh needed", {
            path: file.path,
            mode: currentMode,
            hasActiveContent: existingView.hasActiveContent()
        });
        return false;
    }

    /**
     * Checks if the view is in preview mode and focused, then focuses the filter input
     */
    private checkAndFocusFilterInput(view: MarkdownView): void {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        const coalesceView = this.activeViews.get(leafId);
        
        if (!coalesceView) {
            this.logger.debug("No coalesce view found for leaf", { leafId });
            return;
        }
        
        // Check if the view is in preview mode and focused
        const isPreviewMode = view.getMode() === 'preview';
        const isFocused = this.app.workspace.activeLeaf === view.leaf;
        
        if (isPreviewMode && isFocused) {
            this.logger.debug("Requesting focus for filter input", { leafId });
            setTimeout(() => {
                coalesceView.requestFocusWhenReady();
            }, 50);
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

    /**
     * Manually trigger focus for testing purposes
     */
    public testFocusFilterInput(): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file) {
            this.logger.debug("Manual focus test triggered", { path: activeView.file.path });
            this.checkAndFocusFilterInput(activeView);
        }
    }

    /**
     * Force focus check regardless of conditions
     */
    public forceFocusCheck(): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file) {
            const leafId = (activeView.leaf as WorkspaceLeafWithID).id;
            const coalesceView = this.activeViews.get(leafId);
            
            if (coalesceView) {
                coalesceView.requestFocusWhenReady();
            }
        }
    }
}
