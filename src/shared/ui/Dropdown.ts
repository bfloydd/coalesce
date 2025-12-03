import { hasCreateEl, ObsidianHTMLElement } from '../type-utils';

export interface DropdownItem {
  value: string;
  label: string;
}

/**
 * Options for creating a Coalesce-styled dropdown/select element.
 */
export interface DropdownOptions {
  /**
   * Parent element where the select will be inserted.
   * This can be a wrapper div created by the caller.
   */
  parent: HTMLElement;

  /**
   * List of options to render.
   */
  items: DropdownItem[];

  /**
   * Currently selected value. If omitted, the first item will be selected
   * (or the browser default if no item matches).
   */
  value?: string;

  /**
   * Called whenever the selection changes.
   */
  onChange: (value: string) => void;

  /**
   * Extra CSS classes to apply to the <select> element.
   */
  classes?: string[];

  /**
   * Optional accessible label for screen readers. If provided, will be applied
   * as `aria-label` on the select element.
   */
  ariaLabel?: string;
}

/**
 * createDropdown
 *
 * Creates a Coalesce-styled <select> element inside the given parent element.
 * This helper prefers Obsidian's createEl when available and falls back to
 * document.createElement('select') otherwise.
 */
export function createDropdown(options: DropdownOptions): HTMLSelectElement {
  const { parent, items, value, onChange, classes = [], ariaLabel } = options;

  const className = ['coalesce-dropdown', ...classes].join(' ');

  let select: HTMLSelectElement;
  if (hasCreateEl(parent)) {
    const created = parent.createEl('select', {
      cls: className,
      attr: ariaLabel ? { 'aria-label': ariaLabel } : undefined
    });
    select = created as HTMLSelectElement;
  } else {
    select = document.createElement('select');
    select.className = className;
    if (ariaLabel) {
      select.setAttribute('aria-label', ariaLabel);
    }
    parent.appendChild(select);
  }

  // Clear any existing options
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  // Populate options
  for (const item of items) {
    const optionEl = document.createElement('option');
    optionEl.value = item.value;
    optionEl.textContent = item.label;
    select.appendChild(optionEl);
  }

  // Apply initial value if provided
  if (value !== undefined) {
    select.value = value;
  }

  select.addEventListener('change', (event: Event) => {
    const target = event.target as HTMLSelectElement;
    onChange(target.value);
  });

  return select;
}