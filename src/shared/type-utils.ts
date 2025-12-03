/**
 * Type Utilities
 * 
 * Provides type guards and utility types for improved type safety across the codebase.
 */

import { TFile } from 'obsidian';

/**
 * Type guard to check if a value is an Error
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

/**
 * Type guard to check if a file has basename and name properties
 * (for Obsidian TFile compatibility)
 */
export function hasFileProperties(file: unknown): file is { basename: string; name: string } {
    return (
        typeof file === 'object' &&
        file !== null &&
        'basename' in file &&
        'name' in file &&
        typeof (file as { basename: unknown }).basename === 'string' &&
        typeof (file as { name: unknown }).name === 'string'
    );
}

/**
 * Type guard to check if a value is a TFile
 */
export function isTFile(file: unknown): file is TFile {
    return file instanceof TFile || (hasFileProperties(file) && 'path' in file);
}

/**
 * Safely get basename from a file-like object
 */
export function getFileBasename(file: unknown): string | null {
    if (isTFile(file)) {
        return file.basename;
    }
    if (hasFileProperties(file)) {
        return file.basename;
    }
    return null;
}

/**
 * Safely get name from a file-like object
 */
export function getFileName(file: unknown): string | null {
    if (isTFile(file)) {
        return file.name;
    }
    if (hasFileProperties(file)) {
        return file.name;
    }
    return null;
}

/**
 * Type for Obsidian's HTMLElement extension with createEl/createDiv methods
 * Uses intersection type to avoid conflicts with HTMLElement's existing properties
 */
export type ObsidianHTMLElement = HTMLElement & {
    createEl?: <K extends keyof HTMLElementTagNameMap>(
        tag: K,
        options?: {
            cls?: string;
            attr?: Record<string, string>;
            text?: string;
        }
    ) => HTMLElementTagNameMap[K];
    createDiv?: (options?: {
        cls?: string;
        attr?: Record<string, string>;
        text?: string;
    }) => HTMLDivElement;
};

/**
 * Type guard to check if an element has Obsidian's createEl method
 */
export function hasCreateEl(element: HTMLElement): element is ObsidianHTMLElement {
    return 'createEl' in element && typeof (element as ObsidianHTMLElement).createEl === 'function';
}

/**
 * Type guard to check if an element has Obsidian's createDiv method
 */
export function hasCreateDiv(element: HTMLElement): element is ObsidianHTMLElement {
    return 'createDiv' in element && typeof (element as ObsidianHTMLElement).createDiv === 'function';
}

/**
 * Type guard to check if an element has Obsidian's createEl or createDiv methods
 * Returns a boolean instead of a type predicate to avoid type conflicts
 */
export function hasObsidianCreateMethods(element: HTMLElement): boolean {
    return hasCreateEl(element) || hasCreateDiv(element);
}

/**
 * Utility type for making all properties of T optional recursively
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for making all properties of T required recursively
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

