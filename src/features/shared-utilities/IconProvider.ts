import { setIcon } from 'obsidian';

/**
 * Icon Provider for Coalesce Plugin
 *
 * Centralized icon management using Obsidian's built-in Lucide icons.
 * Provides a clean, consistent API for setting icons across the application.
 */
export class IconProvider {
    /**
     * Icon size definitions
     */
    static readonly ICON_SIZES = {
        xs: 'var(--coalesce-icon-size-sm)',
        sm: 'var(--coalesce-icon-size-sm)',
        md: 'var(--coalesce-icon-size-md)',
        lg: 'var(--coalesce-icon-size-lg)',
        xl: 'var(--coalesce-icon-size-xl)'
    } as const;

    /**
     * Standard icon names used throughout the application
     */
    static readonly ICONS = {
        // Navigation and sorting
        sort: 'arrow-up-down',  // Toggle button showing both directions
        sortAsc: 'arrow-up-a-z',
        sortDesc: 'arrow-down-a-z',
        sortToggle: 'arrow-up-down',  // For toggle buttons
        chevronDown: 'chevron-down',
        chevronUp: 'chevron-up',

        // UI controls
        settings: 'more-horizontal',
        close: 'x',
        check: 'check',

        // Actions
        plus: 'plus',
        minus: 'minus',
        edit: 'edit',
        trash: 'trash-2',
        refresh: 'refresh-cw',

        // Status
        success: 'check-circle',
        error: 'alert-circle',
        warning: 'alert-triangle',
        info: 'info'
    } as const;

    /**
     * Set an icon on an element with standardized options
     */
    static setIcon(
        element: HTMLElement,
        iconName: keyof typeof IconProvider.ICONS | string,
        options: {
            size?: keyof typeof IconProvider.ICON_SIZES;
            classes?: string[];
            replace?: boolean;
        } = {}
    ): void {
        const { size = 'md', classes = [], replace = true } = options;

        // Clear existing icon if replacing
        if (replace) {
            const existingSvg = element.querySelector('svg');
            if (existingSvg) {
                existingSvg.remove();
            }
        }

        // Set the icon using Obsidian's setIcon
        const resolvedIconName = IconProvider.ICONS[iconName as keyof typeof IconProvider.ICONS] || iconName;
        setIcon(element, resolvedIconName);

        // Apply size and classes
        const svg = element.querySelector('svg') as SVGElement;
        if (svg) {
            // Set size
            const sizeValue = this.ICON_SIZES[size];
            if (sizeValue) {
                svg.style.width = sizeValue;
                svg.style.height = sizeValue;
            }

            // Add classes
            if (classes.length > 0) {
                svg.classList.add(...classes);
            }
        }
    }

    /**
     * Update icon classes on an existing icon
     */
    static updateIconClasses(
        element: HTMLElement,
        addClasses: string[] = [],
        removeClasses: string[] = []
    ): void {
        const svg = element.querySelector('svg') as SVGElement;
        if (svg) {
            if (removeClasses.length > 0) {
                svg.classList.remove(...removeClasses);
            }
            if (addClasses.length > 0) {
                svg.classList.add(...addClasses);
            }
        }
    }

    /**
     * Remove icon from element
     */
    static removeIcon(element: HTMLElement): void {
        const svg = element.querySelector('svg');
        if (svg) {
            svg.remove();
        }
    }

    /**
     * Check if element has an icon
     */
    static hasIcon(element: HTMLElement): boolean {
        return !!element.querySelector('svg');
    }

    /**
     * Get standard icon name by key
     */
    static getIconName(key: keyof typeof IconProvider.ICONS): string {
        return IconProvider.ICONS[key];
    }

    /**
     * Get all available icon names
     */
    static getAvailableIcons(): Record<string, string> {
        return { ...this.ICONS };
    }
}

// Export types for external use
export type IconSize = keyof typeof IconProvider.ICON_SIZES;
export type IconName = keyof typeof IconProvider.ICONS;