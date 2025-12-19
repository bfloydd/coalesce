import { Logger } from '../../shared-utilities/Logger';
import { CoalescePluginSettings, PluginInterface } from '../../shared-contracts/plugin';
import { SettingsStore } from '../SettingsStore';
import { ThemeManager } from '../ThemeManager';

/**
 * SettingsCore
 *
 * Domain/service layer for plugin settings.
 * Owns settings state, validation, persistence, theme management,
 * and logging configuration, independent of Obsidian UI.
 */
export class SettingsCore {
    private readonly logger: Logger;
    private readonly settingsStore?: SettingsStore;
    private readonly themeManager: ThemeManager;
    private currentSettings: CoalescePluginSettings;

    constructor(logger: Logger, plugin?: PluginInterface) {
        this.logger = logger.child('SettingsCore');

        if (plugin) {
            this.settingsStore = new SettingsStore(plugin, this.logger);
        }

        this.themeManager = new ThemeManager(this.logger);
        this.currentSettings = this.getDefaultSettings();

        this.logger.debug('SettingsCore initialized');
    }

    /**
     * Start the core service (load settings from storage if available).
     */
    async start(): Promise<void> {
        this.logger.debug('Starting SettingsCore');
        await this.loadSettings();
        this.logger.debug('SettingsCore started successfully');
    }

   /**
    * Load settings from storage or fall back to defaults.
    */
    async loadSettings(): Promise<void> {
        this.logger.debug('Loading settings from storage');

        if (!this.settingsStore) {
            this.logger.warn('No settings store available - using default settings');
            this.currentSettings = this.getDefaultSettings();
            this.applySideEffectsForSettings(this.currentSettings);
            return;
        }

        try {
            this.currentSettings = await this.settingsStore.load();
            this.applySideEffectsForSettings(this.currentSettings);

            this.logger.debug('Settings loaded successfully', {
                theme: this.currentSettings.theme,
                enableLogging: this.currentSettings.enableLogging
            });
        } catch (error) {
            this.logger.error('Failed to load settings', error);
            this.currentSettings = this.getDefaultSettings();
            this.applySideEffectsForSettings(this.currentSettings);
            throw error;
        }
    }

    /**
     * Save current settings to storage (if a store is available).
     */
    async saveSettings(): Promise<void> {
        this.logger.debug('Saving settings to storage');

        if (!this.settingsStore) {
            this.logger.warn('No settings store available - settings not saved');
            return;
        }

        try {
            await this.settingsStore.save(this.currentSettings);
            this.logger.debug('Settings saved successfully');
        } catch (error) {
            this.logger.error('Failed to save settings', error);
            throw error;
        }
    }

    /**
     * Get a copy of current settings.
     */
    getSettings(): CoalescePluginSettings {
        return { ...this.currentSettings };
    }

    /**
     * Update a single setting key.
     */
    async updateSetting<K extends keyof CoalescePluginSettings>(
        key: K,
        value: CoalescePluginSettings[K]
    ): Promise<void> {
        this.logger.debug('Updating setting', { key, value });

        const oldValue = this.currentSettings[key];
        this.currentSettings[key] = value;

        try {
            // Handle special cases for certain settings
            if (key === 'theme') {
                this.themeManager.setCurrentTheme(value as string);
            }

            if (key === 'enableLogging') {
                this.updateLoggingState(value as boolean);
            }

            await this.saveSettings();
            this.logger.debug('Setting updated successfully', { key, oldValue, newValue: value });
        } catch (error) {
            // Revert the change if save failed
            this.currentSettings[key] = oldValue;
            this.logger.error('Failed to update setting', { key, value, error });
            throw error;
        }
    }

    /**
     * Update multiple settings at once.
     */
    async updateSettings(updates: Partial<CoalescePluginSettings>): Promise<void> {
        this.logger.debug('Updating multiple settings', { updates });

        const oldSettings = { ...this.currentSettings };

        try {
            // Apply all updates
            Object.assign(this.currentSettings, updates);

            // Handle special cases
            if (updates.theme !== undefined) {
                this.themeManager.setCurrentTheme(updates.theme);
            }

            if (updates.enableLogging !== undefined) {
                this.updateLoggingState(updates.enableLogging);
            }

            // Notify backlinks view of content filter changes
            if (updates.hideBacklinkLine !== undefined || updates.hideFirstHeader !== undefined) {
                const event = new CustomEvent('coalesce-settings-content-filter-changed', {
                    detail: {
                        hideBacklinkLine: this.currentSettings.hideBacklinkLine,
                        hideFirstHeader: this.currentSettings.hideFirstHeader
                    }
                });
                document.dispatchEvent(event);
            }

            await this.saveSettings();
            this.logger.debug('Multiple settings updated successfully', { updates });
        } catch (error) {
            // Revert all changes if save failed
            this.currentSettings = oldSettings;
            this.logger.error('Failed to update multiple settings', { updates, error });
            throw error;
        }
    }

    /**
     * Reset settings to defaults.
     */
    async resetSettings(): Promise<void> {
        this.logger.debug('Resetting settings to defaults');

        const oldSettings = { ...this.currentSettings };

        try {
            this.currentSettings = this.getDefaultSettings();
            this.applySideEffectsForSettings(this.currentSettings);

            await this.saveSettings();
            this.logger.debug('Settings reset successfully');
        } catch (error) {
            // Revert if reset failed
            this.currentSettings = oldSettings;
            this.logger.error('Failed to reset settings', error);
            throw error;
        }
    }

    /**
     * Get a facade for theme management used by other slices.
     */
    getThemeManager(): {
        getCurrentTheme(): string;
        setTheme(theme: string): void;
        getAvailableThemes(): string[];
    } {
        return {
            getCurrentTheme: () => this.themeManager.getCurrentTheme(),
            setTheme: (theme: string) => {
                this.logger.debug('Setting theme via SettingsCore facade', { theme });
                this.themeManager.setCurrentTheme(theme);
                // Also persist setting
                void this.updateSetting('theme', theme);
            },
            getAvailableThemes: () => [...this.themeManager.getAvailableThemes()]
        };
    }

    /**
     * Validate settings.
     */
    validateSettings(settings: Partial<CoalescePluginSettings>): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Validate theme
        if (settings.theme !== undefined && !this.themeManager.isValidTheme(settings.theme)) {
            errors.push(`Invalid theme: ${settings.theme}`);
        }

        // Validate block boundary strategy
        if (settings.blockBoundaryStrategy !== undefined) {
            const validStrategies = ['default', 'headers-only', 'top-line'];
            if (!validStrategies.includes(settings.blockBoundaryStrategy)) {
                errors.push(`Invalid block boundary strategy: ${settings.blockBoundaryStrategy}`);
            }
        }

        // Validate header style
        if (settings.headerStyle !== undefined) {
            const validHeaderStyles = [
                'full',
                'short',
                'first-heading-bold',
                'first-heading-short',
                'first-heading-tidy'
            ];
            if (!validHeaderStyles.includes(settings.headerStyle)) {
                errors.push(`Invalid header style: ${settings.headerStyle}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get settings statistics.
     */
    getStatistics(): {
        totalSettings: number;
        customSettings: number;
        currentTheme: string;
        lastModified: Date;
    } {
        const defaultSettings = this.getDefaultSettings();
        const customSettings = Object.keys(this.currentSettings).filter(
            key =>
                this.currentSettings[key as keyof CoalescePluginSettings] !==
                defaultSettings[key as keyof CoalescePluginSettings]
        ).length;

        return {
            totalSettings: Object.keys(this.currentSettings).length,
            customSettings,
            currentTheme: this.currentSettings.theme,
            lastModified: new Date() // Could be enhanced to track actual last modified time
        };
    }

    /**
     * Handle collapse state change from header slice.
     */
    async handleCollapseStateChange(payload: { collapsed: boolean }): Promise<void> {
        const collapsed = payload?.collapsed || false;
        this.logger.debug('Handling collapse state change', { collapsed });

        try {
            await this.updateSetting('blocksCollapsed', collapsed);
            this.logger.debug('Collapse state saved to settings', { collapsed });
        } catch (error) {
            this.logger.error('Failed to save collapse state to settings', { collapsed, error });
        }
    }

    /**
     * Handle sort state change from header slice.
     *
     * Persists both the sort direction and whether path-based sorting is enabled,
     * mapping the in-memory header state to the persisted settings fields.
     */
    async handleSortStateChange(payload: { sortByPath: boolean; descending: boolean }): Promise<void> {
        const descending = payload?.descending ?? false;
        const sortByPath = payload?.sortByPath ?? false;
        this.logger.debug('Handling sort state change', { sortByPath, descending });

        try {
            await this.updateSettings({
                sortDescending: descending,
                sortByFullPath: sortByPath
            });
            this.logger.debug('Sort settings saved', { sortByPath, descending });
        } catch (error) {
            this.logger.error('Failed to save sort settings', { sortByPath, descending, error });
        }
    }

    /**
     * Cleanup resources used by this core.
     */
    cleanup(): void {
        this.logger.debug('Cleaning up SettingsCore');

        this.themeManager.cleanup();
        this.settingsStore?.cleanup();

        this.logger.debug('SettingsCore cleanup completed');
    }

    /**
     * Apply non-persistence side effects for a full settings object.
     */
    private applySideEffectsForSettings(settings: CoalescePluginSettings): void {
        this.themeManager.setCurrentTheme(settings.theme);
        this.updateLoggingState(settings.enableLogging);
    }

    /**
     * Default settings used when nothing is persisted.
     */
    private getDefaultSettings(): CoalescePluginSettings {
        return {
            mySetting: 'default',
            sortDescending: true,
            showInDailyNotes: false,
            blockBoundaryStrategy: 'default',
            theme: this.themeManager ? this.themeManager.getDefaultTheme() : 'default',
            showFullPathTitle: false,
            onlyDailyNotes: false,
            headerStyle: 'full',
            hideBacklinkLine: false,
            hideFirstHeader: false,
            sortByFullPath: false,
            enableLogging: false,
            blocksCollapsed: false
        };
    }

    /**
     * Update logging state based on settings.
     *
     * Also drives the global Logger state so that PerformanceMonitor instances
     * gated by Logger.getGlobalLogging() respect the user's preference.
     */
    private updateLoggingState(enabled: boolean): void {
        this.logger.debug('Updating logging state', { enabled });

        if (enabled) {
            // Enable global logging so PerformanceMonitor becomes active
            Logger.setGlobalLogging(true);
            this.logger.on();
        } else {
            // Disable global logging so PerformanceMonitor becomes a no-op
            Logger.setGlobalLogging(false);
            this.logger.off();
        }

        // Emit event to notify other components about logging state change
        const event = new CustomEvent('coalesce-logging-state-changed', {
            detail: { enabled }
        });
        document.dispatchEvent(event);
    }
}

// Export interface for external use if slices need to mock the core.
export interface ISettingsCore {
    start(): Promise<void>
    loadSettings(): Promise<void>
    saveSettings(): Promise<void>
    getSettings(): CoalescePluginSettings;
    updateSetting<K extends keyof CoalescePluginSettings>(
        key: K,
        value: CoalescePluginSettings[K]
    ): Promise<void>;
    updateSettings(updates: Partial<CoalescePluginSettings>): Promise<void>;
    resetSettings(): Promise<void>;
    getThemeManager(): {
        getCurrentTheme(): string;
        setTheme(theme: string): void;
        getAvailableThemes(): string[];
    };
    validateSettings(settings: Partial<CoalescePluginSettings>): {
        isValid: boolean;
        errors: string[];
    };
    getStatistics(): {
        totalSettings: number;
        customSettings: number;
        currentTheme: string;
        lastModified: Date;
    };
    handleCollapseStateChange(payload: { collapsed: boolean }): Promise<void>;
    handleSortStateChange(payload: { sortByPath: boolean; descending: boolean }): Promise<void>;
    cleanup(): void;
}