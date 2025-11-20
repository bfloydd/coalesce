# Clean code refactor plan

## Scope

- Refactor 1: Align orchestrator and slice contracts with implementation.
- Refactor 2: Factor [`CoalescePlugin`](main.ts:6) into smaller, testable modules.

This file is implementation‑oriented and intended for Code mode to execute.

## Refactor 1 – Orchestrator and slice contracts

### Current state

- [`IPluginOrchestrator`](src/features/shared-contracts/slice-interfaces.ts:272) describes an orchestrator API that does not match [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20).
- Callers (for example [`CoalescePlugin`](main.ts:11)) construct [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) directly and use methods like `initialize()`, `start()`, `getSlice()`, and `emit()` that are not part of [`IPluginOrchestrator`](src/features/shared-contracts/slice-interfaces.ts:272).

### Target design decisions

- Treat [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) as the single source of truth for orchestrator behavior.
- Remove or deprecate the outdated [`IPluginOrchestrator`](src/features/shared-contracts/slice-interfaces.ts:272) and related factory APIs that are not used by production code.
- Keep slice interfaces (for example [`ISharedUtilitiesSlice`](src/features/shared-contracts/slice-interfaces.ts:16), [`ISettingsSlice`](src/features/shared-contracts/slice-interfaces.ts:51), [`INavigationSlice`](src/features/shared-contracts/slice-interfaces.ts:86), [`IBacklinksSlice`](src/features/shared-contracts/slice-interfaces.ts:138), [`IViewIntegrationSlice`](src/features/shared-contracts/slice-interfaces.ts:173)) as the stable contracts between orchestrator and features.

### Implementation checklist

1. In [`slice-interfaces.ts`](src/features/shared-contracts/slice-interfaces.ts:1), either:
   - Remove [`IPluginOrchestrator`](src/features/shared-contracts/slice-interfaces.ts:272) and [`ISliceFactory`](src/features/shared-contracts/slice-interfaces.ts:259) if they are truly unused in runtime code; or
   - Move them into a `legacy` or `experimental` section with a clear comment that [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) is the canonical implementation.
2. Search for all TypeScript references to `IPluginOrchestrator` and `ISliceFactory` and update or remove them so they do not misrepresent the active orchestrator API.
3. If you keep a type for the orchestrator, introduce a minimal `IPluginOrchestratorPublic` interface in [`src/orchestrator/types.ts`](src/orchestrator/types.ts:1) that matches the actual methods used by callers (for example `initialize()`, `start()`, `stop()`, `getSlice()`, `emit()`, `on()`, `off()`, `getState()`, `getStatistics()`).
4. Ensure [`src/orchestrator/index.ts`](src/orchestrator/index.ts:1) re‑exports [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) and any new public interface so external imports are consistent.
5. Add or update unit tests around the orchestrator public surface (in `src/orchestrator/__tests__`), verifying at least:
   - Slices are initialized in the intended order.
   - `getSlice()` returns the correct instances for at least [`settings`](src/features/settings/SettingsSlice.ts:19), [`backlinks`](src/features/backlinks/BacklinksSlice.ts:35), [`viewIntegration`](src/features/view-integration/ViewIntegrationSlice.ts:144).
   - `emit()` routes events through [`EventBus`](src/orchestrator/EventBus.ts:3) and updates statistics.

## Refactor 2 – Factor CoalescePlugin

### Current state

[`CoalescePlugin`](main.ts:6) currently:

- Bootstraps [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20) and manages configuration.
- Pulls a logger from [`SharedUtilitiesSlice`](src/features/shared-utilities/SharedUtilitiesSlice.ts:13) with runtime validation and a fallback logger.
- Registers many debug helpers on `this.app` in [`setupDebugMethods()`](main.ts:89).
- Registers DOM custom events and workspace events in [`registerEventHandlers()`](main.ts:300).
- Handles duplicate‑file throttling and backlinks UI refresh in [`shouldProcessFile()`](main.ts:210) and [`updateCoalesceUIForFile()`](main.ts:232).
- Performs view initialization in [`initializeExistingViews()`](main.ts:505).

### Target structure

Organize plugin responsibilities into small, focused modules under `src/orchestrator` or a new `src/plugin` folder, for example:

- `PluginBootstrap` – constructs [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20), initializes slices, and wires settings/logging.
- `PluginDebugCommands` – defines functions that attach and detach all `coalesce*` debug helpers on `app`.
- `PluginDomEventHandlers` – encapsulates registration logic for DOM custom events (`coalesce-settings-*`, `coalesce-navigate*`).
- `PluginWorkspaceEventHandlers` – encapsulates workspace event wiring (`file-open`, `layout-change`, `active-leaf-change`).
- `PluginViewInitializer` – handles `initializeExistingViews()` and the duplicate‑processing logic for backlinks UI.

After this refactor, [`CoalescePlugin`](main.ts:6) should be largely a thin adapter from Obsidian lifecycle (`onload`, `onunload`) to these helper modules.

### Implementation checklist

1. Extract a `plugin-bootstrap` module
   - Create `src/orchestrator/PluginBootstrap.ts` with a small function like `createAndStartOrchestrator(app, plugin, config)` that:
     - Instantiates [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20).
     - Calls `initialize()` and `start()`.
     - Returns the orchestrator instance.
   - Update [`CoalescePlugin.onload`](main.ts:11) to delegate orchestrator creation to this helper.

2. Extract debug command wiring
   - Move the bodies of [`setupDebugMethods()`](main.ts:89) into a new module, for example `src/orchestrator/PluginDebugCommands.ts`, exposing:
     - `attachDebugCommands(app, orchestrator, logger)`.
     - `detachDebugCommands(app)`.
   - In [`onload`](main.ts:11), call `attachDebugCommands` instead of inlining logic.
   - In [`onunload`](main.ts:562), call `detachDebugCommands` instead of manually deleting each property.

3. Extract DOM and workspace event registration
   - Move the logic from [`registerEventHandlers()`](main.ts:300) into a module such as `src/orchestrator/PluginEvents.ts` that exposes:
     - `registerDomEvents(document, app, orchestrator, logger)`.
     - `registerWorkspaceEvents(app, orchestrator, logger)`.
   - Have each function return unsubscribes/cleanup callbacks (if needed) so [`onunload`](main.ts:562) can tear them down explicitly if Obsidian lifecycle does not already do so.

4. Extract view initialization and duplicate‑processing logic
   - Move [`shouldProcessFile()`](main.ts:210), [`updateCoalesceUIForFile()`](main.ts:232), and [`initializeExistingViews()`](main.ts:505) into a dedicated helper such as `src/orchestrator/PluginViewInitializer.ts`.
   - Give this helper a small, testable surface, for example:
     - `createViewInitializer(app, orchestrator, logger)` returning an object with `updateForFile(path)` and `initializeExistingViews()`.
   - Update both DOM event handlers and orchestrator `file:opened` listeners to call into this helper instead of duplicating attachment logic.

5. Add tests for the new modules
   - For `PluginDebugCommands`, verify that attaching and detaching populates and cleans up the expected properties on a mocked `app`.
   - For `PluginEvents`, verify that firing `coalesce-*` events invokes the expected orchestrator or slice methods (using spies or mocks).
   - For `PluginViewInitializer`, verify that duplicate‑processing suppression works and that backlinks UI is attached only when the correct slices and active view are present.

## Suggested implementation order

1. Complete Refactor 1 (contracts alignment) and make sure all references to `IPluginOrchestrator`/`ISliceFactory` are updated or removed.
2. Implement Refactor 2 (CoalescePlugin factoring) in the sequence: bootstrap → debug commands → events → view initializer.
3. Once both are in place and covered by tests, consider tackling the next roadmap items (navigation unification, validation centralization, logging standardization).

This plan is now the source of truth for the first two clean‑code refactors and can be kept in sync as the implementation evolves.