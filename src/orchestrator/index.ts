// ============================
// Plugin Orchestrator Exports
// ============================

export { PluginOrchestrator } from './PluginOrchestrator';
export { EventBus } from './EventBus';

// Export interfaces for external use
export type { 
    IPluginOrchestrator,
    OrchestratorConfig,
    SliceRegistry,
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