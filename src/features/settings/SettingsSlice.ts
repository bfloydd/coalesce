import { App } from 'obsidian';
import { ISettingsSlice } from '../shared-contracts/slice-interfaces';
import { IPluginSlice, SliceDependencies } from '../../orchestrator/types';
import { CoalescePluginSettings, PluginInterface } from '../shared-contracts/plugin';
import { SettingsUI } from './SettingsUI';
import { Logger } from '../shared-utilities/Logger';
import { SettingsCore } from './core/SettingsCore';

/**
 * Settings Slice
 *
 * Thin orchestrator for plugin settings.
 *
 * Responsibilities:
 * - Wire SettingsCore (domain/service) and SettingsUI (Obsidian settings tab)
 * - Expose the ISettingsSlice API expected by the plugin orchestrator
 * - Delegate persistence, validation, theme, and logging behaviour to SettingsCore
 * - Delegate Obsidian UI concerns to SettingsUI
 */
export class SettingsSlice implements IPluginSlice, ISettingsSlice {
    private app: App;
    private plugin: PluginInterface;
    private logger: Logger;

    // Core/domain service
    private core: SettingsCore;

    // UI layer
    private settingsUI: SettingsUI;

    constructor(app: App, plugin?: PluginInterface) {
        this.app = app;
        this.plugin = plugin || (app as any); // Fallback to app if plugin not provided
        this.logger = new Logger('SettingsSlice');

        // Components will be initialized in initialize()
    }

    /**
     * Initialize the slice
     */
    async initialize(dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing SettingsSlice');

        // Initialize core/domain service
        this.core = new SettingsCore(this.logger, this.plugin);

        // Initialize settings UI
        this.settingsUI = new SettingsUI(this.app, this.logger);

        this.logger.debug('SettingsSlice initialized');
    }

    /**
     * Stop the slice
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping SettingsSlice');
    }

    /**
     * Start the settings slice (loads settings via core).
     */
    async start(): Promise<void> {
        this.logger.debug('Starting settings slice');
        await this.core.start();
        this.logger.debug('Settings slice started successfully');
    }

    /**
     * Load settings from storage via core.
     */
    async loadSettings(): Promise<void> {
        this.logger.debug('Loading settings via core');
        await this.core.loadSettings();
    }

    /**
     * Save settings to storage via core.
     */
    async saveSettings(): Promise<void> {
        this.logger.debug('Saving settings via core');
        await this.core.saveSettings();
    }

    /**
     * Get current settings (copy) from core.
     */
    getSettings(): CoalescePluginSettings {
        return this.core.getSettings();
    }

    /**
     * Update a specific setting key via core and refresh UI if present.
     */
    async updateSetting<K extends keyof CoalescePluginSettings>(
        key: K,
        value: CoalescePluginSettings[K]
    ): Promise<void> {
        this.logger.debug('Updating setting (slice)', { key, value });

        await this.core.updateSetting(key, value);

        // Keep UI in sync if the settings tab is active
        if (this.settingsUI.isSettingsTabActive()) {
            this.settingsUI.updateSettings(this.core.getSettings());
        }
    }

    /**
     * Update multiple settings at once via core and refresh UI.
     */
    async updateSettings(updates: Partial<CoalescePluginSettings>): Promise<void> {
        this.logger.debug('Updating multiple settings (slice)', { updates });

        await this.core.updateSettings(updates);

        if (this.settingsUI.isSettingsTabActive()) {
            this.settingsUI.updateSettings(this.core.getSettings());
        }
    }

    /**
     * Reset settings to defaults via core and refresh UI.
     */
    async resetSettings(): Promise<void> {
        this.logger.debug('Resetting settings to defaults (slice)');

        await this.core.resetSettings();

        if (this.settingsUI.isSettingsTabActive()) {
            this.settingsUI.updateSettings(this.core.getSettings());
        }
    }

    /**
     * Get theme manager facade from core.
     */
    getThemeManager(): {
        getCurrentTheme(): string;
        setTheme(theme: string): void;
        getAvailableThemes(): string[];
    } {
        return this.core.getThemeManager();
    }

    /**
     * Get settings UI component.
     *
     * The caller is expected to use SettingsUI.createSettingsTab with
     * the current settings and a change callback that delegates to this slice.
     */
    getSettingsUI(): SettingsUI {
        return this.settingsUI;
    }

    /**
     * Validate settings via core.
     */
    validateSettings(settings: Partial<CoalescePluginSettings>): {
        isValid: boolean;
        errors: string[];
    } {
        return this.core.validateSettings(settings);
    }

    /**
     * Get settings statistics via core.
     */
    getStatistics(): {
        totalSettings: number;
        customSettings: number;
        currentTheme: string;
        lastModified: Date;
    } {
        return this.core.getStatistics();
    }

    /**
     * Handle collapse state change from header slice.
     * Fire-and-forget delegation to core to preserve the existing void signature.
     */
    handleCollapseStateChange(payload: { collapsed: boolean }): void {
        void this.core.handleCollapseStateChange(payload);
    }

    /**
     * Handle sort state change from header slice.
     * Fire-and-forget delegation to core to preserve the existing void signature.
     */
    handleSortStateChange(payload: { sortByPath: boolean; descending: boolean }): void {
        void this.core.handleSortStateChange(payload);
    }

    /**
     * Cleanup resources used by this slice.
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up Settings slice');

        this.settingsUI.cleanup();
        this.core.cleanup();

        this.logger.debug('Settings slice cleanup completed');
    }
}

// Export the interface for external use
export type { ISettingsSlice } from '../shared-contracts/slice-interfaces';
