import { App } from 'obsidian';
import { IPluginOrchestrator, OrchestratorConfig, SliceMap, OrchestratorState, OrchestratorStatistics, EventWiringConfig, SliceDependencies, OrchestratorEvent, SliceLifecycleEvent } from './types';
import { EventBus } from './EventBus';
import { Logger } from '../features/shared-utilities/Logger';

import { SliceRegistry } from './SliceRegistry';
import { IPluginSlice, SliceFactory } from './types';

/**
 * Plugin Orchestrator Implementation
 * 
 * Coordinates all slices and provides a unified interface for the main plugin.
 * This is the composition root that wires up the vertical slice architecture.
 */
export class PluginOrchestrator implements IPluginOrchestrator {
    private app: App;
    private plugin: any;
    private config: OrchestratorConfig;
    private logger: Logger;
    private eventBus: EventBus;
    private slices: Record<string, IPluginSlice | null>;
    private sliceRegistry: SliceRegistry;
    private state: OrchestratorState;
    private statistics: OrchestratorStatistics;
    private eventWiring: EventWiringConfig[];
    private startTime: Date;

    constructor(app: App, plugin?: any, config?: Partial<OrchestratorConfig>) {
        this.app = app;
        this.plugin = plugin;

        // Set default configuration
        this.config = {
            enableLogging: true,
            enableEventDebugging: false,
            enablePerformanceMonitoring: true,
            enableErrorRecovery: true,
            maxRetries: 3,
            retryDelay: 1000,
            ...config
        };

        // Initialize logger
        this.logger = new Logger('PluginOrchestrator');

        // Initialize event bus
        this.eventBus = new EventBus(this.logger);

        // Initialize slice registry
        this.sliceRegistry = new SliceRegistry();

        // Initialize slices map
        this.slices = {};

        // Initialize state
        this.state = {
            isInitialized: false,
            isStarted: false,
            isShuttingDown: false,
            lastActivity: new Date(),
            errorCount: 0
        };

        // Initialize statistics
        this.statistics = {
            totalInitializations: 0,
            totalEventWiring: 0,
            totalEventFired: 0,
            totalEventHandled: 0,
            totalErrors: 0,
            totalRetries: 0,
            averageEventProcessingTime: 0,
            uptime: 0
        };

        // Initialize event wiring
        this.eventWiring = [];

        this.startTime = new Date();

        this.logger.debug('PluginOrchestrator initialized');
    }

    /**
     * Register a slice factory
     */
    registerSlice(name: string, factory: SliceFactory): void {
        this.sliceRegistry.register(name, factory);
    }

    /**
     * Initialize the orchestrator
     */
    async initialize(): Promise<void> {
        this.logger.debug('Initializing PluginOrchestrator');

        try {
            // Update state
            this.state.isInitialized = true;
            this.state.lastActivity = new Date();

            // Initialize slices in dependency order
            await this.initializeSlices();

            // Wire up events between slices
            // this.wireUpEvents(); // Deprecated: Slices now handle their own event subscriptions via EventBus

            // Update statistics
            this.statistics.totalInitializations++;
            this.statistics.lastInitialization = new Date();

            // Emit event
            this.emitOrchestratorEvent('orchestrator:initialized', {
                slicesInitialized: Object.keys(this.slices).filter(key => this.slices[key] !== null),
                eventWiringCount: this.eventWiring.length
            });

            this.logger.debug('PluginOrchestrator initialized successfully', {
                slicesCount: Object.keys(this.slices).length,
                eventWiringCount: this.eventWiring.length
            });
        } catch (error) {
            this.logger.error('Failed to initialize PluginOrchestrator', { error });
            this.state.errorCount++;
            this.state.lastError = error;

            // Emit error event
            this.emitOrchestratorEvent('orchestrator:error', { error, context: 'initialization' });

            throw error;
        }
    }

    /**
     * Start the orchestrator
     */
    async start(): Promise<void> {
        this.logger.debug('Starting PluginOrchestrator');

        try {
            if (!this.state.isInitialized) {
                await this.initialize();
            }

            // Update state
            this.state.isStarted = true;
            this.state.lastActivity = new Date();

            // Start all slices
            await this.startSlices();

            // Emit event
            this.emitOrchestratorEvent('orchestrator:started', {
                uptime: this.calculateUptime()
            });

            this.logger.debug('PluginOrchestrator started successfully');
        } catch (error) {
            this.logger.error('Failed to start PluginOrchestrator', { error });
            this.state.errorCount++;
            this.state.lastError = error;

            // Emit error event
            this.emitOrchestratorEvent('orchestrator:error', { error, context: 'startup' });

            throw error;
        }
    }

    /**
     * Stop the orchestrator
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping PluginOrchestrator');

        try {
            // Update state
            this.state.isShuttingDown = true;
            this.state.lastActivity = new Date();

            // Stop all slices
            await this.stopSlices();

            // Update state
            this.state.isStarted = false;

            // Emit event
            this.emitOrchestratorEvent('orchestrator:stopped', {
                uptime: this.calculateUptime(),
                totalEventsProcessed: this.statistics.totalEventHandled
            });

            this.logger.debug('PluginOrchestrator stopped successfully');
        } catch (error) {
            this.logger.error('Failed to stop PluginOrchestrator', { error });
            this.state.errorCount++;
            this.state.lastError = error;

            // Emit error event
            this.emitOrchestratorEvent('orchestrator:error', { error, context: 'shutdown' });

            throw error;
        }
    }

    /**
     * Get a slice by name
     */
    getSlice<T>(sliceName: string): T | null {
        try {
            const slice = this.slices[sliceName];
            this.logger.debug('Getting slice', { sliceName, found: !!slice });
            return slice as unknown as T;
        } catch (error) {
            this.logger.error('Failed to get slice', { sliceName, error });
            return null;
        }
    }

    /**
     * Get all slices
     */
    getAllSlices(): SliceMap {
        return { ...this.slices };
    }

    /**
     * Get orchestrator state
     */
    getState(): OrchestratorState {
        return { ...this.state };
    }

    /**
     * Get orchestrator statistics
     */
    getStatistics(): OrchestratorStatistics {
        return {
            ...this.statistics,
            uptime: this.calculateUptime(),
            averageEventProcessingTime: this.eventBus.getAverageEventProcessingTime()
        };
    }

    /**
     * Emit an event
     */
    emit(event: string, data: any): void {
        this.logger.debug('Emitting event', { event, data });

        try {
            // Update statistics
            this.statistics.totalEventFired++;
            this.state.lastActivity = new Date();

            // Emit through event bus
            this.eventBus.emit(event, data);

            // Emit orchestrator event
            this.emitOrchestratorEvent('orchestrator:eventFired', { event, data });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, data, error });
            this.statistics.totalErrors++;
            this.state.errorCount++;
            this.state.lastError = error;
        }
    }

    /**
     * Add event listener
     */
    on(event: string, handler: Function): void {
        this.logger.debug('Adding event listener', { event });

        try {
            // Add to event bus
            this.eventBus.on(event, handler);

            this.logger.debug('Event listener added successfully', { event });
        } catch (error) {
            this.logger.error('Failed to add event listener', { event, error });
        }
    }

    /**
     * Remove event listener
     */
    off(event: string, handler: Function): void {
        this.logger.debug('Removing event listener', { event });

        try {
            // Remove from event bus
            this.eventBus.off(event, handler);

            this.logger.debug('Event listener removed successfully', { event });
        } catch (error) {
            this.logger.error('Failed to remove event listener', { event, error });
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up PluginOrchestrator');

        try {
            // Stop orchestrator if running
            if (this.state.isStarted) {
                await this.stop();
            }

            // Cleanup all slices
            await this.cleanupSlices();

            // Cleanup event bus
            this.eventBus.cleanup();

            // Reset state
            this.state = {
                isInitialized: false,
                isStarted: false,
                isShuttingDown: false,
                lastActivity: new Date(),
                errorCount: 0
            };

            // Reset statistics
            this.statistics = {
                totalInitializations: 0,
                totalEventWiring: 0,
                totalEventFired: 0,
                totalEventHandled: 0,
                totalErrors: 0,
                totalRetries: 0,
                averageEventProcessingTime: 0,
                uptime: 0
            };

            this.logger.debug('PluginOrchestrator cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup PluginOrchestrator', { error });
        }
    }

    /**
     * Initialize all slices
     */
    private async initializeSlices(): Promise<void> {
        this.logger.debug('Initializing slices');

        try {
            // Create dependencies
            // Create dependencies
            const dependencies: SliceDependencies = {
                app: this.app,
                logger: this.logger,
                eventBus: this.eventBus,
                ...this.slices // Inject all slices
            };

            // Initialize slices in dependency order
            // Initialize slices in registration order
            const sliceOrder = this.sliceRegistry.getAllNames();

            for (const sliceName of sliceOrder) {
                // Update dependencies with latest slices map
                Object.assign(dependencies, this.slices);

                await this.initializeSlice(sliceName, dependencies);
            }

            this.logger.debug('All slices initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize slices', { error });
            throw error;
        }
    }

    /**
     * Initialize a single slice
     */
    private async initializeSlice(sliceName: string, dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing slice', { sliceName });

        try {
            // Create slice using registry
            const slice = this.sliceRegistry.create(sliceName, this.app, { plugin: this.plugin });

            // Store slice
            (this.slices as any)[sliceName] = slice;

            // Initialize slice
            if (slice && typeof slice.initialize === 'function') {
                await slice.initialize(dependencies);
            }

            // Emit slice lifecycle event
            this.emitSliceLifecycleEvent('slice:initialized', sliceName, {
                slice: sliceName,
                initialized: true
            });

            this.logger.debug('Slice initialized successfully', { sliceName });
        } catch (error) {
            this.logger.error('Failed to initialize slice', { sliceName, error });

            // Emit slice lifecycle event
            this.emitSliceLifecycleEvent('slice:error', sliceName, {
                slice: sliceName,
                error
            });

            throw error;
        }
    }

    /**
     * Wire up events between slices
     */
    private wireUpEvents(): void {
        this.logger.debug('Wiring up events between slices');

        try {
            // Define event wiring configuration
            // Note: Backlinks functionality is now consolidated within the Backlinks slice,
            // so most inter-slice event wiring for backlinks is no longer needed.
            // Only keep essential cross-cutting event wiring.
            this.eventWiring = [
                // NoteEditing events (still needed for cross-slice communication)
                {
                    source: 'backlinks',
                    target: 'noteEditing',
                    eventType: 'noteEditing:headingAdded',
                    handler: 'handleHeadingAdded',
                    enabled: true
                },
                // Navigation events from backlinks (now handled internally by backlinks slice)
                // The backlinks slice handles its own navigation, so no external wiring needed
            ];

            // Apply event wiring
            for (const wiring of this.eventWiring) {
                if (wiring.enabled) {
                    this.applyEventWiring(wiring);
                }
            }

            // Update statistics
            this.statistics.totalEventWiring = this.eventWiring.length;

            // Emit orchestrator event
            this.emitOrchestratorEvent('orchestrator:eventWired', {
                wiringCount: this.eventWiring.length
            });

            this.logger.debug('Event wiring completed', { wiringCount: this.eventWiring.length });
        } catch (error) {
            this.logger.error('Failed to wire up events', { error });
        }
    }

    /**
     * Apply event wiring
     */
    private applyEventWiring(wiring: EventWiringConfig): void {
        try {
            const sourceSlice = (this.slices as any)[wiring.source];
            const targetSlice = (this.slices as any)[wiring.target];

            if (sourceSlice && targetSlice && typeof targetSlice[wiring.handler] === 'function') {
                // Add event listener
                sourceSlice.addEventListener(wiring.eventType, (event: any) => {
                    targetSlice[wiring.handler](event.payload);
                });

                this.logger.debug('Event wiring applied', {
                    source: wiring.source,
                    target: wiring.target,
                    eventType: wiring.eventType,
                    handler: wiring.handler
                });
            } else {
                this.logger.warn('Failed to apply event wiring', {
                    source: wiring.source,
                    target: wiring.target,
                    eventType: wiring.eventType,
                    handler: wiring.handler,
                    sourceExists: !!sourceSlice,
                    targetExists: !!targetSlice,
                    handlerExists: targetSlice && typeof targetSlice[wiring.handler] === 'function'
                });
            }
        } catch (error) {
            this.logger.error('Failed to apply event wiring', { wiring, error });
        }
    }

    /**
     * Start all slices
     */
    private async startSlices(): Promise<void> {
        this.logger.debug('Starting all slices');

        try {
            for (const [sliceName, slice] of Object.entries(this.slices)) {
                if (slice && typeof slice.start === 'function') {
                    await slice.start();

                    // Emit slice lifecycle event
                    this.emitSliceLifecycleEvent('slice:started', sliceName, {
                        slice: sliceName,
                        started: true
                    });
                }
            }

            this.logger.debug('All slices started successfully');
        } catch (error) {
            this.logger.error('Failed to start slices', { error });
        }
    }


    /**
     * Stop all slices
     */
    private async stopSlices(): Promise<void> {
        this.logger.debug('Stopping all slices');

        try {
            for (const [sliceName, slice] of Object.entries(this.slices)) {
                if (slice && typeof slice.stop === 'function') {
                    await slice.stop();

                    // Emit slice lifecycle event
                    this.emitSliceLifecycleEvent('slice:stopped', sliceName, {
                        slice: sliceName,
                        stopped: true
                    });
                }
            }

            this.logger.debug('All slices stopped successfully');
        } catch (error) {
            this.logger.error('Failed to stop slices', { error });
        }
    }

    /**
     * Cleanup all slices
     */
    private async cleanupSlices(): Promise<void> {
        this.logger.debug('Cleaning up all slices');

        try {
            for (const [sliceName, slice] of Object.entries(this.slices)) {
                if (slice && typeof slice.cleanup === 'function') {
                    await slice.cleanup();
                }
            }

            // Clear slices registry
            this.slices = {
                sharedUtilities: null,
                sharedContracts: null,
                settings: null,
                navigation: null,
                noteEditing: null,
                backlinks: null, // Consolidated slice
                viewIntegration: null
            };

            this.logger.debug('All slices cleaned up successfully');
        } catch (error) {
            this.logger.error('Failed to cleanup slices', { error });
        }
    }

    /**
     * Calculate uptime
     */
    private calculateUptime(): number {
        return Date.now() - this.startTime.getTime();
    }

    /**
     * Emit orchestrator event
     */
    private emitOrchestratorEvent(type: OrchestratorEvent['type'], data?: any): void {
        const event: OrchestratorEvent = {
            type,
            timestamp: new Date(),
            data
        };

        this.eventBus.emit('orchestrator:event', event);
    }

    /**
     * Emit slice lifecycle event
     */
    private emitSliceLifecycleEvent(type: SliceLifecycleEvent['type'], sliceName: string, data?: any): void {
        const event: SliceLifecycleEvent = {
            type,
            sliceName,
            timestamp: new Date(),
            data
        };

        this.eventBus.emit('slice:lifecycle', event);
    }
}

// Export the orchestrator interface for external use
export type { IPluginOrchestrator } from './types';
