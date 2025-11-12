// ============================
// Plugin Orchestrator Types
// ============================

import { App } from 'obsidian';

// ============================
// Orchestrator Configuration
// ============================

export interface OrchestratorConfig {
    enableLogging: boolean;
    enableEventDebugging: boolean;
    enablePerformanceMonitoring: boolean;
    enableErrorRecovery: boolean;
    maxRetries: number;
    retryDelay: number;
}

// ============================
// Slice Registry
// ============================

export interface SliceRegistry {
    sharedUtilities: any;
    sharedContracts: any;
    settings: any;
    navigation: any;
    noteEditing: any;
    backlinks: any;
    backlinkBlocks: any;
    backlinksHeader: any;
    viewIntegration: any;
}

// ============================
// Orchestrator State
// ============================

export interface OrchestratorState {
    isInitialized: boolean;
    isStarted: boolean;
    isShuttingDown: boolean;
    lastActivity: Date;
    errorCount: number;
    lastError?: Error;
}

// ============================
// Orchestrator Statistics
// ============================

export interface OrchestratorStatistics {
    totalInitializations: number;
    totalEventWiring: number;
    totalEventFired: number;
    totalEventHandled: number;
    totalErrors: number;
    totalRetries: number;
    averageEventProcessingTime: number;
    lastInitialization?: Date;
    lastEventFired?: Date;
    lastError?: Date;
    uptime: number;
}

// ============================
// Event Wiring Configuration
// ============================

export interface EventWiringConfig {
    source: string;
    target: string;
    eventType: string;
    handler: string;
    enabled: boolean;
}

// ============================
// Slice Dependencies
// ============================

export interface SliceDependencies {
    app: App;
    logger: any;
    settings: any;
    sharedUtilities: any;
    sharedContracts: any;
}

// ============================
// Orchestrator Event
// ============================

export interface OrchestratorEvent {
    type: 'orchestrator:initialized' | 'orchestrator:started' | 'orchestrator:stopped' | 'orchestrator:error' | 'orchestrator:eventWired' | 'orchestrator:eventFired' | 'orchestrator:eventHandled';
    timestamp: Date;
    data?: any;
    error?: Error;
}

// ============================
// Slice Lifecycle Event
// ============================

export interface SliceLifecycleEvent {
    type: 'slice:initialized' | 'slice:started' | 'slice:stopped' | 'slice:error';
    sliceName: string;
    timestamp: Date;
    data?: any;
    error?: Error;
}

// ============================
// Event Processing Result
// ============================

export interface EventProcessingResult {
    success: boolean;
    processingTime: number;
    handlersExecuted: number;
    errors: Error[];
}

// ============================
// Orchestrator Options
// ============================

export interface OrchestratorOptions {
    config: OrchestratorConfig;
    eventWiring: EventWiringConfig[];
    sliceOptions: Record<string, any>;
}

// ============================
// Slice Factory
// ============================

export interface SliceFactory {
    createSlice<T>(sliceName: string, dependencies: SliceDependencies, options?: any): T;
    destroySlice(sliceName: string): void;
    getSlice<T>(sliceName: string): T | null;
    getAllSlices(): Record<string, any>;
}

// ============================
// Event Bus
// ============================

export interface EventBus {
    emit(event: string, data: any): void;
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    once(event: string, handler: Function): void;
    removeAllListeners(event?: string): void;
    getListenerCount(event: string): number;
    getEventNames(): string[];
}

// ============================
// Performance Monitor
// ============================

export interface PerformanceMonitor {
    startTimer(name: string): void;
    endTimer(name: string): number;
    getTimer(name: string): number | null;
    getAllTimers(): Record<string, number>;
    resetTimers(): void;
}

// ============================
// Error Recovery
// ============================

export interface ErrorRecovery {
    handleError(error: Error, context: string): boolean;
    retry(operation: Function, maxRetries?: number): Promise<any>;
    getCircuitBreakerStatus(): string;
    resetCircuitBreaker(): void;
}

// ============================
// Orchestrator Interface
// ============================

export interface IPluginOrchestrator {
    /**
     * Initialize the orchestrator
     */
    initialize(): Promise<void>;
    
    /**
     * Start the orchestrator
     */
    start(): Promise<void>;
    
    /**
     * Stop the orchestrator
     */
    stop(): Promise<void>;
    
    /**
     * Get a slice by name
     */
    getSlice<T>(sliceName: string): T | null;
    
    /**
     * Get all slices
     */
    getAllSlices(): SliceRegistry;
    
    /**
     * Get orchestrator state
     */
    getState(): OrchestratorState;
    
    /**
     * Get orchestrator statistics
     */
    getStatistics(): OrchestratorStatistics;
    
    /**
     * Emit an event
     */
    emit(event: string, data: any): void;
    
    /**
     * Add event listener
     */
    on(event: string, handler: Function): void;
    
    /**
     * Remove event listener
     */
    off(event: string, handler: Function): void;
    
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}

// ============================
// Slice Initialization Options
// ============================

export interface SliceInitializationOptions {
    lazy: boolean;
    priority: number;
    dependencies: string[];
    retryOnFailure: boolean;
    maxRetries: number;
}

// ============================
// Orchestrator Context
// ============================

export interface OrchestratorContext {
    app: App;
    config: OrchestratorConfig;
    logger: any;
    eventBus: EventBus;
    performanceMonitor: PerformanceMonitor;
    errorRecovery: ErrorRecovery;
}

// ============================
// Slice Health Status
// ============================

export interface SliceHealthStatus {
    sliceName: string;
    isHealthy: boolean;
    lastActivity: Date;
    errorCount: number;
    lastError?: Error;
    memoryUsage?: number;
    eventProcessingTime?: number;
}

// ============================
// Orchestrator Health Report
// ============================

export interface OrchestratorHealthReport {
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    uptime: number;
    totalErrors: number;
    sliceHealth: Record<string, SliceHealthStatus>;
    performanceMetrics: {
        averageEventProcessingTime: number;
        totalEventsProcessed: number;
        memoryUsage: number;
    };
}