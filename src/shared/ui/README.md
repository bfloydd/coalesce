# Coalesce Shared UI Primitives

This package contains thin, DOM-based helpers for constructing UI elements in a consistent, accessible way without introducing a full component framework.

## Goals

- Reduce duplication when creating buttons, icon buttons, and layout panels.
- Keep styling and behavior consistent across slices.
- Integrate cleanly with Obsidian's `createEl` / `createDiv` helpers.
- Keep all components framework-free (plain DOM + CSS).

Current primitives:

- `Button` helper: `src/shared/ui/Button.ts`
- `IconButton` helper: `src/shared/ui/IconButton.ts`
- `Panel` helper: `src/shared/ui/Panel.ts`

---

## Button

**File**: `src/shared/ui/Button.ts`  
**Base classes**: `.coalesce-btn`, `.coalesce-btn-{variant}`

```ts
import { createButton } from 'src/shared/ui/Button';

const button = createButton({
  parent: containerEl,
  label: 'Sort',
  onClick: () => { /* ... */ },
  variant: 'ghost',          // 'primary' | 'secondary' | 'ghost' (default)
  ariaLabel: 'Sort backlinks',
  icon: 'sort',              // IconProvider icon name
  iconSize: 'sm',            // optional, defaults to 'sm'
  classes: ['coalesce-sort-button']
});
```

### Behavior

- Uses `parent.createEl('button', ...)` when available, falls back to `document.createElement('button')`.
- Always sets:
  - `type="button"` to avoid form submission side effects.
  - `aria-label` based on `ariaLabel ?? label`.
- Applies CSS classes:
  - `coalesce-btn`
  - `coalesce-btn-{variant}`
  - any extra `classes` provided.
- Integrates with CSS in `styles/components/header.css` for consistent spacing, font size, and hover styles.

Use this for **text + icon** buttons such as:

- Sort direction toggles.
- Primary actions in headers or panels.

---

## IconButton

**File**: `src/shared/ui/IconButton.ts`  
**Base class**: `.coalesce-icon-button`

```ts
import { createIconButton } from 'src/shared/ui/IconButton';

const iconButton = createIconButton({
  parent: containerEl,
  icon: 'settings',
  size: 'sm',
  ariaLabel: 'Open Coalesce settings',
  classes: ['coalesce-settings-button'],
  onClick: (event) => {
    event.stopPropagation();
    // ...
  }
});
```

### Behavior

- Uses `parent.createEl('button', ...)` when available, with:
  - `type="button"`.
  - `aria-label` from the required `ariaLabel` option.
- Applies classes:
  - `coalesce-icon-button`
  - any extra `classes`.
- Uses `IconProvider.setIcon` to attach the SVG icon.
- CSS in `styles/components/header.css` sets standard icon sizes and padding.

Use this for **icon-only** controls such as:

- Collapse/expand all.
- Settings / overflow menus.
- Small inline icon actions.

---

## Panel

**File**: `src/shared/ui/Panel.ts`  
**Base class**: `.coalesce-panel`

```ts
import { createPanel } from 'src/shared/ui/Panel';

const headerPanel = createPanel({
  parent: containerEl,
  classes: ['coalesce-backlinks-header-panel'],
  role: 'group',
  ariaLabel: 'Backlinks header and controls'
});

// Add header content inside the panel
headerPanel.appendChild(headerEl);
```

### Behavior

- Uses `parent.createDiv({ cls: 'coalesce-panel ...' })` when available, otherwise falls back to `document.createElement('div')`.
- Always includes the `coalesce-panel` class plus any additional `classes`.
- Optionally sets:
  - `role` (e.g. `"group"`, `"region"`).
  - `aria-label` for screen reader context.

Use this when you need a **standard container** with consistent padding/border behavior (for example, wrapping header controls or block-level UI) instead of hand-rolled `<div>`s.

---

## Styling

Shared UI primitives rely on CSS defined in:

- `styles/components/header.css`
- `styles/components/blocks.css`

Key classes:

- `.coalesce-btn`
- `.coalesce-btn-primary`
- `.coalesce-btn-secondary`
- `.coalesce-btn-ghost`
- `.coalesce-icon-button`
- `.coalesce-panel`

These rules provide:

- Consistent padding, border radius, and font size.
- Hover and active states aligned with Obsidian tokens.
- Standardized icon sizes via `var(--coalesce-icon-size-*)`.

When introducing a new shared helper, prefer:

- A `coalesce-*` class prefix for all plugin-specific styling.
- Adding any necessary styles to the closest relevant CSS component file (e.g. `header.css` for header-related controls).

---

## Usage Guidelines

1. **Prefer shared helpers over ad-hoc DOM code** for:
   - Buttons and icon buttons.
   - Common layout wrappers that repeat across slices.

2. **Accessibility**:
   - Always provide a meaningful `ariaLabel` for icon-only buttons.
   - Use `role` / `aria-label` on panels when they group related controls.

3. **Class naming**:
   - Use descriptive, prefixed class names:
     - `coalesce-...` for plugin UI elements.
     - `is-*` / `has-*` / `no-*` for state classes (e.g. `is-collapsed`, `has-alias`, `no-alias`).

4. **Where to add new styles**:
   - Header-related elements: `styles/components/header.css`.
   - Block-related elements: `styles/components/blocks.css`.
   - Other components: the most relevant file under `styles/components/`.

Following these guidelines keeps the UI consistent across the plugin and aligns with the clean-code and CSS modularization goals described in `CLEAN_CODE_ANALYSIS.md`.