# Clean code refactor plan

## Scope

- Refactor 1: Align orchestrator and slice contracts with implementation.
- Refactor 2: Factor [`CoalescePlugin`](main.ts:9) into smaller, testable modules.

This file is implementation‑oriented and intended for Code mode to execute.

## Refactor 1 – Orchestrator and slice contracts

### Status

- Completed:
  - Outdated `IPluginOrchestrator` / `ISliceFactory` contracts were removed from [`slice-interfaces.ts`](src/features/shared-contracts/slice-interfaces.ts:1), so that file now describes only slice-level APIs.
  - Orchestrator contracts live in [`src/orchestrator/types.ts`](src/orchestrator/types.ts:1) and are exported via [`src/orchestrator/index.ts`](src/orchestrator/index.ts:1), matching the concrete [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) implementation.
- Still planned:
  - Add/update orchestrator-level tests to validate initialization order, `getSlice()`, and event/statistics behavior.

### Notes

- [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) is the single source of truth for orchestrator behavior.
- Slice interfaces (for example [`ISharedUtilitiesSlice`](src/features/shared-contracts/slice-interfaces.ts:16), [`ISettingsSlice`](src/features/shared-contracts/slice-interfaces.ts:51), [`INavigationSlice`](src/features/shared-contracts/slice-interfaces.ts:86), [`IBacklinksSlice`](src/features/shared-contracts/slice-interfaces.ts:138), [`IViewIntegrationSlice`](src/features/shared-contracts/slice-interfaces.ts:173)) remain the stable contracts between orchestrator and features.

## Refactor 2 – Factor CoalescePlugin

### Current structure (after refactor step 1–3)

- [`CoalescePlugin`](main.ts:9) now:
  - Uses [`createAndStartOrchestrator()`](src/orchestrator/PluginBootstrap.ts:31) from [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) in `onload` instead of manually constructing and starting the orchestrator.
  - Delegates debug commands to [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) via [`attachDebugCommands()`](src/orchestrator/PluginDebugCommands.ts:21) and [`detachDebugCommands()`](src/orchestrator/PluginDebugCommands.ts:108), with a small local `coalesceUpdateLogging` that still calls [`Logger.setGlobalLogging`](src/features/shared-utilities/Logger.ts:1).
  - Delegates DOM, workspace, and orchestrator event wiring to [`registerPluginEvents()`](src/orchestrator/PluginEvents.ts:26) in [`PluginEvents`](src/orchestrator/PluginEvents.ts:1).
  - Still owns view initialization and duplicate suppression via [`shouldProcessFile()`](main.ts:100), [`updateCoalesceUIForFile()`](main.ts:122), and [`initializeExistingViews()`](main.ts:395).

- New helpers:
  - [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) – `createOrchestrator` and `createAndStartOrchestrator`.
  - [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) – `attachDebugCommands(app, plugin, orchestrator, logger)` and `detachDebugCommands(app)`.
  - [`PluginEvents`](src/orchestrator/PluginEvents.ts:1) – `registerPluginEvents(app, plugin, orchestrator, logger, updateCoalesceUIForFile?)`.

### Target structure

Organize plugin responsibilities into small, focused modules under `src/orchestrator` (or a future `src/plugin` folder):

- `PluginBootstrap` – constructs [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20), initializes slices, and wires settings/logging.
- `PluginDebugCommands` – defines functions that attach and detach all `coalesce*` debug helpers on `app`.
- `PluginEvents` – encapsulates registration logic for DOM custom events (`coalesce-settings-*`, `coalesce-navigate*`), workspace events, and orchestrator events.
- `PluginViewInitializer` – planned: handles `initializeExistingViews()` and the duplicate‑processing logic for backlinks UI.

After this refactor, [`CoalescePlugin`](main.ts:9) should be largely a thin adapter from Obsidian lifecycle (`onload`, `onunload`) to these helper modules.

### Implementation checklist and status

1. Extract a plugin bootstrap module – **Completed**
   - [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) provides `createAndStartOrchestrator(app, plugin, config)`.
   - [`CoalescePlugin.onload`](main.ts:14) now uses `createAndStartOrchestrator` instead of manual `new PluginOrchestrator(...)` and separate `initialize()` / `start()` calls.

2. Extract debug command wiring – **Completed**
   - [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) now owns all `coalesce*` debug helpers.
   - [`CoalescePlugin.setupDebugMethods`](main.ts:86) calls `attachDebugCommands(this.app, this, this.orchestrator, this.logger)` and defines only `coalesceUpdateLogging` locally to call [`Logger.setGlobalLogging`](src/features/shared-utilities/Logger.ts:1).
   - [`CoalescePlugin.onunload`](main.ts:452) calls `detachDebugCommands(this.app)` instead of manually deleting each debug property.

3. Extract DOM+workspace+orchestrator event registration – **Completed**
   - [`PluginEvents`](src/orchestrator/PluginEvents.ts:1) implements `registerPluginEvents(app, plugin, orchestrator, logger, updateCoalesceUIForFile?)`, wiring:
     - DOM events: `coalesce-settings-collapse-changed`, `coalesce-logging-state-changed`, `coalesce-navigate`, `coalesce-navigate-complete`.
     - Workspace events: `file-open`, `layout-change`, `active-leaf-change`.
     - Orchestrator events: `file:opened`, `layout:changed`, `active-leaf:changed`.
   - [`CoalescePlugin.registerEventHandlers`](main.ts:190) now delegates to:

     ```ts
     registerPluginEvents(
       this.app,
       this,
       this.orchestrator,
       this.logger,
       this.updateCoalesceUIForFile.bind(this)
     );
     ```

4. Extract view initialization and duplicate‑processing logic – **Planned**
   - Introduce a `PluginViewInitializer` helper, for example:

     ```ts
     const viewInitializer = createViewInitializer(app, orchestrator, logger);
     viewInitializer.updateForFile(path);
     viewInitializer.initializeExistingViews();
     ```

   - Migrate [`shouldProcessFile()`](main.ts:100), [`updateCoalesceUIForFile()`](main.ts:122), and [`initializeExistingViews()`](main.ts:395) out of `main.ts` into this helper.
   - Update:
     - `PluginEvents.registerPluginEvents` call sites to use `viewInitializer.updateForFile(...)` instead of calling `updateCoalesceUIForFile` directly.
     - `CoalescePlugin.onload` to call `viewInitializer.initializeExistingViews()` rather than its own method.

5. Add tests for the new modules – **Planned**
   - `PluginDebugCommands`:
     - Verify that `attachDebugCommands` attaches the expected `coalesce*` functions on a mocked `app`, and that `detachDebugCommands` removes them.
   - `PluginEvents`:
     - Verify that firing `coalesce-*` events invokes the expected orchestrator or slice methods (using spies/mocks for `settings`, `backlinks`, `viewIntegration`, and `navigation` behaviors).
     - Verify that `file:opened` drives `initializeView` + `attachToDOM` + `setOptions` as expected when slices are present.
   - `PluginViewInitializer` (once added):
     - Verify that duplicate‑processing suppression works (`shouldProcessFile` semantics preserved).
     - Verify that backlinks UI is attached only when the correct slices and active view are present.

## Suggested implementation order (updated)

1. Refactor 1 (orchestrator/slice contracts) – **Completed**.
2. Refactor 2 (CoalescePlugin) – **Partially completed**:
   - Done: bootstrap extraction, debug command extraction, event wiring extraction.
   - Remaining: view initializer helper and tests for new modules.
3. After these are complete and covered by tests, proceed to the next roadmap items (navigation unification, validation centralization, logging standardization), using this document as living design notes.