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
    const created = (parent as any).createDiv?.({
        cls: className
    }) as HTMLDivElement | undefined;

    const panel = created ?? (() => {
        const div = document.createElement('div');
        div.className = className;
        parent.appendChild(div);
        return div;
    })();

    if (role) {
        panel.setAttribute('role', role);
    }

    if (ariaLabel) {
        panel.setAttribute('aria-label', ariaLabel);
    }

    return panel;
}