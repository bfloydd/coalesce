import { IconProvider, IconName, IconSize } from '../../features/shared-utilities/IconProvider';
import { hasCreateEl } from '../type-utils';

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

    let button: HTMLButtonElement;
    if (hasCreateEl(parent)) {
        const created = parent.createEl('button', {
            cls: ['coalesce-icon-button', ...classes].join(' '),
            attr: {
                type: 'button',
                'aria-label': ariaLabel
            }
        });
        button = created as HTMLButtonElement;
    } else {
        button = document.createElement('button');
        button.className = ['coalesce-icon-button', ...classes].join(' ');
        button.type = 'button';
        button.setAttribute('aria-label', ariaLabel);
        parent.appendChild(button);
    }

    IconProvider.setIcon(button, icon, { size });
    button.addEventListener('click', onClick);

    return button;
}