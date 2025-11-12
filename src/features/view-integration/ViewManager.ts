import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IViewManager, ViewState, ViewStatistics, ViewLifecycleEvent } from './types';

// Interface to extend WorkspaceLeaf with the id property
interface WorkspaceLeafWithID extends WorkspaceLeaf {
    id: string;
}

/**
 * View Manager for View Integration Slice
 * 
 * Handles view lifecycle and management for the vertical slice architecture.
 */
export class ViewManager implements IViewManager {
    private app: App;
    private logger: Logger;
    private activeViews: Map<string, ViewState> = new Map();
    private pendingInitializations: Map<string, NodeJS.Timeout> = new Map();
    private statistics: ViewStatistics;
    private eventListeners: Map<string, Function[]> = new Map();

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('ViewManager');
        
        this.statistics = {
            totalViewsInitialized: 0,
            totalViewsCleanup: 0,
            totalModeSwitches: 0,
            totalFocusChanges: 0,
            totalLeafActivations: 0,
            totalViewRefreshes: 0,
            totalDOMAttachments: 0,
            totalDOMDetachments: 0,
            totalOrphanedCleanups: 0,
            averageViewLifetime: 0,
            activeViewCount: 0
        };
        
        this.logger.debug('ViewManager initialized');
    }

    /**
     * Initialize view for a file
     */
    async initializeView(file: TFile, view: MarkdownView): Promise<void> {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Initializing view', { leafId, filePath: file.path });
        
        try {
            // Clear any pending initialization for this leaf
            if (this.pendingInitializations.has(leafId)) {
                clearTimeout(this.pendingInitializations.get(leafId)!);
                this.pendingInitializations.delete(leafId);
            }
            
            // Debounce initialization to prevent rapid successive calls
            this.pendingInitializations.set(leafId, setTimeout(async () => {
                this.pendingInitializations.delete(leafId);
                await this.doInitializeView(file, view);
            }, 50)); // 50ms debounce
            
        } catch (error) {
            this.logger.error('Failed to initialize view', { leafId, filePath: file.path, error });
            throw error;
        }
    }

    /**
     * Cleanup view
     */
    cleanupView(leafId: string): void {
        this.logger.debug('Cleaning up view', { leafId });
        
        try {
            const viewState = this.activeViews.get(leafId);
            if (viewState) {
                // Clear any pending initialization
                if (this.pendingInitializations.has(leafId)) {
                    clearTimeout(this.pendingInitializations.get(leafId)!);
                    this.pendingInitializations.delete(leafId);
                }
                
                // Calculate view lifetime
                const lifetime = Date.now() - viewState.lastActivity.getTime();
                this.updateAverageViewLifetime(lifetime);
                
                // Remove from active views
                this.activeViews.delete(leafId);
                
                // Update statistics
                this.statistics.totalViewsCleanup++;
                this.statistics.activeViewCount = this.activeViews.size;
                this.statistics.lastViewCleanup = new Date();
                
                // Emit event
                this.emitEvent({
                    type: 'cleanup',
                    viewId: leafId,
                    filePath: viewState.filePath,
                    timestamp: new Date()
                });
                
                this.logger.debug('View cleaned up successfully', { leafId });
            }
        } catch (error) {
            this.logger.error('Failed to cleanup view', { leafId, error });
        }
    }

    /**
     * Get all active views
     */
    getActiveViews(): Map<string, MarkdownView> {
        const views = new Map<string, MarkdownView>();
        
        for (const [leafId, viewState] of this.activeViews.entries()) {
            if (viewState.isActive) {
                const view = this.getViewByLeafId(leafId);
                if (view) {
                    views.set(leafId, view);
                }
            }
        }
        
        return views;
    }

    /**
     * Get view by leaf ID
     */
    getViewByLeafId(leafId: string): MarkdownView | null {
        try {
            const viewState = this.activeViews.get(leafId);
            if (viewState) {
                // Find the actual view from the workspace
                const allViews = this.app.workspace.getLeavesOfType('markdown');
                for (const leaf of allViews) {
                    if ((leaf as WorkspaceLeafWithID).id === leafId) {
                        return leaf.view as MarkdownView;
                    }
                }
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to get view by leaf ID', { leafId, error });
            return null;
        }
    }

    /**
     * Check if view is active
     */
    isViewActive(leafId: string): boolean {
        const viewState = this.activeViews.get(leafId);
        return viewState ? viewState.isActive : false;
    }

    /**
     * Update view state
     */
    updateViewState(leafId: string, updates: Partial<ViewState>): void {
        const viewState = this.activeViews.get(leafId);
        if (viewState) {
            Object.assign(viewState, updates);
            viewState.lastActivity = new Date();
        }
    }

    /**
     * Get view state
     */
    getViewState(leafId: string): ViewState | null {
        return this.activeViews.get(leafId) || null;
    }

    /**
     * Get all view states
     */
    getAllViewStates(): Map<string, ViewState> {
        return new Map(this.activeViews);
    }

    /**
     * Get statistics
     */
    getStatistics(): ViewStatistics {
        return { ...this.statistics };
    }

    /**
     * Add event listener
     */
    addEventListener(eventType: string, listener: Function): void {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.push(listener);
        this.eventListeners.set(eventType, listeners);
    }

    /**
     * Remove event listener
     */
    removeEventListener(eventType: string, listener: Function): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
                this.eventListeners.set(eventType, listeners);
            }
        }
    }

    /**
     * Actually initialize the view
     */
    private async doInitializeView(file: TFile, view: MarkdownView): Promise<void> {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Actually initializing view', { leafId, filePath: file.path });
        
        try {
            // Create view state
            const viewState: ViewState = {
                leafId,
                filePath: file.path,
                isActive: true,
                isFocused: false,
                isAttached: false,
                mode: view.getMode() as 'edit' | 'preview',
                lastActivity: new Date(),
                container: null,
                hasContent: false
            };
            
            // Store view state
            this.activeViews.set(leafId, viewState);
            
            // Update statistics
            this.statistics.totalViewsInitialized++;
            this.statistics.activeViewCount = this.activeViews.size;
            this.statistics.lastViewInitialization = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'initialize',
                viewId: leafId,
                filePath: file.path,
                timestamp: new Date()
            });
            
            this.logger.debug('View initialized successfully', { leafId, filePath: file.path });
        } catch (error) {
            this.logger.error('Failed to actually initialize view', { leafId, filePath: file.path, error });
            throw error;
        }
    }

    /**
     * Update average view lifetime
     */
    private updateAverageViewLifetime(lifetime: number): void {
        const totalViews = this.statistics.totalViewsInitialized;
        if (totalViews > 0) {
            this.statistics.averageViewLifetime = 
                (this.statistics.averageViewLifetime * (totalViews - 1) + lifetime) / totalViews;
        }
    }

    /**
     * Emit event
     */
    private emitEvent(event: ViewLifecycleEvent): void {
        this.logger.debug('Emitting event', { event });
        
        try {
            const listeners = this.eventListeners.get(event.type) || [];
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    this.logger.error('Event listener failed', { event, error });
                }
            }
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Cleanup all views
     */
    cleanupAllViews(): void {
        this.logger.debug('Cleaning up all views', { viewCount: this.activeViews.size });
        
        try {
            // Clear all pending initializations
            for (const timeout of this.pendingInitializations.values()) {
                clearTimeout(timeout);
            }
            this.pendingInitializations.clear();
            
            // Cleanup all active views
            for (const [leafId] of this.activeViews.entries()) {
                this.cleanupView(leafId);
            }
            
            this.logger.debug('All views cleaned up successfully');
        } catch (error) {
            this.logger.error('Failed to cleanup all views', { error });
        }
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalViewsInitialized: 0,
            totalViewsCleanup: 0,
            totalModeSwitches: 0,
            totalFocusChanges: 0,
            totalLeafActivations: 0,
            totalViewRefreshes: 0,
            totalDOMAttachments: 0,
            totalDOMDetachments: 0,
            totalOrphanedCleanups: 0,
            averageViewLifetime: 0,
            activeViewCount: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this view manager
     */
    cleanup(): void {
        this.logger.debug('Cleaning up ViewManager');
        
        try {
            // Cleanup all views
            this.cleanupAllViews();
            
            // Clear event listeners
            this.eventListeners.clear();
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('ViewManager cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup ViewManager', { error });
        }
    }
}