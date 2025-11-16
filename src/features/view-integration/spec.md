# ViewIntegration Slice Specification

## Overview
Handles view creation, lifecycle, and DOM attachment for the Coalesce plugin.

## Responsibilities
- Handles view creation, lifecycle, and DOM attachment
- Manages mode switches (edit/preview), focus management, view refreshing

## Features
- Manages mode switches (edit/preview), focus management, view refreshing
- Discovery of MarkdownView instances, container attach/detach, debounce for initialization, focus request timing, handling mode switches and leaf activity, cleanup of orphaned containers

## Source
- Extracted from CoalesceManager's view-related methods

## Key Classes
- ViewManager, ViewLifecycleHandler, DOMAttachmentService

## Ownership Boundaries
- **Owns**: Discovery of MarkdownView instances, container attach/detach, debounce for initialization, focus request timing, handling mode switches and leaf activity, cleanup of orphaned containers.
- **Consumes**: Settings for behavioral flags; Backlinks for data to display; BacklinkBlocks and BacklinksHeader to render; SharedUtilities for logging.
- **Out-of-scope**: Backlink discovery logic, block extraction or rendering details, settings persistence.