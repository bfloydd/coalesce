// ============================
// Plugin Orchestrator Exports
// ============================

export { PluginOrchestrator } from './PluginOrchestrator';
export { EventBus } from './EventBus';
export { SliceRegistry } from './SliceRegistry';

// Export interfaces for external use
export type {
    IPluginOrchestrator,
    OrchestratorConfig,
    SliceMap,
    OrchestratorState,
    OrchestratorStatistics,
    EventWiringConfig,
    SliceDependencies,
    OrchestratorEvent,
    SliceLifecycleEvent,
    EventProcessingResult,
    OrchestratorOptions,
    SliceFactory,
    EventBus as IEventBus,
    PerformanceMonitor,
    ErrorRecovery,
    SliceInitializationOptions,
    OrchestratorContext,
    SliceHealthStatus,
    OrchestratorHealthReport
} from './types';