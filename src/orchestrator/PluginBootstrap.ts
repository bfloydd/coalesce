import { App } from 'obsidian';
import { PluginOrchestrator } from './PluginOrchestrator';
import { OrchestratorConfig } from './types';
import { SharedUtilitiesSlice } from '../features/shared-utilities/SharedUtilitiesSlice';
import { NoteEditingSlice } from '../features/note-editing/NoteEditingSlice';
import { SettingsSlice } from '../features/settings/SettingsSlice';
import { NavigationSlice } from '../features/navigation/NavigationSlice';
import { BacklinksSlice } from '../features/backlinks/BacklinksSlice';
import { ViewIntegrationSlice } from '../features/view-integration/ViewIntegrationSlice';

/**
 * Helper functions for creating and bootstrapping the PluginOrchestrator.
 *
 * This keeps the Obsidian plugin entrypoint (main.ts) focused on wiring
 * lifecycle events, while the details of orchestrator configuration live
 * in a single place.
 */
export interface BootstrapConfig extends Partial<OrchestratorConfig> { }

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

  // Register slices
  // Note: Order matters! Slices are initialized in the order they are registered.

  // 1. Shared Utilities (Base dependency)
  orchestrator.registerSlice('sharedUtilities', () => new SharedUtilitiesSlice());

  // 2. Shared Contracts (Types only, no class)
  // orchestrator.registerSlice('sharedContracts', () => ({})); 

  // 3. Settings
  orchestrator.registerSlice('settings', (app, config) => new SettingsSlice(app, config.plugin));

  // 4. Navigation
  orchestrator.registerSlice('navigation', (app) => new NavigationSlice(app));

  // 5. Note Editing
  orchestrator.registerSlice('noteEditing', (app, config) => new NoteEditingSlice(app, config));

  // 6. Backlinks
  orchestrator.registerSlice('backlinks', (app, config) => new BacklinksSlice(app, config));

  // 7. View Integration
  orchestrator.registerSlice('viewIntegration', (app) => new ViewIntegrationSlice(app));

  await orchestrator.initialize();
  await orchestrator.start();

  return orchestrator;
}
