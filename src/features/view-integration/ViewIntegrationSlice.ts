import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { IViewIntegrationSlice } from '../shared-contracts/slice-interfaces';
import { IPluginSlice, SliceDependencies } from '../../orchestrator/types';
import { ViewManager } from './ViewManager';
import { DOMAttachmentService } from './DOMAttachmentService';
import { ViewLifecycleHandler } from './ViewLifecycleHandler';
import { Logger } from '../shared-utilities/Logger';
import { PerformanceMonitor } from '../shared-utilities/PerformanceMonitor';
import { ViewIntegrationOptions, ViewStatistics, ViewEventData } from './types';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';

// Interface to extend WorkspaceLeaf with the id property
interface WorkspaceLeafWithID extends WorkspaceLeaf {
    id: string;
}

/**
 * View Integration Slice Implementation
 * 
 * This slice handles view lifecycle, DOM attachment, and mode switching
 * for the vertical slice architecture.
 */
export class ViewIntegrationSlice implements IPluginSlice, IViewIntegrationSlice {
    private app: App;
    private logger: Logger;
    private viewManager: ViewManager;
    private domAttachmentService: DOMAttachmentService;
    private viewLifecycleHandler: ViewLifecycleHandler;
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private options: ViewIntegrationOptions;
    private statistics: ViewStatistics;
    private performanceMonitor: PerformanceMonitor;

    constructor(app: App, options?: Partial<ViewIntegrationOptions>) {
        this.app = app;
        this.logger = new Logger('ViewIntegrationSlice');

        // Set default options
        this.options = {
            debounceDelay: 50,
            maxFocusAttempts: 10,
            focusRetryDelay: 50,
            enableStyleMonitoring: true,
            enableAutoRefresh: true,
            enableFocusManagement: true,
            ...options
        };

        // Components will be initialized in initialize()
    }

    /**
     * Initialize the slice
     */
    async initialize(dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing ViewIntegrationSlice');

        // Initialize components
        this.viewManager = new ViewManager(this.app, this.logger);
        this.domAttachmentService = new DOMAttachmentService(this.logger);
        this.viewLifecycleHandler = new ViewLifecycleHandler(this.app, this.logger, {
            autoFocus: this.options.enableFocusManagement,
            focusDelay: 50,
            maxAttempts: this.options.maxFocusAttempts,
            retryDelay: this.options.focusRetryDelay,
            enablePeriodicCheck: true,
            periodicCheckInterval: 500
        });

        // Initialize statistics
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

        // Performance monitoring, gated by global logging state
        this.performanceMonitor = new PerformanceMonitor(
            this.logger.child('Performance'),
            () => Logger.getGlobalLogging().enabled
        );

        this.logger.debug('ViewIntegrationSlice initialized');
    }

    /**
     * Start the slice
     */
    async start(): Promise<void> {
        this.logger.debug('Starting ViewIntegrationSlice');
    }

    /**
     * Stop the slice
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping ViewIntegrationSlice');
    }

    /**
     * Initialize view for a file
     */
    async initializeView(file: TFile, view: MarkdownView): Promise<void> {
        return this.performanceMonitor.measureAsync(
            'view.initialize',
            async () => {
                this.logger.debug('Initializing view', { filePath: file.path });

                try {
                    // Initialize view using ViewManager
                    await this.viewManager.initializeView(file, view);

                    // Update statistics
                    this.statistics.totalViewsInitialized++;
                    this.statistics.activeViewCount = this.viewManager.getActiveViews().size;

                    // Emit event
                    this.emitEvent({
                        type: 'backlinks:updated',
                        payload: {
                            files: [file.path],
                            leafId: (view.leaf as WorkspaceLeafWithID).id,
                            count: 1
                        }
                    });

                    this.logger.debug('View initialized successfully', { filePath: file.path });
                } catch (error) {
                    this.logger.error('Failed to initialize view', { filePath: file.path, error });
                    throw error;
                }
            },
            { filePath: file.path }
        );
    }

    /**
     * Cleanup view
     */
    cleanupView(leafId: string): void {
        this.logger.debug('Cleaning up view', { leafId });

        try {
            // Cleanup view using ViewManager
            this.viewManager.cleanupView(leafId);

            // Update statistics
            this.statistics.totalViewsCleanup++;
            this.statistics.activeViewCount = this.viewManager.getActiveViews().size;


            this.logger.debug('View cleaned up successfully', { leafId });
        } catch (error) {
            this.logger.error('Failed to cleanup view', { leafId, error });
        }
    }

    /**
     * Handle mode switch
     */
    async handleModeSwitch(file: TFile, view: MarkdownView): Promise<void> {
        this.logger.debug('Handling mode switch', { filePath: file.path });

        try {
            // Handle mode switch using ViewLifecycleHandler
            await this.viewLifecycleHandler.handleModeSwitch(file, view);

            // Update statistics
            this.statistics.totalModeSwitches++;


            this.logger.debug('Mode switch handled successfully', { filePath: file.path });
        } catch (error) {
            this.logger.error('Failed to handle mode switch', { filePath: file.path, error });
        }
    }

    /**
     * Handle focus change
     */
    handleFocusChange(view: MarkdownView, focused: boolean): void {
        this.logger.debug('Handling focus change', {
            filePath: view.file?.path,
            focused
        });

        try {
            // Handle focus change using ViewLifecycleHandler
            this.viewLifecycleHandler.handleFocusChange(view, focused);

            // Update statistics
            this.statistics.totalFocusChanges++;


            this.logger.debug('Focus change handled successfully', {
                filePath: view.file?.path,
                focused
            });
        } catch (error) {
            this.logger.error('Failed to handle focus change', {
                filePath: view.file?.path,
                error
            });
        }
    }

    /**
     * Handle leaf activation
     */
    handleLeafActivation(leaf: WorkspaceLeaf): void {
        this.logger.debug('Handling leaf activation');

        try {
            // Handle leaf activation using ViewLifecycleHandler
            this.viewLifecycleHandler.handleLeafActivation(leaf);

            // Update statistics
            this.statistics.totalLeafActivations++;


            this.logger.debug('Leaf activation handled successfully');
        } catch (error) {
            this.logger.error('Failed to handle leaf activation', { error });
        }
    }

    /**
     * Handle view refresh
     */
    async handleViewRefresh(view: MarkdownView): Promise<void> {
        return this.performanceMonitor.measureAsync(
            'view.refresh',
            async () => {
                this.logger.debug('Handling view refresh', {
                    filePath: view.file?.path
                });

                try {
                    // Handle view refresh using ViewLifecycleHandler
                    await this.viewLifecycleHandler.handleViewRefresh(view);

                    // Update statistics
                    this.statistics.totalViewRefreshes++;

                    this.logger.debug('View refresh handled successfully', {
                        filePath: view.file?.path
                    });
                } catch (error) {
                    this.logger.error('Failed to handle view refresh', {
                        filePath: view.file?.path,
                        error
                    });
                }
            },
            { filePath: view.file?.path ?? null }
        );
    }

    /**
     * Attach container to view
     */
    attachToView(view: MarkdownView, container: HTMLElement): boolean {
        this.logger.debug('Attaching container to view', {
            filePath: view.file?.path
        });

        try {
            // Attach container using DOMAttachmentService
            const success = this.domAttachmentService.attachToView(view, container);

            if (success) {
                // Update statistics
                this.statistics.totalDOMAttachments++;


                this.logger.debug('Container attached successfully', {
                    filePath: view.file?.path
                });
            }

            return success;
        } catch (error) {
            this.logger.error('Failed to attach container to view', {
                filePath: view.file?.path,
                error
            });
            return false;
        }
    }

    /**
     * Detach container from view
     */
    detachFromView(view: MarkdownView, container: HTMLElement): boolean {
        this.logger.debug('Detaching container from view', {
            filePath: view.file?.path
        });

        try {
            // Detach container using DOMAttachmentService
            const success = this.domAttachmentService.detachFromView(view, container);

            if (success) {
                // Update statistics
                this.statistics.totalDOMDetachments++;


                this.logger.debug('Container detached successfully', {
                    filePath: view.file?.path
                });
            }

            return success;
        } catch (error) {
            this.logger.error('Failed to detach container from view', {
                filePath: view.file?.path,
                error
            });
            return false;
        }
    }

    /**
     * Get all active views
     */
    getActiveViews(): Map<string, MarkdownView> {
        return this.viewManager.getActiveViews();
    }

    /**
     * Get view by leaf ID
     */
    getViewByLeafId(leafId: string): MarkdownView | null {
        return this.viewManager.getViewByLeafId(leafId);
    }

    /**
     * Check if view is active
     */
    isViewActive(leafId: string): boolean {
        return this.viewManager.isViewActive(leafId);
    }

    /**
     * Get statistics
     */
    getStatistics(): ViewStatistics {
        return { ...this.statistics };
    }

    /**
     * Get view manager
     */
    getViewManager(): ViewManager {
        return this.viewManager;
    }

    /**
     * Get DOM attachment service
     */
    getDOMAttachmentService(): DOMAttachmentService {
        return this.domAttachmentService;
    }

    /**
     * Get view lifecycle handler
     */
    getViewLifecycleHandler(): ViewLifecycleHandler {
        return this.viewLifecycleHandler;
    }

    /**
     * Request focus when ready
     */
    requestFocusWhenReady(leafId: string): void {
        this.logger.debug('Requesting focus when ready', { leafId });

        try {
            // Get view by leaf ID
            const view = this.getViewByLeafId(leafId);
            if (view) {
                // Request focus using ViewLifecycleHandler
                this.viewLifecycleHandler.requestFocusWhenReady(view);

                this.logger.debug('Focus requested successfully', { leafId });
            } else {
                this.logger.warn('View not found for leaf ID', { leafId });
            }
        } catch (error) {
            this.logger.error('Failed to request focus when ready', { leafId, error });
        }
    }

    /**
     * Check if view is ready for focus
     */
    isViewReadyForFocus(leafId: string): boolean {
        this.logger.debug('Checking if view is ready for focus', { leafId });

        try {
            // Get view by leaf ID
            const view = this.getViewByLeafId(leafId);
            if (view) {
                // Check if view is in preview mode and focused
                const isPreviewMode = view.getMode() === 'preview';
                const isFocused = this.app.workspace.activeLeaf === view.leaf;

                const isReady = isPreviewMode && isFocused;

                this.logger.debug('View readiness check', {
                    leafId,
                    filePath: view.file?.path,
                    isPreviewMode,
                    isFocused,
                    isReady
                });

                return isReady;
            } else {
                this.logger.warn('View not found for leaf ID', { leafId });
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to check view readiness', { leafId, error });
            return false;
        }
    }

    /**
     * Get view statistics
     */
    getViewStatistics(): any {
        return {
            ...this.statistics,
            viewManagerStats: this.viewManager.getStatistics(),
            domAttachmentStats: this.domAttachmentService.getStatistics(),
            lifecycleHandlerStats: this.viewLifecycleHandler.getStatistics()
        };
    }

    /**
     * Emit an event
     */
    private emitEvent(event: CoalesceEvent): void {
        this.logger.debug('Emitting event', { event });

        try {
            const handlers = this.eventHandlers.get(event.type) || [];

            for (const handler of handlers) {
                try {
                    handler(event);
                } catch (error) {
                    this.logger.error('Event handler failed', { event, error });
                }
            }

            this.logger.debug('Event emitted successfully', { event });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Add event listener
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Adding event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            handlers.push(handler as EventHandler);
            this.eventHandlers.set(eventType, handlers);

            this.logger.debug('Event listener added successfully', { eventType });
        } catch (error) {
            this.logger.error('Failed to add event listener', { eventType, error });
        }
    }

    /**
     * Remove event listener
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Removing event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);

            if (index !== -1) {
                handlers.splice(index, 1);
                this.eventHandlers.set(eventType, handlers);

                this.logger.debug('Event listener removed successfully', { eventType });
            } else {
                this.logger.debug('Event listener not found', { eventType });
            }
        } catch (error) {
            this.logger.error('Failed to remove event listener', { eventType, error });
        }
    }

    /**
     * Cleanup resources used by this slice
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up ViewIntegrationSlice');

        try {
            // Cleanup components
            this.viewManager.cleanup();
            this.domAttachmentService.cleanup();
            this.viewLifecycleHandler.cleanup();

            // Clear data
            this.eventHandlers.clear();

            // Reset statistics
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

            this.logger.debug('ViewIntegrationSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup ViewIntegrationSlice', { error });
        }
    }
}

// Export the interface for external use
export type { IViewIntegrationSlice } from '../shared-contracts/slice-interfaces';
