# Clean code refactor plan

## Scope

- Refactor 1: Align orchestrator and slice contracts with implementation.
- Refactor 2: Factor [`CoalescePlugin`](main.ts:10) into smaller, testable modules.
- Refactor 3: Introduce a shared navigation facade used consistently by navigation and backlinks.

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

### Current structure (after refactor)

- [`CoalescePlugin`](main.ts:10) now:
  - Uses [`createAndStartOrchestrator()`](src/orchestrator/PluginBootstrap.ts:31) from [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) in `onload` instead of manually constructing and starting the orchestrator.
  - Delegates debug commands to [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) via [`attachDebugCommands()`](src/orchestrator/PluginDebugCommands.ts:21) and [`detachDebugCommands()`](src/orchestrator/PluginDebugCommands.ts:108), with a small local `coalesceUpdateLogging` that still calls [`Logger.setGlobalLogging`](src/features/shared-utilities/Logger.ts:1).
  - Delegates DOM, workspace, and orchestrator event wiring to [`registerPluginEvents()`](src/orchestrator/PluginEvents.ts:26) in [`PluginEvents`](src/orchestrator/PluginEvents.ts:1), passing a callback from the view initializer for UI updates.
  - Delegates view initialization and duplicate suppression to [`PluginViewInitializer`](src/orchestrator/PluginViewInitializer.ts:1) instead of owning that logic directly.

- New helpers:
  - [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) – `createOrchestrator` and `createAndStartOrchestrator`.
  - [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) – `attachDebugCommands(app, plugin, orchestrator, logger)` and `detachDebugCommands(app)`.
  - [`PluginEvents`](src/orchestrator/PluginEvents.ts:1) – `registerPluginEvents(app, plugin, orchestrator, logger, updateCoalesceUIForFile?)`.
  - [`PluginViewInitializer`](src/orchestrator/PluginViewInitializer.ts:1) – `initializeExistingViews()` and `updateForFile(path)`.

### Target structure

Organize plugin responsibilities into small, focused modules under `src/orchestrator` (or a future `src/plugin` folder):

- `PluginBootstrap` – constructs [`PluginOrchestrator`](src/orchestrator/PluginOrchestrator.ts:20), initializes slices, and wires settings/logging.
- `PluginDebugCommands` – defines functions that attach and detach all `coalesce*` debug helpers on `app`.
- `PluginEvents` – encapsulates registration logic for DOM custom events (`coalesce-settings-*`, `coalesce-navigate*`), workspace events, and orchestrator events.
- `PluginViewInitializer` – handles initial view discovery and the duplicate‑processing logic for backlinks UI attachment.

After this refactor, [`CoalescePlugin`](main.ts:10) is largely a thin adapter from Obsidian lifecycle (`onload`, `onunload`) to these helper modules.

### Implementation checklist and status

1. Extract a plugin bootstrap module – **Completed**
   - [`PluginBootstrap`](src/orchestrator/PluginBootstrap.ts:1) provides `createAndStartOrchestrator(app, plugin, config)`.
   - [`CoalescePlugin.onload`](main.ts:16) now uses `createAndStartOrchestrator` instead of manual `new PluginOrchestrator(...)` and separate `initialize()` / `start()` calls.

2. Extract debug command wiring – **Completed**
   - [`PluginDebugCommands`](src/orchestrator/PluginDebugCommands.ts:1) now owns all `coalesce*` debug helpers.
   - [`CoalescePlugin.setupDebugMethods`](main.ts:91) calls `attachDebugCommands(this.app, this, this.orchestrator, this.logger)` and defines only `coalesceUpdateLogging` locally to call [`Logger.setGlobalLogging`](src/features/shared-utilities/Logger.ts:1).
   - [`CoalescePlugin.onunload`](main.ts:174) calls `detachDebugCommands(this.app)` instead of manually deleting each debug property.

3. Extract DOM+workspace+orchestrator event registration – **Completed**
   - [`PluginEvents`](src/orchestrator/PluginEvents.ts:1) implements `registerPluginEvents(app, plugin, orchestrator, logger, updateCoalesceUIForFile?)`, wiring:
     - DOM events: `coalesce-settings-collapse-changed`, `coalesce-logging-state-changed`, `coalesce-navigate`, `coalesce-navigate-complete`.
     - Workspace events: `file-open`, `layout-change`, `active-leaf-change`.
     - Orchestrator events: `file:opened`, `layout:changed`, `active-leaf:changed`.
   - [`CoalescePlugin.registerEventHandlers`](main.ts:106) now delegates to:

     ```ts
     registerPluginEvents(
       this.app,
       this,
       this.orchestrator,
       this.logger,
       this.viewInitializer.updateForFile.bind(this.viewInitializer)
     );
     ```

4. Extract view initialization and duplicate‑processing logic – **Completed**
   - [`PluginViewInitializer`](src/orchestrator/PluginViewInitializer.ts:1) now owns:
     - Duplicate suppression logic (previously `shouldProcessFile` in `main.ts`).
     - Backlinks UI attachment and settings application logic (previously `updateCoalesceUIForFile`).
     - Initial and delayed `file:opened` emission for all markdown views (previously `initializeExistingViews`).
   - [`CoalescePlugin`](main.ts:54) creates the view initializer and delegates:
     - `this.viewInitializer = createViewInitializer(this.app, this.orchestrator, this.logger);`
     - Startup initialization via `this.viewInitializer.initializeExistingViews();`.

5. Add tests for the new modules – **In progress**
   - `PluginDebugCommands` – **Completed**:
     - [`PluginDebugCommands.test`](src/orchestrator/__tests__/PluginDebugCommands.test.ts:1) verifies that `attachDebugCommands` attaches representative `coalesce*` helpers on a mocked `app` and that `detachDebugCommands` removes them.
   - `PluginEvents` – Planned:
     - Verify that firing `coalesce-*` DOM events invokes the expected orchestrator or slice methods (using spies/mocks for `settings`, `backlinks`, `viewIntegration`, and navigation behavior).
     - Verify that `file:opened` drives `initializeView` + `attachToDOM` + `setOptions` as expected when slices are present.
   - `PluginViewInitializer` – Planned:
     - Verify that duplicate‑processing suppression works (previous `shouldProcessFile` semantics preserved).
     - Verify that backlinks UI is attached only when the correct slices and active view are present.

## Refactor 3 – Shared navigation facade

### Current structure

- Navigation implementation:
  - [`NavigationSlice`](src/features/navigation/NavigationSlice.ts:17) constructs:
    - `FileOpener`
    - `LinkHandler`
    - `NavigationService`
    - and exposes a higher-level navigation API (`openPath`, `handleLinkClick`, history, etc.).
  - [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35) previously constructed its own:
    - `FileOpener`
    - `LinkHandler`
    - `NavigationService`
    - to implement [`handleNavigation()`](src/features/backlinks/BacklinksSlice.ts:352) via wiki-link text.

- Shared navigation facade (new):
  - [`NavigationFacade`](src/features/navigation/NavigationFacade.ts:1) now provides a lazily-initialized shared set of navigation components:
    - `getSharedNavigation(app, baseLogger)` returns `{ navigationService, fileOpener, linkHandler }`.
    - `__resetSharedNavigationForTests()` to reset the singleton in tests.

### Target design

- There should be exactly one `NavigationService` (and corresponding `FileOpener` / `LinkHandler`) per plugin instance, shared by:
  - [`NavigationSlice`](src/features/navigation/NavigationSlice.ts:17)
  - [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35)
  - Any future slice that needs navigation behavior.
- Validation, file existence checks, and link processing should flow through this shared stack so navigation behavior is consistent everywhere.

### Implementation checklist and status

1. Introduce a NavigationFacade module – **Completed**
   - Created [`NavigationFacade`](src/features/navigation/NavigationFacade.ts:1) with:
     - `getSharedNavigation(app, baseLogger)`: lazily creates and stores `{ navigationService, fileOpener, linkHandler }` on first call, reuses thereafter.
     - `__resetSharedNavigationForTests()`: test helper to reset the shared instance.

2. Update NavigationSlice to use the shared facade – **Completed**
   - [`NavigationSlice`](src/features/navigation/NavigationSlice.ts:17) now imports `getSharedNavigation` and uses it in the constructor:

     ```ts
     const shared = getSharedNavigation(app, this.logger);
     this.fileOpener = shared.fileOpener;
     this.linkHandler = shared.linkHandler;
     this.navigationService = shared.navigationService;
     ```

   - It no longer constructs its own `FileOpener` / `LinkHandler` / `NavigationService`; it only configures performance monitoring and history on top.

3. Update BacklinksSlice to use the shared facade – **Completed**
   - [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35) now imports `getSharedNavigation` from `../navigation/NavigationFacade` and uses it in the constructor:

     ```ts
     const sharedNavigation = getSharedNavigation(this.app, this.logger);
     this.navigationService = sharedNavigation.navigationService;
     ```

   - It no longer constructs its own navigation stack; [`handleNavigation()`](src/features/backlinks/BacklinksSlice.ts:352) continues to call `navigationService.openWikiLink(...)`, but now using the shared instance.

4. Add tests for the navigation facade – **Planned**
   - Add a small test module (e.g. [`NavigationFacade.test`](src/features/navigation/__tests__/NavigationFacade.test.ts:1)) that:
     - Asserts that two calls to `getSharedNavigation(app, logger)` return the same `navigationService` instance.
     - Asserts that `__resetSharedNavigationForTests()` causes a subsequent call to create a new instance.
   - Optionally, assert that `NavigationSlice` and `BacklinksSlice` both obtain a `NavigationService` that is strictly the same object in an integration-style test.

## Suggested implementation order (updated)

1. Refactor 1 (orchestrator/slice contracts) – **Completed**.
2. Refactor 2 (CoalescePlugin) – **Completed**:
   - Bootstrap, debug commands, event wiring, and view initialization have all been extracted into helper modules, with `main.ts` acting as a thin lifecycle adapter.
3. Refactor 3 (shared navigation facade) – **Partially completed**:
   - Shared navigation facade created and wired into [`NavigationSlice`](src/features/navigation/NavigationSlice.ts:17) and [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35).
   - Remaining: facade-focused tests and potential further centralization of validation once SharedUtilities validation helpers are introduced into the navigation path.
4. Next steps:
   - Add tests for navigation facade and remaining helper modules.
   - Proceed to centralizing validation (via `SharedUtilitiesSlice.getValidationUtils`) and standardizing logging (via `SharedUtilitiesSlice.getLogger`), continuing to update this document as new refactors land.