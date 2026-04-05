# ADR 001: UI Loading & Refresh Behavior

## Status
Accepted

## Context
When users navigate rapidly between notes, or when Obsidian's metadata cache is delayed (e.g. creating a new file), multiple asynchronous requests to render or update the Coalesce UI can fire concurrently for the same markdown view leaf. 

Previously, the plugin handled concurrent requests via two aggressive locks:
1. `processingFiles` (per-file strict drop): Immediately dropped subsequent update calls for a given file.
2. `processingViews` (per-view strict drop): Immediately dropped subsequent update calls for a specific active view pane.

However, this led to "stuck" UI states where rendering requests for a newer note were simply dropped because the system was still blocking from a rapidly preceding click. Additionally, `PluginEvents.ts` was performing its own un-tracked DOM injections that bypassed the internal state tracking dictionary (`lastFilePathByViewId`), causing the view to permanently stick to the original note since it falsely assumed subsequent notes in the same leaf pane were just redundant updates for the original file.

## Decision
1. **Centralized Update Invocation (Removal of event-bypass injections):** Both `file:opened` and `layout:changed` injections inside `PluginEvents.ts` were stripped out and replaced with standard delegations to `PluginViewInitializer`'s `updateForFile()` method. This ensures `lastFilePathByViewId` correctly tracks exactly what node path was last requested and painted per view.
2. **`externalForceRefresh` Flag:** Introduced an override flag into the view initializer. The 100ms fallback timeout, which is triggered by the `active-leaf-change` event, now uses this `externalForceRefresh` flag to forcefully bypass the `1000ms` debounce of `shouldProcessFile()`. This secures repopulation of empty backlinks that initially failed because the metadata cache hadn't fully hydrated upon note entry.
3. **Promise Queuing & Validation replacing Strict Dropping locks:** The aggressive `processingFiles` early return lock was completely removed. `processingViews` now functions as an asynchronous wait queue inside the matching views iterator (`await processingViews.get(viewId)`). Instead of instantly destroying incoming render requests on lock presence, it waits patiently for the active request to complete, and then dynamically verifies `if (view.file.path !== filePath)` before lifting a finger. 
    * If the user clicked to a new note while waiting, the obsolete request cleanly aborts.
    * If the user is currently staring at the note they originally requested, it securely renders it as the final sequence layer.

## Consequences
- **Positive:** UI updates no longer permanently drop and lock up during rapid note switching.
- **Positive:** Fast note creations guarantee that delayed metadata cache population reliably causes the Coalesce view to render upon cache hydration, instead of being blocked by hard debounces.
- **Negative:** Slightly increased complexity involving asynchronous promise queueing and mid-stream promise cancellation validation inside `updateForFile`.
