import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IViewLifecycleHandler, ViewLifecycleEvent, FocusManagementOptions } from './types';

// Interface to extend WorkspaceLeaf with the id property
interface WorkspaceLeafWithID extends WorkspaceLeaf {
    id: string;
}

/**
 * View Lifecycle Handler for View Integration Slice
 * 
 * Handles view lifecycle events and focus management for the vertical slice architecture.
 */
export class ViewLifecycleHandler implements IViewLifecycleHandler {
    private app: App;
    private logger: Logger;
    private focusTimeout: NodeJS.Timeout | null = null;
    private focusAttempts: number = 0;
    private maxFocusAttempts: number;
    private focusRetryDelay: number;
    private statistics: {
        totalModeSwitches: number;
        totalFocusChanges: number;
        totalLeafActivations: number;
        totalViewRefreshes: number;
        lastModeSwitch?: Date;
        lastFocusChange?: Date;
        lastLeafActivation?: Date;
        lastViewRefresh?: Date;
    };
    private eventListeners: Map<string, Function[]> = new Map();
    private focusManagementOptions: FocusManagementOptions;

    constructor(app: App, logger: Logger, options: FocusManagementOptions) {
        this.app = app;
        this.logger = logger.child('ViewLifecycleHandler');
        this.focusManagementOptions = options;
        
        this.maxFocusAttempts = options.maxAttempts || 10;
        this.focusRetryDelay = options.retryDelay || 50;
        
        this.statistics = {
            totalModeSwitches: 0,
            totalFocusChanges: 0,
            totalLeafActivations: 0,
            totalViewRefreshes: 0
        };
        
        this.logger.debug('ViewLifecycleHandler initialized');
    }

    /**
     * Handle mode switch
     */
    async handleModeSwitch(file: TFile, view: MarkdownView): Promise<void> {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Handling mode switch', {
            leafId,
            filePath: file.path,
            currentMode: view.getMode()
        });
        
        try {
            // Update statistics
            this.statistics.totalModeSwitches++;
            this.statistics.lastModeSwitch = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'modeSwitch',
                viewId: leafId,
                filePath: file.path,
                timestamp: new Date(),
                data: {
                    newMode: view.getMode(),
                    previousMode: 'unknown' // We don't track this yet
                }
            });
            
            this.logger.debug('Mode switch handled successfully', {
                leafId,
                newMode: view.getMode()
            });
        } catch (error) {
            this.logger.error('Failed to handle mode switch', {
                leafId,
                filePath: file.path,
                error
            });
        }
    }

    /**
     * Handle focus change
     */
    handleFocusChange(view: MarkdownView, focused: boolean): void {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Handling focus change', {
            leafId,
            filePath: view.file?.path,
            focused
        });
        
        try {
            // Update statistics
            this.statistics.totalFocusChanges++;
            this.statistics.lastFocusChange = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'focusChange',
                viewId: leafId,
                filePath: view.file?.path || '',
                timestamp: new Date(),
                data: {
                    focused
                }
            });
            
            this.logger.debug('Focus change handled successfully', {
                leafId,
                focused
            });
        } catch (error) {
            this.logger.error('Failed to handle focus change', {
                leafId,
                filePath: view.file?.path,
                error
            });
        }
    }

    /**
     * Handle leaf activation
     */
    handleLeafActivation(leaf: WorkspaceLeaf): void {
        const leafId = (leaf as WorkspaceLeafWithID).id;
        const view = leaf.view as MarkdownView;
        
        this.logger.debug('Handling leaf activation', {
            leafId,
            filePath: view.file?.path
        });
        
        try {
            // Update statistics
            this.statistics.totalLeafActivations++;
            this.statistics.lastLeafActivation = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'leafActivation',
                viewId: leafId,
                filePath: view.file?.path || '',
                timestamp: new Date()
            });
            
            this.logger.debug('Leaf activation handled successfully', {
                leafId
            });
        } catch (error) {
            this.logger.error('Failed to handle leaf activation', {
                leafId,
                filePath: view.file?.path,
                error
            });
        }
    }

    /**
     * Handle view refresh
     */
    async handleViewRefresh(view: MarkdownView): Promise<void> {
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Handling view refresh', {
            leafId,
            filePath: view.file?.path
        });
        
        try {
            // Update statistics
            this.statistics.totalViewRefreshes++;
            this.statistics.lastViewRefresh = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'refresh',
                viewId: leafId,
                filePath: view.file?.path || '',
                timestamp: new Date()
            });
            
            this.logger.debug('View refresh handled successfully', {
                leafId
            });
        } catch (error) {
            this.logger.error('Failed to handle view refresh', {
                leafId,
                filePath: view.file?.path,
                error
            });
        }
    }

    /**
     * Check if view needs refresh
     */
    needsViewRefresh(view: MarkdownView, file: TFile): boolean {
        try {
            // Check if the view mode changed from edit to preview or vice versa
            const currentMode = view.getMode();
            const isPreviewMode = currentMode === 'preview';
            
            // For now, always refresh if in preview mode
            // This logic can be enhanced later
            const needsRefresh = isPreviewMode;
            
            this.logger.debug('Checking if view needs refresh', {
                leafId: (view.leaf as WorkspaceLeafWithID).id,
                filePath: file.path,
                currentMode,
                needsRefresh
            });
            
            return needsRefresh;
        } catch (error) {
            this.logger.error('Failed to check if view needs refresh', {
                leafId: (view.leaf as WorkspaceLeafWithID).id,
                filePath: file.path,
                error
            });
            return false;
        }
    }

    /**
     * Request focus when ready
     */
    requestFocusWhenReady(view: MarkdownView): void {
        this.logger.debug('Requesting focus when ready');
        
        try {
            // Clear any existing focus timeout
            if (this.focusTimeout) {
                clearTimeout(this.focusTimeout);
                this.focusTimeout = null;
            }
            
            // Reset focus attempts
            this.focusAttempts = 0;
            
            // Use requestAnimationFrame for DOM readiness
            requestAnimationFrame(() => {
                this.attemptFocusWithRetry(view);
            });
        } catch (error) {
            this.logger.error('Failed to request focus when ready', { error });
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): any {
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
     * Attempt focus with retry logic
     */
    private attemptFocusWithRetry(view: MarkdownView): void {
        this.focusAttempts++;
        
        const leafId = (view.leaf as WorkspaceLeafWithID).id;
        
        this.logger.debug('Focus attempt', { 
            attempt: this.focusAttempts,
            maxAttempts: this.maxFocusAttempts,
            leafId
        });
        
        try {
            // Check if view is ready for focus
            if (this.isViewReadyForFocus(view)) {
                // Try to focus
                const success = this.attemptFocus(view);
                
                this.logger.debug('Focus attempt result', { 
                    success, 
                    attempt: this.focusAttempts 
                });
                
                if (success) {
                    this.focusAttempts = 0;
                    return;
                }
            }
            
            // If not ready or focus failed, retry with exponential backoff
            if (this.focusAttempts < this.maxFocusAttempts) {
                const delay = Math.min(
                    this.focusRetryDelay * Math.pow(2, this.focusAttempts - 1), 
                    500
                );
                
                this.focusTimeout = setTimeout(() => {
                    this.attemptFocusWithRetry(view);
                }, delay);
            } else {
                this.logger.debug('Max focus attempts reached, giving up');
                this.focusAttempts = 0;
            }
        } catch (error) {
            this.logger.error('Failed to attempt focus with retry', { 
                leafId, 
                error 
            });
        }
    }

    /**
     * Check if view is ready for focus
     */
    private isViewReadyForFocus(view: MarkdownView): boolean {
        try {
            // Check if view is in preview mode and focused
            const isPreviewMode = view.getMode() === 'preview';
            const isFocused = this.app.workspace.activeLeaf === view.leaf;
            
            this.logger.debug('View readiness check', {
                leafId: (view.leaf as WorkspaceLeafWithID).id,
                isPreviewMode,
                isFocused
            });
            
            return isPreviewMode && isFocused;
        } catch (error) {
            this.logger.error('Failed to check view readiness', { error });
            return false;
        }
    }

    /**
     * Attempt to focus the view
     */
    private attemptFocus(view: MarkdownView): boolean {
        try {
            // For now, just emit a focus event
            // The actual focus logic will be handled by other components
            this.handleFocusChange(view, true);
            
            return true;
        } catch (error) {
            this.logger.error('Failed to attempt focus', { error });
            return false;
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
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalModeSwitches: 0,
            totalFocusChanges: 0,
            totalLeafActivations: 0,
            totalViewRefreshes: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this view lifecycle handler
     */
    cleanup(): void {
        this.logger.debug('Cleaning up ViewLifecycleHandler');
        
        try {
            // Clear focus timeout
            if (this.focusTimeout) {
                clearTimeout(this.focusTimeout);
                this.focusTimeout = null;
            }
            
            // Clear event listeners
            this.eventListeners.clear();
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('ViewLifecycleHandler cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup ViewLifecycleHandler', { error });
        }
    }
}