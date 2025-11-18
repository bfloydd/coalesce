import { IconProvider, IconName, IconSize } from '../../features/shared-utilities/IconProvider';

export interface IconButtonOptions {
    parent: HTMLElement;
    icon: IconName | string;
    onClick: (event: MouseEvent) => void;
    ariaLabel: string;
    size?: IconSize;
    classes?: string[];
}

/**
 * createIconButton
 *
 * Creates an icon-only button using Coalesce conventions and IconProvider.
 * Falls back to a plain <button> if Obsidian's createEl helper is unavailable.
 */
export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
    const { parent, icon, onClick, ariaLabel, size = 'sm', classes = [] } = options;

    const button = (parent as any).createEl?.('button', {
        cls: ['coalesce-icon-button', ...classes].join(' '),
        attr: {
            type: 'button',
            'aria-label': ariaLabel
        }
    }) as HTMLButtonElement;

    if (!button) {
        const fallback = document.createElement('button');
        fallback.className = ['coalesce-icon-button', ...classes].join(' ');
        fallback.type = 'button';
        fallback.setAttribute('aria-label', ariaLabel);
        parent.appendChild(fallback);
        fallback.addEventListener('click', onClick);
        IconProvider.setIcon(fallback, icon, { size });
        return fallback;
    }

    IconProvider.setIcon(button, icon, { size });
    button.addEventListener('click', onClick);

    return button;
}