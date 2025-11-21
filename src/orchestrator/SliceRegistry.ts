import { App } from 'obsidian';
import { IPluginSlice, SliceFactory } from './types';

/**
 * Registry for managing plugin slices.
 * Allows for dynamic registration and creation of slices, adhering to OCP.
 */
export class SliceRegistry {
    private factories = new Map<string, SliceFactory>();
    private orderedNames: string[] = [];

    /**
     * Register a new slice factory.
     * @param name Unique name of the slice
     * @param factory Function that creates the slice instance
     */
    register(name: string, factory: SliceFactory): void {
        if (this.factories.has(name)) {
            console.warn(`Slice '${name}' is already registered. Overwriting.`);
        }
        this.factories.set(name, factory);
        if (!this.orderedNames.includes(name)) {
            this.orderedNames.push(name);
        }
    }

    /**
     * Create a slice instance.
     * @param name Name of the slice to create
     * @param app Obsidian App instance
     * @param config Configuration object
     */
    create(name: string, app: App, config: any): IPluginSlice {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`No factory registered for slice '${name}'`);
        }
        return factory(app, config);
    }

    /**
     * Get all registered slice names in registration order.
     */
    getAllNames(): string[] {
        return [...this.orderedNames];
    }

    /**
     * Unregister a slice (mainly for testing or cleanup).
     */
    unregister(name: string): void {
        this.factories.delete(name);
        this.orderedNames = this.orderedNames.filter(n => n !== name);
    }
}
