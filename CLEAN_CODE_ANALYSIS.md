# Clean Code Analysis & Upgrade Plan: Obsidian Coalesce Plugin

## Executive Summary

This document presents a comprehensive clean code analysis of the Obsidian Coalesce plugin, a TypeScript-based plugin that displays backlinked notes in a consolidated view. The analysis identifies areas where the codebase deviates from clean code principles and provides a structured upgrade plan to improve maintainability, testability, and performance.

**Key Findings:**
- Strong architectural foundation with vertical slice architecture
- Good TypeScript usage and interface design
- Several violations of Single Responsibility Principle
- Mixed logging approaches and inline styles
- Opportunities for improved error handling and testing

## Current Architecture Assessment

### Strengths
- **Vertical Slice Architecture**: Well-implemented with clear separation of concerns through slices
- **TypeScript Best Practices**: Comprehensive type definitions and interface usage
- **Plugin Orchestrator Pattern**: Clean coordination between components
- **Proper Dependency Injection**: Clear dependency management in slice initialization
- **Testing Infrastructure**: Jest setup with good unit test coverage

### Areas of Concern

#### 1. Single Responsibility Principle Violations
- **BacklinksSlice.ts** (1493 lines): Handles backlinks discovery, block rendering, header UI, and state management
- **main.ts** (556 lines): Plugin initialization, event handling, and debug methods
- **types.ts** (689 lines): Single file containing all type definitions

#### 2. Code Quality Issues
- Mixed logging approaches (console.log alongside Logger class)
- Inline styles in JavaScript (`addNoBacklinksMessage` method)
- Large methods violating function length limits
- Complex state management with multiple Map objects

#### 3. Testing & Quality Assurance
- Good unit test coverage for core functionality
- Limited integration testing between slices
- No component testing for UI elements
- Minimal error boundary testing

#### 4. Performance & Maintainability
- Large CSS file (944 lines) could benefit from modularization
- Inline style definitions reduce maintainability
- Potential memory leaks with event listeners
- Complex DOM manipulation logic

## Detailed Clean Code Violations

### SOLID Principles Violations

#### Single Responsibility Principle (SRP)
```typescript
// VIOLATION: BacklinksSlice handles too many responsibilities
export class BacklinksSlice implements IBacklinksSlice {
    // Backlink discovery logic
    async updateBacklinks(filePath: string): Promise<string[]>

    // Block rendering logic
    async extractAndRenderBlocks(...): Promise<void>

    // Header UI logic
    private createHeader(...): HTMLElement

    // Navigation logic
    handleNavigation(filePath: string): void

    // State management
    private currentBacklinks: Map<string, string[]>
    private currentBlocks: Map<string, BlockData[]>
    private attachedViews: Map<string, { container: HTMLElement; lastUpdate: number }>
}
```

#### Open/Closed Principle (OCP)
- Classes are not easily extensible without modification
- Strategy pattern usage is good but could be more flexible

### Clean Code Violations

#### Function Length & Complexity
```typescript
// VIOLATION: Method too long and complex
async attachToDOM(view: MarkdownView, currentNotePath: string): Promise<boolean> {
    // 169 lines of complex DOM manipulation, state management, and error handling
}
```

#### Mixed Abstractions
```typescript
// VIOLATION: Console logging mixed with proper logging
console.log('Coalesce: BacklinksSlice.attachToDOM called for', currentNotePath);
this.logger.debug('Attaching backlinks UI to view', { currentNotePath });
```

#### Inline Styles
```typescript
// VIOLATION: Inline styles in JavaScript
messageElement.style.cssText = `
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    // ... more styles
`;
```

## Upgrade Plan

### Phase 1: Immediate Improvements (1-2 days)

#### Priority 1: Remove Inline Styles
**Effort**: 2 hours
**Impact**: High

**Tasks:**
- [x] Extract inline styles from `BacklinksSlice.addNoBacklinksMessage()` to CSS classes
- [x] Create `.coalesce-no-backlinks-message` CSS class
- [x] Update method to use `classList.add()`

**Before:**
```typescript
messageElement.style.cssText = `padding: 16px; text-align: center; ...`;
```

**After:**
```typescript
messageElement.className = 'coalesce-no-backlinks-message';
```

#### Priority 2: Implement Error Boundaries
**Effort**: 4 hours
**Impact**: High

**Tasks:**
- [x] Create `withErrorBoundary` method for slice operations
- [x] Add try-catch blocks to all public slice methods
- [x] Implement proper error logging with context
- [x] Add error recovery mechanisms

**Implementation:**
```typescript
private async withErrorBoundary<T>(
    operation: () => Promise<T>,
    context: string
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        this.logger.logErrorWithContext(error, context);
        throw error;
    }
}
```

#### Priority 3: Standardize Logging
**Effort**: 4 hours
**Impact**: Medium

**Tasks:**
- [x] Remove all `console.log` statements from production code
- [x] Replace with proper Logger calls
- [x] Implement debug mode for development logging (Logger class handles log levels)
- [x] Add structured logging for better debugging
- [x] Fix global logging state management for settings integration
- [x] Add fallback logger for initialization edge cases

### Phase 2: Structural Refactoring (3-5 days)

#### Priority 4: Break Down BacklinksSlice
**Effort**: 1-2 days
**Impact**: High

**Current State (Before Refactor)**

- [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:33) currently coordinates:
  - Backlink discovery & cache (`updateBacklinks`, `discoverBacklinks`, `getCachedBacklinks`, `clearCache`, `getBacklinkMetadata`, `haveBacklinksChanged`, `invalidateCache`, `clearBacklinks`)
  - Block extraction & rendering (`extractAndRenderBlocks`, block sorting/collapse/text filtering helpers)
  - Header UI wiring and state (`createHeader`, `handleSortToggle`, `handleCollapseToggle`, …, `updateHeaderState`, `applyCurrentOptions`)
  - Navigation (`handleNavigation`)
  - Event emission (`emitEvent`, `addEventListener`, `removeEventListener`)
  - Lifecycle (`cleanup`, `removeAttachment`, `requestFocusWhenReady`)

Supporting classes already exist as separate modules and are reused by the slice:

- [`BacklinkDiscoverer.ts`](src/features/backlinks/BacklinkDiscoverer.ts:13)
- [`BacklinkCache.ts`](src/features/backlinks/BacklinkCache.ts)
- [`LinkResolver.ts`](src/features/backlinks/LinkResolver.ts)
- [`BlockExtractor.ts`](src/features/backlinks/BlockExtractor.ts)
- [`BlockRenderer.ts`](src/features/backlinks/BlockRenderer.ts:14)
- [`StrategyManager.ts`](src/features/backlinks/StrategyManager.ts:10)
- [`HeaderUI.ts`](src/features/backlinks/HeaderUI.ts:14)
- [`FilterControls.ts`](src/features/backlinks/FilterControls.ts)
- [`SettingsControls.ts`](src/features/backlinks/SettingsControls.ts)

The remaining problem is that [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:33) still mixes orchestration with UI state, domain state, and event handling in one large class.

**Target Design**

Introduce three focused layers under `src/features/backlinks/`:

1. **Core / Domain layer**

   - [`core/BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts)
     Owns backlink discovery & cache orchestration. Wraps [`BacklinkDiscoverer.ts`](src/features/backlinks/BacklinkDiscoverer.ts:13), [`BacklinkCache.ts`](src/features/backlinks/BacklinkCache.ts), and [`LinkResolver.ts`](src/features/backlinks/LinkResolver.ts).
     Public API (no DOM access):

     - `updateBacklinks(filePath: string, leafId?: string): Promise<string[]>`
     - `discoverBacklinks(filePath: string): Promise<string[]>`
     - `getCurrentBacklinks(filePath: string): string[]`
     - `getCachedBacklinks(filePath: string): string[] | null`
     - `clearCache(filePath?: string): void`
     - `invalidateCache(filePath: string): void`
     - `clearBacklinks(): void`
     - `getBacklinkMetadata(): BacklinkMetadata`
     - `haveBacklinksChanged(filePath: string, newBacklinks: string[]): boolean`
     - `getStatistics(): BacklinkStatistics`

   - [`core/BacklinksState.ts`](src/features/backlinks/core/BacklinksState.ts)
     Encapsulates Maps and statistics currently on [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:41) (`currentBacklinks`, `currentBlocks`, `attachedViews`, `headerStatistics`, etc.).
     Provides small, intention‑revealing methods instead of exposing raw Maps, for example:

     - `setBacklinks(filePath, backlinks)`, `getBacklinks(filePath)`, `clearBacklinks()`
     - `setBlocks(noteName, blocks)`, `getBlocks(noteName)`
     - `trackAttachment(viewId, container, timestamp)`, `getAttachment(viewId)`, `removeAttachment(viewId)`

   - [`core/BacklinksEvents.ts`](src/features/backlinks/core/BacklinksEvents.ts)
     Extracts `eventHandlers` and `emitEvent` / `addEventListener` / `removeEventListener` from [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:1357).
     Provides a typed event facade independent of DOM but reusing existing event types from [`src/features/shared-contracts/events.ts`](src/features/shared-contracts/events.ts).

2. **UI / View layer**

   - [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts)
     Owns everything that touches DOM/Obsidian views:

     - `attachToDOM(view: MarkdownView, currentNotePath: string, forceRefresh = false): Promise<boolean>`
     - `requestFocusWhenReady(leafId: string): void`
     - Header handlers: `handleSortToggle`, `handleCollapseToggle`, `handleStrategyChange`,
       `handleThemeChange`, `handleHeaderStyleChange`, `handleAliasSelection`,
       `handleFilterChange`, `handleSettingsClick`
     - Block & theme helpers: `extractAndRenderBlocks`, `applySortingToDOM`,
       `applyCollapseStateToDOM`, `applyThemeToContainer`, `updateBlockTitleDisplay`,
       `filterBlocksByAlias`, `filterBlocksByText`, `applyTextFilterToDOM`,
       `setAllBlocksCollapsed`, `addNoBacklinksMessage`, `applyCurrentOptions`,
       `attachContainerToView`

     Delegates:

     - Core data to [`core/BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts)
     - Rendering to [`BlockRenderer.ts`](src/features/backlinks/BlockRenderer.ts:14)
     - Header elements to [`HeaderUI.ts`](src/features/backlinks/HeaderUI.ts:14), [`FilterControls.ts`](src/features/backlinks/FilterControls.ts), [`SettingsControls.ts`](src/features/backlinks/SettingsControls.ts)
     - Strategy selection to [`StrategyManager.ts`](src/features/backlinks/StrategyManager.ts:10)

   - [`ui/HeaderController.ts`](src/features/backlinks/ui/HeaderController.ts)
     Optional thin wrapper around [`HeaderUI.ts`](src/features/backlinks/HeaderUI.ts:14) that:

     - Owns `HeaderState` and `HeaderStatistics`
     - Provides high‑level operations: `createHeaderForBacklinks`, `updateHeaderForState`,
       `notifySortToggled`, `notifyCollapseToggled`, etc.

     This keeps header‑specific state out of [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts).

3. **Coordinator layer**

   - [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:33) (coordinator only)
     Still implements `IBacklinksSlice` but delegates all work:

     - `discoverBacklinks`, `getCachedBacklinks`, `clearCache`, `getBacklinkMetadata`,
       `haveBacklinksChanged` → [`core/BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts)
     - `attachToDOM`, `setOptions`, `requestFocusWhenReady` → [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts)
     - `handleNavigation` → a small navigation helper (or reuse the existing navigation slice)
     - Event methods (`addEventListener` / `removeEventListener`) → [`core/BacklinksEvents.ts`](src/features/backlinks/core/BacklinksEvents.ts)
     - Lifecycle `cleanup` → forwards to core, UI, and events

**Refactor Tasks (Incremental Plan)**

- [x] **Step 1 – Extract core service**
  - [x] Create [`core/BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts) and move:
    - `updateBacklinks`, `discoverBacklinks`, `getCurrentBacklinks`, `getCachedBacklinks`,
      `clearCache`, `invalidateCache`, `clearBacklinks`, `getBacklinkMetadata`,
      `haveBacklinksChanged`, `getStatistics`
  - [x] Introduce [`core/BacklinksState.ts`](src/features/backlinks/core/BacklinksState.ts) to hold `currentBacklinks` and cache‑related metadata
  - [x] Update [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:35) to call the core service while keeping the public `IBacklinksSlice` API stable
  - [x] Add unit tests for [`core/BacklinksCore.ts`](src/features/backlinks/core/BacklinksCore.ts) (see [`BacklinksCore.test.ts`](src/features/backlinks/__tests__/BacklinksCore.test.ts:1))

- [x] **Step 2 – Extract event facade**
  - [x] Move `eventHandlers` and `emitEvent` / `addEventListener` / `removeEventListener` into [`core/BacklinksEvents.ts`](src/features/backlinks/core/BacklinksEvents.ts)
  - [x] Keep the same event types from [`src/features/shared-contracts/events.ts`](src/features/shared-contracts/events.ts)
  - [x] Update [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:35) to delegate to the event facade

- [x] **Step 3 – Extract view controller**
  - [x] Create [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts) and move:
    - `attachToDOM`, `requestFocusWhenReady`
    - Header handler methods: `handleSortToggle`, `handleCollapseToggle`, `handleStrategyChange`,
      `handleThemeChange`, `handleHeaderStyleChange`, `handleAliasSelection`,
      `handleFilterChange`, `handleSettingsClick`
    - Block & theme helpers: `extractAndRenderBlocks`, `applySortingToDOM`,
      `applyCollapseStateToDOM`, `applyThemeToContainer`, `updateBlockTitleDisplay`,
      `filterBlocksByAlias`, `filterBlocksByText`, `applyTextFilterToDOM`,
      `setAllBlocksCollapsed`, `addNoBacklinksMessage`, `applyCurrentOptions`,
      `attachContainerToView`
  - [x] Keep [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts) free of plugin lifecycle concerns (it just needs `App`, `MarkdownView`, and DOM)

- [ ] **Step 4 – Header controller & state cleanup**
  - [ ] Optionally introduce [`ui/HeaderController.ts`](src/features/backlinks/ui/HeaderController.ts) to own `HeaderState` and `HeaderStatistics`, reducing the state surface area on [`ui/BacklinksViewController.ts`](src/features/backlinks/ui/BacklinksViewController.ts)
  - [ ] Ensure header state is the single source of truth for sorting, collapse, strategy, theme, alias, and filter options

- [ ] **Step 5 – Finalize coordinator**
  - [ ] Slim down [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:33) to a small class that wires:
    - Constructor dependencies (`App`, `Logger`, core services, UI controller)
    - Public `IBacklinksSlice` methods delegating to core/UI/events/navigation
    - `cleanup` delegating to owned components
  - [ ] Keep existing integration tests (for example, [`BacklinksSlice.integration.test.ts`](src/features/backlinks/__tests__/BacklinksSlice.integration.test.ts)) focused on the end‑to‑end workflow, while new unit tests cover each extracted component

**Updated Target Structure (Post‑Refactor)**

```text
src/features/backlinks/
├── core/
│   ├── BacklinksCore.ts
│   ├── BacklinksState.ts
│   ├── BacklinksEvents.ts
│   ├── BacklinkDiscoverer.ts
│   ├── BacklinkCache.ts
│   └── LinkResolver.ts
├── ui/
│   ├── BacklinksViewController.ts
│   ├── HeaderController.ts
│   ├── BlockRenderer.ts
│   ├── HeaderUI.ts
│   ├── FilterControls.ts
│   └── SettingsControls.ts
├── BacklinksSlice.ts   (orchestrator / IBacklinksSlice implementation)
├── StrategyManager.ts
├── BlockExtractor.ts
└── types.ts
```

This refined plan turns [`BacklinksSlice.ts`](src/features/backlinks/BacklinksSlice.ts:33) into a thin orchestrator, concentrates domain logic in the `core` layer, and isolates DOM‑heavy code in the `ui` layer, improving SRP, testability, and future extensibility.

#### Priority 5: Enhance Testing Coverage
**Effort**: 1 day
**Impact**: Medium

**Goals:**
- Validate the new core/domain layer ([`BacklinksCore`](src/features/backlinks/core/BacklinksCore.ts:1), [`BacklinksState`](src/features/backlinks/core/BacklinksState.ts:1), [`BacklinksEvents`](src/features/backlinks/core/BacklinksEvents.ts:1)) in isolation
- Preserve existing observable behaviour of [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35) via integration tests
- Add confidence around error boundaries and DOM/UI behaviour without brittle tests

**Tasks:**
- [x] **Strengthen integration tests for slice interactions**
  - [x] Expand [`BacklinksSlice.integration.test.ts`](src/features/backlinks/__tests__/BacklinksSlice.integration.test.ts:1) to cover:
    - [x] `discoverBacklinks` → `attachToDOM` → user interaction (sort/collapse/filter) → navigation event emission (see navigation event test using `.coalesce-block-title` and `coalesce-navigate`)
    - [x] Cache behaviour (first call discovers, second call uses cache) via [`BacklinksCore`](src/features/backlinks/core/BacklinksCore.ts:1) and [`BacklinksSlice`](src/features/backlinks/__tests__/BacklinksSlice.integration.test.ts:1)
    - [x] Settings-driven options (`sort`, `collapsed`, `theme`) applied through `setOptions` after `attachToDOM` (see [`BacklinksSlice.integration.test.ts`](src/features/backlinks/__tests__/BacklinksSlice.integration.test.ts:1))
- [x] **Add unit tests for core/domain layer**
  - [x] Create focused tests for [`BacklinksCore`](src/features/backlinks/core/BacklinksCore.ts:1) that verify:
    - Daily note skipping
    - Cache hit/miss behaviour and `getBacklinkMetadata`
    - `haveBacklinksChanged` semantics for order-insensitive comparison
    - Emission of `backlinks:updated` via [`BacklinksEvents`](src/features/backlinks/core/BacklinksEvents.ts:1)
  - [x] Add tests for [`BacklinksState`](src/features/backlinks/core/BacklinksState.ts:1) (backlinks/blocks/attachments/header state helpers) in [`BacklinksState.test.ts`](src/features/backlinks/__tests__/BacklinksState.test.ts:1)
- [x] **Create component tests for UI elements**
  - [x] Add JSDOM-based tests for [`HeaderUI`](src/features/backlinks/HeaderUI.ts:14) and [`BlockRenderer`](src/features/backlinks/BlockRenderer.ts:14) to verify:
    - Correct creation of header controls (sort, collapse, strategy, theme, filter, alias, settings) via [`HeaderUI.test.ts`](src/features/backlinks/__tests__/HeaderUI.test.ts:1)
    - DOM class changes for sort/collapse/compact states via [`HeaderUI.test.ts`](src/features/backlinks/__tests__/HeaderUI.test.ts:1)
    - Basic rendering and DOM/state updates for backlink blocks (visibility, collapsed state, alias/text filters) via [`BlockRenderer.test.ts`](src/features/backlinks/__tests__/BlockRenderer.test.ts:1)
- [x] **Add error boundary testing**
  - [x] Add tests that force failures inside `updateBacklinks` / `attachToDOM` and assert that `withErrorBoundary` in [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:377) logs via `logErrorWithContext` and rethrows in a predictable way (see [`BacklinksSlice.errorBoundary.test.ts`](src/features/backlinks/__tests__/BacklinksSlice.errorBoundary.test.ts:1))
- [x] **Introduce lightweight performance smoke tests**
  - [x] Add Jest-based performance checks using [`PerformanceMonitor`](src/features/shared-utilities/PerformanceMonitor.ts:1) with synthetic operations to assert that:
    - `measureSync` / `measureAsync` emit `logPerformance` with non-negative durations and metadata (see [`PerformanceMonitor.test.ts`](src/features/shared-utilities/__tests__/PerformanceMonitor.test.ts:1))
    - Errors are logged with `errorName` / `errorMessage` and rethrown in a predictable way
  - [ ] (Optional) Add higher-level “N synthetic blocks / synthetic vault” smoke tests around [`BlockRenderer`](src/features/backlinks/BlockRenderer.ts:14) and [`BacklinkDiscoverer`](src/features/backlinks/BacklinkDiscoverer.ts:13) with generous thresholds if future regressions warrant it

**Example Integration Test:**
```typescript
describe('BacklinksSlice Integration', () => {
    it('should handle full backlinks workflow', async () => {
        // Test discovery -> rendering -> user interaction flow
    });
});
```

#### Priority 6: Improve ESLint Configuration
**Effort**: 2 hours
**Impact**: Low

**Current State:**
- Project uses a shared ESLint config in [`.eslintrc`](.eslintrc:1) with TypeScript support.
- Complexity and function-length limits are now enforced for feature code, along with stricter TypeScript rules and import ordering.

**Tasks:**
- [x] Add complexity rules (max cyclomatic complexity) for feature code
  - Target: `"complexity": ["error", 10]` applied to `src/features/**/*.ts`
  - Focus on catching regressions in refactored files like [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:35) and [`BacklinksCore`](src/features/backlinks/core/BacklinksCore.ts:1)
- [x] Add function length limits
  - Target: `"max-lines-per-function": ["error", 50]` with exceptions for test files under `src/**/__tests__/**`
  - Use ESLint overrides if needed to keep integration tests readable
- [x] Enable more TypeScript strict rules
  - Tighten `@typescript-eslint` rules in [`.eslintrc`](.eslintrc:1) to discourage:
    - `any` in production code (allow in typed event payloads only)
    - Unused variables and parameters in feature slices
- [x] Add import organization rules
  - Enforce consistent import ordering and grouping to keep slices readable
  - Use `"import/order"` with groups `["builtin", "external", "internal"]` and alphabetical ordering within groups

**Enhanced .eslintrc:**
```json
{
    "rules": {
        "complexity": ["error", 10],
        "max-lines-per-function": ["error", 50],
        "@typescript-eslint/no-explicit-any": "error",
        "import/order": ["error", { "groups": ["builtin", "external", "internal"] }]
    }
}
```

### Phase 3: Advanced Improvements (1-2 weeks)

#### Priority 7: CSS Modularization
**Effort**: 3–5 days
**Impact**: Medium

**Goals:**
- Align styles with the vertical slices (backlinks/header/blocks/settings).
- Preserve compatibility with Obsidian’s dark/light + community themes.
- Make it safe to iterate on UI without style regressions.

**Planned Structure (no change to final bundle path):**
```text
styles/
├── base/
│   ├── variables.css     # plugin-scoped CSS custom properties
│   └── reset.css         # minimal reset for .coalesce-* elements
├── components/
│   ├── backlinks.css     # list layout, container, no-backlinks message
│   ├── header.css        # header layout and controls
│   ├── blocks.css        # individual backlink block styling
│   └── settings.css      # any in-view settings UI
└── themes/
    ├── default.css       # default plugin theme (derived from Obsidian tokens)
    ├── compact.css       # denser layout variant
    └── modern.css        # experimental / advanced variant
```

**Tasks:**
- [x] Introduce CSS module layout
  - [x] Create [`styles/base/variables.css`](styles/base/variables.css:1) with plugin-level CSS variables, e.g.:
    ```css
    :root {
      --coalesce-header-bg: var(--background-primary-alt);
      --coalesce-header-border: var(--background-modifier-border);
      --coalesce-text-muted: var(--text-muted);
      --coalesce-accent: var(--interactive-accent);
    }

    .theme-dark {
      --coalesce-header-bg: var(--background-secondary);
    }

    .theme-light {
      --coalesce-header-bg: var(--background-primary-alt);
    }
    ```
  - [x] Create [`styles/base/reset.css`](styles/base/reset.css:1) with minimal, component-scoped resets for `.coalesce-*` (no global resets).
  - [x] Create component files under `styles/components/`:
    - [`styles/components/backlinks.css`](styles/components/backlinks.css:1)
    - [`styles/components/header.css`](styles/components/header.css:1)
    - [`styles/components/blocks.css`](styles/components/blocks.css:1)
    - [`styles/components/settings.css`](styles/components/settings.css:1)
  - [x] Wire modular CSS sources into the build and dev pipelines so they are concatenated and output as a single `styles.css`/`dist/styles.css` bundle, keeping the runtime surface to one stylesheet.

- [x] Incrementally migrate existing rules from [`styles.css`](styles.css:1)
  - [x] Move backlinks container and list styles into [`styles/components/backlinks.css`](styles/components/backlinks.css:1) (selectors like `.coalesce-custom-backlinks-container`, `.backlinks-list`, `.coalesce-no-backlinks-message`).
  - [x] Move header-related styles (logo, filter, alias dropdown, buttons) into [`styles/components/header.css`](styles/components/header.css:1) aligned with [`HeaderComponent`](src/features/backlinks/HeaderComponent.ts:10) and [`HeaderUI`](src/features/backlinks/HeaderUI.ts:14).
  - [x] Move block styles (block container, toggle arrow, title, content) into [`styles/components/blocks.css`](styles/components/blocks.css:1) aligned with [`BlockComponent`](src/features/backlinks/BlockComponent.ts:1).
  - [x] Move any embedded settings styles (if present) into [`styles/components/settings.css`](styles/components/settings.css:1).

- [x] Add theme-specific overrides
  - [x] Provide theme styles in [`styles/themes/default.css`](styles/themes/default.css:1), [`styles/themes/compact.css`](styles/themes/compact.css:1), [`styles/themes/modern.css`](styles/themes/modern.css:1), and [`styles/themes/naked.css`](styles/themes/naked.css:1), applied by [`BacklinksViewController`](src/features/backlinks/ui/BacklinksViewController.ts:1) via container theme classes (e.g. `theme-default`, `theme-compact`, `theme-modern`, `theme-naked`).
  - [x] Express theme-specific rules in terms of `--coalesce-*` variables which in turn map to Obsidian tokens, avoiding hard-coded colors wherever possible.

- [x] Add CSS linting and safety rails
  - [x] Introduce a lightweight CSS lint configuration (`stylelint` + [`.stylelintrc.json`](.stylelintrc.json:1)) scoped to `styles/**/*.css` to enforce:
    - No ID selectors in plugin CSS.
    - A small, explicit set of allowed class prefixes for plugin and layout classes (`coalesce-`, `backlinks-`, `markdown-`, `theme-`, `is-`, `has-`, `no-`).
  - [x] Add a simple “unused selector” check via `npm run lint:css:unused` using [`scripts/check-unused-css.mjs`](scripts/check-unused-css.mjs:1), which heuristically reports plugin-scoped CSS classes not referenced in `src/**/*.ts`/`.js` files (informational only; does not fail the build).

This plan keeps the runtime surface unchanged (still a single `dist/styles.css`) while making the CSS layout more modular and slice-aware.

#### Priority 8: Performance Monitoring
**Effort**: 2 days
**Impact**: Medium

**Goals:**
- Get cheap, structured performance signals in development and debug mode.
- Avoid polluting feature code with ad-hoc `performance.now()` calls.
- Keep overhead near-zero when monitoring is disabled.

**Design:**

- Add [`PerformanceMonitor`](src/features/shared-utilities/PerformanceMonitor.ts:1) in the shared utilities slice.
- Use the existing [`Logger`](src/features/shared-utilities/Logger.ts:1) to emit performance events, rather than introducing a new channel.
- Gate monitoring behind a settings flag (e.g. `enablePerformanceLogging`) and/or log level, so production users pay almost nothing.

**Tasks:**
- [x] Implement PerformanceMonitor utility
  - [x] Create [`PerformanceMonitor`](src/features/shared-utilities/PerformanceMonitor.ts:1) with:
    ```typescript
    export class PerformanceMonitor {
      constructor(
        private readonly logger: Logger,
        private readonly enabled: () => boolean
      ) {}

      async measureAsync<T>(
        label: string,
        operation: () => Promise<T>,
        meta: Record<string, unknown> = {}
      ): Promise<T> {
        if (!this.enabled()) {
          return operation();
        }

        const start = performance.now();
        try {
          const result = await operation();
          const duration = performance.now() - start;
          this.logger.logPerformance(label, duration, meta);
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          this.logger.logPerformance(label, duration, {
            ...meta,
            errorName: (error as Error).name,
            errorMessage: (error as Error).message
          });
          throw error;
        }
      }

      measureSync<T>(
        label: string,
        operation: () => T,
        meta: Record<string, unknown> = {}
      ): T {
        if (!this.enabled()) {
          return operation();
        }

        const start = performance.now();
        const result = operation();
        const duration = performance.now() - start;
        this.logger.logPerformance(label, duration, meta);
        return result;
      }
    }
    ```
  - [x] Wire `enabled` to logger global state driven by settings:
    - Use `Logger.setGlobalLogging` in [`SettingsSlice.updateLoggingState`](src/features/settings/SettingsSlice.ts:345) so the `enableLogging` setting controls the global logger state.
    - Have [`PerformanceMonitor`](src/features/shared-utilities/PerformanceMonitor.ts:1) instances rely on `Logger.getGlobalLogging().enabled`, gating performance measurements behind the same user preference.

- [x] Integrate monitoring at key boundaries (opt-in)
  - [x] Wrap `updateBacklinks` in [`BacklinksCore`](src/features/backlinks/core/BacklinksCore.ts:1) with `measureAsync('backlinks.update', ...)`.
  - [x] Wrap `extractAndRenderBlocks` in [`BacklinksViewController`](src/features/backlinks/ui/BacklinksViewController.ts:1) with `measureAsync('ui.blocks.extractAndRender', ...)`.
  - [x] Optionally wrap:
    - View initialization in [`ViewIntegrationSlice.initializeView`](src/features/view-integration/ViewIntegrationSlice.ts:21).
    - Navigation path opens in [`NavigationSlice`](src/features/navigation/NavigationSlice.ts:1).

- [ ] Add simple performance “benchmarks” in tests/dev tooling
  - [ ] Add a Jest suite that uses `PerformanceMonitor.measureSync` with synthetic data to assert that:
    - Rendering N synthetic blocks stays under a generous threshold (catching obvious regressions).
    - Discovering backlinks in a synthetic vault doesn’t explode unexpectedly.
  - [ ] Log performance measurements via `Logger.debug` only; do not store them in memory to avoid leaks.

This keeps performance monitoring centralized, optional, and decoupled from feature code while still making it straightforward to instrument critical paths.

#### Priority 9: Shared UI Component Library
**Effort**: 3–5 days
**Impact**: Medium

**Goals:**
- Reduce duplication in DOM creation for buttons, icons, menus, and layout wrappers.
- Make it easier to keep styling and accessibility consistent across the plugin.
- Evolve gradually without rewriting all UI at once.

**Design:**

Introduce a small `src/shared/ui/` package that exposes thin abstractions over DOM creation (not a full component framework). Example structure:

```text
src/shared/ui/
├── Button.ts          # primary / secondary / subtle buttons
├── IconButton.ts      # button with IconProvider-backed SVG
├── Toggle.ts          # pill / toggle-style controls
├── Panel.ts           # container with standard padding/border
└── index.ts
```

Each helper returns native elements (`HTMLButtonElement`, `HTMLDivElement`, etc.) built via Obsidian’s `createEl` / `createDiv` to fit existing code.

**Tasks:**
- [x] Define shared UI primitives
  - [x] Create [`src/shared/ui/Button.ts`](src/shared/ui/Button.ts:1) with a factory like:
    ```typescript
    export interface ButtonOptions {
      label: string;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'ghost';
      ariaLabel?: string;
      icon?: string;
    }

    export function createButton(parent: HTMLElement, options: ButtonOptions): HTMLButtonElement {
      const button = parent.createEl('button', {
        cls: `coalesce-btn coalesce-btn-${options.variant ?? 'ghost'}`,
        attr: { type: 'button', 'aria-label': options.ariaLabel ?? options.label }
      });
      button.textContent = options.label;
      if (options.icon) {
        IconProvider.setIcon(button, options.icon, { size: 'sm' });
      }
      button.addEventListener('click', options.onClick);
      return button;
    }
    ```
  - [x] Create [`src/shared/ui/IconButton.ts`](src/shared/ui/IconButton.ts:1) for icon-only controls (e.g. sort, collapse, settings).
  - [x] Create [`src/shared/ui/Panel.ts`](src/shared/ui/Panel.ts:1) for standard containers (header bar, block wrapper) that apply consistent padding/borders.

- [x] Gradual adoption in existing features
  - [x] Refactor [`SettingsControls`](src/features/backlinks/SettingsControls.ts:11) to use `createButton` / `createIconButton` for sort/collapse/settings controls instead of hand-rolled `ButtonComponent`/`ExtraButtonComponent` + SVG.
  - [x] Refactor [`HeaderComponent`](src/features/backlinks/HeaderComponent.ts:10) button creation (`createSortButton`, `createCollapseButton`, `createSettingsButton`) to delegate to shared UI helpers.
  - [x] Update [`FilterControls`](src/features/backlinks/FilterControls.ts:10) to use the shared filter pattern (wrapper + `.coalesce-filter-input` + `.coalesce-filter-clear-button`) consistent with `HeaderComponent`, giving a unified input+clear experience across code paths.

- [x] Styling & accessibility
  - [x] Map shared UI classes (e.g. `.coalesce-btn`, `.coalesce-icon-button`, `.coalesce-panel`) to rules in [`styles/components/header.css`](styles/components/header.css:74) and [`styles/components/blocks.css`](styles/components/blocks.css:90).
  - [x] Ensure all interactive elements created via shared UI helpers:
    - Have `aria-label` or visible text (see [`createButton`](src/shared/ui/Button.ts:22) and [`createIconButton`](src/shared/ui/IconButton.ts:18)).
    - Use `type="button"` to avoid accidental form behavior.
    - Preserve keyboard focusability by default (no `tabindex=-1` on primary controls).

- [ ] Documentation
  - [ ] Add a short `src/shared/ui/README.md` describing:
    - When to use shared UI primitives vs local DOM code.
    - Example snippets for buttons, icon buttons, and panels.
  - [ ] Update `CLEAN_CODE_ANALYSIS.md` or `ARCHITECTURE.md` to reference the shared UI library as the preferred way to construct new plugin UI.

This gives a pragmatic, incremental path to a shared UI component library aligned with the existing DOM-based codebase and CSS modularization work in Priority 7.

## Implementation Timeline

### Week 1: Foundation
- [x] Complete Phase 1 tasks
- [x] Set up enhanced linting
- [x] Create basic error boundaries

### Week 2: Structure
- [x] Refactor [`BacklinksSlice`](src/features/backlinks/BacklinksSlice.ts:32) (core/events/view controller extraction complete; slice slimmed to a thin orchestrator; optional [`HeaderController`](src/features/backlinks/ui/HeaderController.ts:1) remains a possible future enhancement)
- [x] Implement integration tests ([`BacklinksSlice.integration.test.ts`](src/features/backlinks/__tests__/BacklinksSlice.integration.test.ts:1) and core tests in place)
- [x] Improve logging consistency ([`Logger`](src/features/shared-utilities/Logger.ts:25)-based structured logging and global logging state integration complete)

### Week 3-4: Polish
- [x] CSS modularization (modular CSS files and themes wired into the build producing a single bundle)
- [x] Performance monitoring (PerformanceMonitor + key instrumentation wired to settings-driven global logging, with unit tests in place)
- [ ] UI component library (Button/IconButton adopted; additional primitives, styling hooks, and docs pending)

## Success Metrics

### Code Quality Metrics
- **Cyclomatic Complexity**: Reduce average from current ~15 to <10
- **Function Length**: Keep functions under 50 lines
- **Class Size**: Keep classes under 300 lines
- **Test Coverage**: Maintain >90% coverage

### Maintainability Metrics
- **Technical Debt**: Reduce by 60%
- **Code Duplication**: Eliminate duplicate code patterns
- **Documentation**: 100% API documentation coverage

### Performance Metrics
- **Bundle Size**: No significant increase
- **Memory Usage**: Reduce memory leaks
- **Load Time**: Maintain current performance

## Risk Assessment

### High Risk
- **BacklinksSlice Refactoring**: Large-scale change affecting core functionality
- **CSS Modularization**: Potential styling regressions

### Medium Risk
- **Error Boundary Implementation**: May change error handling behavior
- **Testing Enhancements**: May reveal previously unknown issues

### Low Risk
- **ESLint Configuration**: Minimal impact on functionality
- **Logging Standardization**: Backward compatible changes

## Conclusion

The Obsidian Coalesce plugin has a solid architectural foundation but requires focused improvements to achieve clean code standards. The proposed upgrade plan provides a structured approach to address identified issues while maintaining backward compatibility and performance.

**Recommended Next Steps:**
1. ✅ **Phase 1 Complete** - Immediate improvements implemented
2. **Phase 2 Next** - Begin structural refactoring (Break down BacklinksSlice)
3. Implement changes incrementally with thorough testing
4. Monitor performance and user feedback throughout the process
5. Consider pair programming for complex refactoring tasks

This upgrade will result in more maintainable, testable, and performant code that follows clean code principles and industry best practices.