graph TD
    A[Plugin Orchestrator] --> B[SharedUtilities Slice]
    A --> C[Settings Slice]
    A --> D[Navigation Slice]
    A --> E[Backlinks Slice]
    A --> F[NoteEditing Slice]
    A --> G[ViewIntegration Slice]
    A --> H[SharedContracts]

    %% Shared utilities & contracts
    B --> B1[Logger, Performance, Daily Notes, Helpers]
    H --> H1[Types, Events, Plugin Interfaces]

    %% Settings vertical slice
    C --> C1[SettingsCore (Domain)]
    C --> C2[SettingsUI (Settings Tab)]

    %% Navigation vertical slice
    D --> D1[NavigationSlice]
    D1 --> D2[NavigationService]
    D2 --> D3[FileOpener]
    D2 --> D4[LinkHandler]

    %% Backlinks vertical slice
    E --> E1[BacklinksCore (Domain)]
    E --> E2[BacklinksViewController]
    E2 --> E3[HeaderController]

    %% View integration
    G --> G1[ViewIntegrationSlice]

    %% Cross-slice relationships
    E -.-> D1
    C -.-> E
    C -.-> G
    B -.-> C
    B -.-> D
    B -.-> E
    B -.-> F
    B -.-> G
    H -.-> B
    H -.-> C
    H -.-> D
    H -.-> E
    H -.-> F
    H -.-> G
```

## Core / UI / Orchestrator Pattern

The plugin follows a vertical slice architecture. Each feature has:

- An orchestrator slice used by the plugin orchestrator.
- A core/domain layer that owns business logic and state.
- A UI layer that owns DOM and Obsidian-facing concerns (where applicable).

Below is how this maps to the current codebase.

### Shared Utilities

The shared utilities slice lives in [`SharedUtilitiesSlice.ts`](src/features/shared-utilities/SharedUtilitiesSlice.ts) and provides:

- Logging via [`Logger.ts`](src/features/shared-utilities/Logger.ts).
- Performance monitoring via [`PerformanceMonitor.ts`](src/features/shared-utilities/PerformanceMonitor.ts).
- Daily note helpers and other cross-cutting utilities.

### Settings Slice

- Orchestrator slice: [`SettingsSlice.ts`](src/features/settings/SettingsSlice.ts)
- Core/domain: [`SettingsCore.ts`](src/features/settings/core/SettingsCore.ts), backed by [`SettingsStore.ts`](src/features/settings/SettingsStore.ts) and [`ThemeManager.ts`](src/features/settings/ThemeManager.ts).
- UI: [`SettingsUI.ts`](src/features/settings/SettingsUI.ts) implements the Obsidian settings tab for the Coalesce plugin.

Responsibilities:

- Load, validate, and persist settings defined in [`plugin.ts`](src/features/shared-contracts/plugin.ts).
- Drive global logging state (used by the shared logger and performance monitor).
- Manage theme selection and apply theme classes via the theme manager.
- Expose a thin settings interface consumed by the orchestrator and other slices.

### Navigation Slice

- Orchestrator slice: [`NavigationSlice.ts`](src/features/navigation/NavigationSlice.ts)
- Core service: [`NavigationService.ts`](src/features/navigation/NavigationService.ts)
- Helpers:
  - [`FileOpener.ts`](src/features/navigation/FileOpener.ts)
  - [`LinkHandler.ts`](src/features/navigation/LinkHandler.ts)

Responsibilities:

- Provide high-level navigation APIs (opening paths, handling link clicks, tracking history) through the navigation slice.
- Coordinate low-level file opening and link resolution via the navigation service, file opener, and link handler.
- Expose a simple navigation interface to the orchestrator while keeping Obsidian-specific calls encapsulated.

Backlinks navigation is standardized by delegating to the navigation service:

- [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts) builds wiki-style link text (for files and blocks) and calls the navigation service, instead of calling `app.workspace.openLinkText` directly.

### Backlinks Slice

- Orchestrator slice: [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts)
- Core/domain:
  - [`BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts)
  - [`BacklinksState.ts`](src/features/backlinks/core/BacklinksState.ts)
  - [`BacklinksEvents.ts`](src/features/backlinks/core/BacklinksEvents.ts)
- UI:
  - [`BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts)
  - [`HeaderController.ts`](src/features/backlinks/ui/HeaderController.ts)
  - [`HeaderUI.ts`](src/features/backlinks/HeaderUI.ts)
  - [`SettingsControls.ts`](src/features/backlinks/SettingsControls.ts)
  - [`FilterControls.ts`](src/features/backlinks/FilterControls.ts)
  - [`BlockExtractor.ts`](src/features/backlinks/BlockExtractor.ts)
  - [`BlockRenderer.ts`](src/features/backlinks/BlockRenderer.ts)

Responsibilities:

- Core/domain:
  - Discover backlinks and manage cache/state.
  - Emit typed events (for example `backlinks:updated`) to other slices.
- UI:
  - Attach the backlinks container into a `MarkdownView`.
  - Build and update the header, block list, and filter/alias controls.
  - Keep header state and statistics encapsulated in the header controller, delegating DOM details to `HeaderUI`, settings controls, and filter controls.
- Orchestrator:
  - Wire all dependencies for the backlinks feature.
  - Expose the backlinks interface to the orchestrator.
  - Delegate navigation to the navigation service for file and block jumps.

### Note Editing Slice

- Orchestrator slice: [`NoteEditingSlice.ts`](src/features/note-editing/NoteEditingSlice.ts)
- Helpers:
  - [`ContentEditor.ts`](src/features/note-editing/ContentEditor.ts)
  - [`FileModifier.ts`](src/features/note-editing/FileModifier.ts)
  - [`HeadingManager.ts`](src/features/note-editing/HeadingManager.ts)
  - [`HeadingPopupComponent.ts`](src/features/note-editing/HeadingPopupComponent.ts)

Responsibilities:

- Provide heading and note-editing operations behind the note-editing slice interface.
- Emit note-editing events (for example `noteEditing:headingAdded`) that other slices may consume.

### View Integration Slice

- Orchestrator slice: [`ViewIntegrationSlice.ts`](src/features/view-integration/ViewIntegrationSlice.ts)
- Helpers:
  - [`DOMAttachmentService.ts`](src/features/view-integration/DOMAttachmentService.ts)
  - [`ViewLifecycleHandler.ts`](src/features/view-integration/ViewLifecycleHandler.ts)
  - [`ViewManager.ts`](src/features/view-integration/ViewManager.ts)

Responsibilities:

- Manage creation, attachment, and cleanup of views.
- Coordinate lifecycle events between the plugin orchestrator and feature slices.

### Shared Contracts

Shared contracts live under `src/features/shared-contracts/` and define:

- Plugin settings and interfaces: [`plugin.ts`](src/features/shared-contracts/plugin.ts)
- Slice contracts: [`slice-interfaces.ts`](src/features/shared-contracts/slice-interfaces.ts)
- Event contracts: [`events.ts`](src/features/shared-contracts/events.ts)

These contracts keep slices loosely coupled while preserving type safety.

### Shared UI Primitives

Shared UI helpers live in `src/shared/ui/` and are used for plugin-scoped, in-view UI (headers, controls, panels):

- [`Button.ts`](src/shared/ui/Button.ts) — helper for text+icon buttons.
- [`IconButton.ts`](src/shared/ui/IconButton.ts) — helper for icon-only buttons.
- [`Dropdown.ts`](src/shared/ui/Dropdown.ts) — helper for Coalesce-styled `<select>` controls.
- [`Panel.ts`](src/shared/ui/Panel.ts) — helper for standard panels and containers.

The Obsidian settings tab continues to use Obsidian’s `Setting` API directly in [`SettingsUI.ts`](src/features/settings/SettingsUI.ts). This is an intentional exception; all other plugin UI should prefer the shared primitives to ensure consistent styling and behavior.