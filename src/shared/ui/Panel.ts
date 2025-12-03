import { hasCreateDiv, ObsidianHTMLElement } from '../type-utils';

export interface PanelOptions {
    parent: HTMLElement;
    /**
     * Additional classes to apply to the panel.
     * The base class `coalesce-panel` is always applied.
     */
    classes?: string[];
    /**
     * Optional ARIA role for the panel container.
     */
    role?: string;
    /**
     * Optional accessible label for screen readers.
     */
    ariaLabel?: string;
}

/**
 * createPanel
 *
 * Creates a Coalesce-styled panel inside the given parent element.
 * This is a thin helper around Obsidian's createDiv / DOM APIs that
 * standardizes padding, border, and basic layout for header/blocks UI.
 */
export function createPanel(options: PanelOptions): HTMLDivElement {
    const { parent, classes = [], role, ariaLabel } = options;

    const className = ['coalesce-panel', ...classes].join(' ');

    // Prefer Obsidian's createDiv helper when available
    let panel: HTMLDivElement;
    if (hasCreateDiv(parent)) {
        const created = parent.createDiv({
            cls: className
        });
        panel = created;
    } else {
        panel = document.createElement('div');
        panel.className = className;
        // TypeScript needs explicit type here - parent is HTMLElement in else branch
        (parent as HTMLElement).appendChild(panel);
    }

    if (role) {
        panel.setAttribute('role', role);
    }

    if (ariaLabel) {
        panel.setAttribute('aria-label', ariaLabel);
    }

    return panel;
}