# Backlinks Slice Specification

## Overview
The Backlinks slice encompasses the full backlinks feature, including discovery, block extraction, display, header controls, and slice-local navigation hooks. This combines the responsibilities of Backlinks, BacklinkBlocks, and BacklinksHeader slices as per Phase 2 consolidation.

## Responsibilities
- **Backlinks Discovery**: Discovers files linking to the active note, resolves links, manages backlink caching and updates
- **Block Extraction**: Extracts blocks from files and renders them for display, handles block boundary strategies, content preparation
- **Header UI Controls**: Header UI controls and user interactions, filtering, sorting, settings controls, theme switching, alias selection
- **Display and Rendering**: Block extraction, block display, content filtering, strategy management, collapsed-state handling, DOM order updates

## Features
- Manages backlink caching and updates, handles resolved/unresolved links
- Block boundary strategies, block extraction, content preparation (headers-only, hide-backlink line, hide-first-header)
- Rendering blocks, collapsed-state handling, DOM order updates
- Header UI (logo/title), filter input, alias selection, sort toggle, collapse toggle, strategy select, theme select, settings popup interactions
- Case-insensitive matching, proper filtering, multiple aliases support
- State persistence for collapsed and sorting

## Source
- Extracted from CoalesceManager's backlink methods, CoalesceView's backlink logic
- Extracted from BlockComponent, block-finders/, header-styles/
- Extracted from HeaderComponent

## Key Classes
- BacklinkDiscoverer, LinkResolver, BacklinkCache
- BlockExtractor, BlockRenderer, StrategyManager
- HeaderUI, FilterControls, SettingsControls, InteractionHandler

## Ownership Boundaries
- **Owns**: Discovery of files linking to the active note from resolved and unresolved link caches, deduplication, change detection, caching policy, emitting updates when backlinks change or when a view is first focused; block boundary strategies, block extraction, content preparation, rendering blocks, collapsed-state handling, DOM order updates; header UI (logo/title), filter input, alias selection, sort toggle, collapse toggle, strategy select, theme select, settings popup interactions.
- **Consumes**: Settings (e.g., onlyDailyNotes), SharedContracts (types), SharedUtilities (logging); Backlinks (list of source files), Settings (header style, strategy flags), SharedUtilities (logging); Settings (current values and saving changes), SharedUtilities (logging).
- **Emits**: backlinks:updated with files list and leaf context; blocks:rendered with counts and leaf context; header:filterChanged, header:sortToggled, header:collapseToggled, header:strategyChanged, header:themeChanged, header:aliasSelected.
- **Out-of-scope**: File editing, generic file CRUD beyond the bounded editing flows defined; header UI controls, theme switching, navigation decision-making (but includes slice-local navigation hooks).

## Existing Features
- When opening a file, backlinks are discovered and displayed in coalesce UI.
- What and how much to show is known as a "block".
- Each file will clear coalesce UI and rebuild it.
- Coalesce UI will display below the text of the note.
- Case-insensitive matching: [[Note|FOO]] matches "foo" selection.
- Proper filtering: Only shows blocks containing the selected alias.
- "All content": Shows all blocks when no alias is selected.
- Multiple aliases: Handles [[Note|alias1|alias2]] syntax.
- "No backlinks found for note" will be displayed when none are found.
- The state of collapsed and sorting will maintain, saved to data.json.
