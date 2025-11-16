# SharedUtilities Slice Specification

## Overview
Provides shared utilities and helper functions used across multiple slices in the Coalesce plugin.

## Responsibilities
- Shared utilities and helper functions
- Logging, daily note detection, common utilities

## Features
- Logger, DailyNote detection and helpers, common helpers reused by multiple slices

## Source
- Extracted from utils/ directory

## Key Classes
- Logger, DailyNote, CommonHelpers

## Ownership Boundaries
- **Owns**: Logger, DailyNote detection and helpers, common helpers reused by multiple slices.
- **Out-of-scope**: Domain decisions, UI, orchestration.