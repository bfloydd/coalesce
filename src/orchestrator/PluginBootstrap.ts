import { App } from 'obsidian';
import { PluginOrchestrator } from './PluginOrchestrator';
import { OrchestratorConfig } from './types';

/**
 * Helper functions for creating and bootstrapping the PluginOrchestrator.
 *
 * This keeps the Obsidian plugin entrypoint (main.ts) focused on wiring
 * lifecycle events, while the details of orchestrator configuration live
 * in a single place.
 */
export interface BootstrapConfig extends Partial<OrchestratorConfig> {}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableLogging: true,
  enableEventDebugging: false,
  enablePerformanceMonitoring: true,
  enableErrorRecovery: true,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Create a PluginOrchestrator instance without starting it.
 *
 * Most callers should prefer {@link createAndStartOrchestrator}, but this
 * is available for tests or advanced scenarios that want finer-grained
 * control over initialization and startup.
 */
export function createOrchestrator(
  app: App,
  plugin: any,
  config?: BootstrapConfig,
): PluginOrchestrator {
  const mergedConfig: OrchestratorConfig = {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
  };

  return new PluginOrchestrator(app, plugin, mergedConfig);
}

/**
 * Create, initialize, and start the PluginOrchestrator.
 *
 * This is the main entrypoint used by {@link CoalescePlugin} in main.ts.
 */
export async function createAndStartOrchestrator(
  app: App,
  plugin: any,
  config?: BootstrapConfig,
): Promise<PluginOrchestrator> {
  const orchestrator = createOrchestrator(app, plugin, config);

  await orchestrator.initialize();
  await orchestrator.start();

  return orchestrator;
}