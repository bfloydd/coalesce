import { App } from 'obsidian';
import { attachDebugCommands, detachDebugCommands } from '../PluginDebugCommands';
import { PluginOrchestrator } from '../PluginOrchestrator';

describe('PluginDebugCommands', () => {
  interface MockApp extends App {
    [key: string]: any;
  }

  const createMockApp = (): MockApp => {
    const app: any = {
      workspace: {
        getActiveViewOfType: jest.fn().mockReturnValue(null),
        getLeavesOfType: jest.fn().mockReturnValue([]),
      },
    };
    return app as MockApp;
  };

  const createMockOrchestrator = (): PluginOrchestrator => {
    return {
      getSlice: jest.fn(),
      getState: jest.fn().mockReturnValue({}),
      getStatistics: jest.fn().mockReturnValue({}),
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      getAllSlices: jest.fn().mockReturnValue({}),
      cleanup: jest.fn(),
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as PluginOrchestrator;
  };

  const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  it('attaches and detaches coalesce debug commands on the app object', () => {
    const app = createMockApp();
    const orchestrator = createMockOrchestrator();
    const logger = createMockLogger();
    const plugin: any = {}; // CoalescePlugin instance is not used directly here

    attachDebugCommands(app, plugin, orchestrator, logger);

    const anyApp = app as any;

    // Spot-check a few representative commands
    expect(typeof anyApp.coalesceStatus).toBe('function');
    expect(typeof anyApp.coalesceTestFocus).toBe('function');
    expect(typeof anyApp.coalesceTestDirectFocus).toBe('function');
    expect(typeof anyApp.coalesceOrchestratorStatus).toBe('function');
    expect(typeof anyApp.coalesceSliceStatus).toBe('function');

    detachDebugCommands(app);

    // Ensure they were removed
    expect(anyApp.coalesceStatus).toBeUndefined();
    expect(anyApp.coalesceTestFocus).toBeUndefined();
    expect(anyApp.coalesceTestDirectFocus).toBeUndefined();
    expect(anyApp.coalesceOrchestratorStatus).toBeUndefined();
    expect(anyApp.coalesceSliceStatus).toBeUndefined();
  });
});