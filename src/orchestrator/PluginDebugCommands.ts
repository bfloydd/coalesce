import { App, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './PluginOrchestrator';

export interface DebugLogger {
  debug?(message?: unknown, ...optionalParams: unknown[]): void;
  info?(message?: unknown, ...optionalParams: unknown[]): void;
  warn?(message?: unknown, ...optionalParams: unknown[]): void;
  error?(message?: unknown, ...optionalParams: unknown[]): void;
}

/**
 * Attach all Coalesce debug commands onto the Obsidian app object.
 *
 * This mirrors the behavior previously implemented in CoalescePlugin.setupDebugMethods
 * in main.ts, but lives in a reusable, testable helper.
 */
export function attachDebugCommands(
  app: App,
  plugin: any,
  orchestrator: PluginOrchestrator,
  logger?: DebugLogger,
): void {
  const anyApp = app as any;

  // Focus-related helpers
  anyApp.coalesceTestFocus = () => {
    logger?.debug?.('Coalesce plugin test focus called');
    const viewIntegration = orchestrator.getSlice('viewIntegration');
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      (viewIntegration as any)?.requestFocusWhenReady?.(leafId);
    }
  };

  anyApp.coalesceTestDirectFocus = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    logger?.debug?.('Test direct focus - active view', { activeView: !!activeView });
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      const isReady = (viewIntegration as any)?.isViewReadyForFocus?.(leafId);
      logger?.debug?.('Test direct focus - view ready status', { leafId, isReady });
    }
  };

  anyApp.coalesceForceFocus = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      (viewIntegration as any)?.requestFocusWhenReady?.(leafId);
    }
  };

  anyApp.coalesceDirectFocus = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      const isReady = (viewIntegration as any)?.isViewReadyForFocus?.(leafId);
      logger?.debug?.('Direct focus - view ready status', { leafId, isReady });
    }
  };

  anyApp.coalesceTestWindowFocus = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      (viewIntegration as any)?.requestFocusWhenReady?.(leafId);
    }
  };

  anyApp.coalesceTestSimpleFocus = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const leafId = (activeView.leaf as any).id;
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      (viewIntegration as any)?.requestFocusWhenReady?.(leafId);
    } else {
      logger?.warn?.('No active markdown view found for simple focus test');
    }
  };

  // Status / logging helpers
  anyApp.coalesceStatus = () => {
    logger?.info?.('Coalesce plugin status', {
      pluginLoaded: !!plugin,
      orchestrator: !!orchestrator,
      orchestratorState: orchestrator.getState(),
      orchestratorStatistics: orchestrator.getStatistics(),
      markdownViews: app.workspace.getLeavesOfType('markdown').length,
    });
  };

  anyApp.coalesceUpdateLogging = (enabled: boolean) => {
    // Note: the global Logger.setGlobalLogging call still lives in main.ts
    logger?.info?.(`Coalesce logging ${enabled ? 'enabled' : 'disabled'}`, { enabled });
  };

  anyApp.coalesceTestStyles = () => {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const viewIntegration = orchestrator.getSlice('viewIntegration');
      const stats = (viewIntegration as any)?.getViewStatistics?.();
      logger?.info?.('View integration statistics', { stats });
    } else {
      logger?.warn?.('No active markdown view found for style test');
    }
  };

  // Orchestrator helpers
  anyApp.coalesceOrchestratorStatus = () => {
    logger?.info?.('Orchestrator status', {
      state: orchestrator.getState(),
      statistics: orchestrator.getStatistics(),
      allSlices: Object.keys(orchestrator.getAllSlices()),
    });
  };

  anyApp.coalesceOrchestratorEvent = (eventType: string, data: any) => {
    logger?.debug?.(`Emitting orchestrator event: ${eventType}`, { data });
    orchestrator.emit(eventType, data);
  };

  anyApp.coalesceSliceStatus = (sliceName: string) => {
    const slice = orchestrator.getSlice(sliceName as any);
    if (slice) {
      logger?.info?.(`${sliceName} slice found`, { sliceName });
      if (typeof (slice as any).getStatistics === 'function') {
        logger?.info?.(`${sliceName} statistics`, { statistics: (slice as any).getStatistics() });
      }
      if (typeof (slice as any).getState === 'function') {
        logger?.info?.(`${sliceName} state`, { state: (slice as any).getState() });
      }
    } else {
      logger?.warn?.(`${sliceName} slice not found`, { sliceName });
    }
  };
}

/**
 * Detach all Coalesce debug commands from the Obsidian app object.
 *
 * This mirrors the cleanup behavior previously coded in CoalescePlugin.onunload
 * in main.ts.
 */
export function detachDebugCommands(app: App): void {
  const anyApp = app as any;

  delete anyApp.coalesceTestFocus;
  delete anyApp.coalesceStatus;
  delete anyApp.coalesceTestDirectFocus;
  delete anyApp.coalesceForceFocus;
  delete anyApp.coalesceDirectFocus;
  delete anyApp.coalesceTestWindowFocus;
  delete anyApp.coalesceTestSimpleFocus;
  delete anyApp.coalesceUpdateLogging;
  delete anyApp.coalesceTestStyles;
  delete anyApp.coalesceOrchestratorStatus;
  delete anyApp.coalesceOrchestratorEvent;
  delete anyApp.coalesceSliceStatus;
}