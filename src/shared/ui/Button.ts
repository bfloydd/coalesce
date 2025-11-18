import { IconProvider, IconName, IconSize } from '../../features/shared-utilities/IconProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonOptions {
    parent: HTMLElement;
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
    ariaLabel?: string;
    icon?: IconName;
    iconSize?: IconSize;
    classes?: string[];
}

/**
 * createButton
 *
 * Creates a Coalesce-styled button inside the given parent element.
 * Uses Obsidian's HTMLElement.createEl helper and IconProvider for icons.
 */
export function createButton(options: ButtonOptions): HTMLButtonElement {
    const { parent, label, onClick, variant = 'ghost', ariaLabel, icon, iconSize = 'sm', classes = [] } = options;

    const button = (parent as any).createEl?.('button', {
        cls: ['coalesce-btn', `coalesce-btn-${variant}`, ...classes].join(' '),
        attr: {
            type: 'button',
            'aria-label': ariaLabel ?? label
        }
    }) as HTMLButtonElement;

    if (!button) {
        const fallback = document.createElement('button');
        fallback.className = ['coalesce-btn', `coalesce-btn-${variant}`, ...classes].join(' ');
        fallback.type = 'button';
        fallback.setAttribute('aria-label', ariaLabel ?? label);
        fallback.textContent = label;
        fallback.addEventListener('click', onClick);
        parent.appendChild(fallback);
        return fallback;
    }

    button.textContent = label;

    if (icon) {
        IconProvider.setIcon(button, icon, { size: iconSize });
    }

    button.addEventListener('click', onClick);

    return button;
}