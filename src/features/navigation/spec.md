# Navigation Slice Specification

## Overview
Handles file opening and linking, navigation event handling for the Coalesce plugin.

## Responsibilities
- File opening and linking, navigation event handling
- Cross-file navigation, link click handling

## Features
- Opening a path (current tab or new tab), handling navigation events from components, dispatching to Obsidian API

## Source
- Extracted from link click handlers throughout the codebase

## Key Classes
- NavigationService, LinkHandler, FileOpener

## Ownership Boundaries
- **Owns**: Opening a path (current tab or new tab), handling navigation events from components, dispatching to Obsidian API.
- **Consumes**: SharedContracts (types), SharedUtilities (logging).
- **Out-of-scope**: Backlink discovery, block extraction, UI rendering.