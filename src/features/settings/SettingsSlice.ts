import { App } from 'obsidian';
import { ISettingsSlice } from '../shared-contracts/slice-interfaces';
import { CoalescePluginSettings, PluginInterface } from '../shared-contracts/plugin';
import { ThemeManager } from './ThemeManager';
import { SettingsStore } from './SettingsStore';
import { SettingsUI } from './SettingsUI';
import { Logger } from '../shared-utilities/Logger';

/**
 * Settings Slice Implementation
 * 
 * This slice handles settings persistence, theme management,
 * and provides the settings UI for the vertical slice architecture.
 */
export class SettingsSlice implements ISettingsSlice {
    private app: App;
    private plugin: PluginInterface;
    private logger: Logger;
    private settingsStore?: SettingsStore;
    private themeManager: ThemeManager;
    private settingsUI: SettingsUI;
    private currentSettings: CoalescePluginSettings;

    constructor(app: App, plugin?: PluginInterface) {
        this.app = app;
        this.plugin = plugin || (app as any); // Fallback to app if plugin not provided
        this.logger = new Logger('SettingsSlice');

        if (plugin) {
            this.settingsStore = new SettingsStore(plugin, this.logger);
        } else {
            this.settingsStore = undefined;
        }
        this.themeManager = new ThemeManager(this.logger);
        this.settingsUI = new SettingsUI(this.app, this.logger);

        this.currentSettings = this.getDefaultSettings();

        this.logger.debug('Settings slice initialized');
    }

    /**
     * Start the settings slice (loads settings from storage)
     */
    async start(): Promise<void> {
        this.logger.debug('Starting settings slice');
        await this.loadSettings();
        this.logger.debug('Settings slice started successfully');
    }

    /**
     * Load settings from storage
     */
    async loadSettings(): Promise<void> {
        this.logger.debug('Loading settings from storage');

        if (!this.settingsStore) {
            this.logger.warn('No settings store available - using default settings');
            this.currentSettings = this.getDefaultSettings();
            return;
        }

        try {
            this.currentSettings = await this.settingsStore.load();
            this.themeManager.setCurrentTheme(this.currentSettings.theme);
            this.logger.debug('Settings loaded successfully', {
                theme: this.currentSettings.theme,
                enableLogging: this.currentSettings.enableLogging
            });
        } catch (error) {
            this.logger.error('Failed to load settings', error);
            this.currentSettings = this.getDefaultSettings();
            throw error;
        }
    }

    /**
     * Save settings to storage
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
     * Get current settings
     */
    getSettings(): CoalescePluginSettings {
        return { ...this.currentSettings };
    }

    /**
     * Update specific setting
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
     * Update multiple settings at once
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
     * Reset settings to defaults
     */
    async resetSettings(): Promise<void> {
        this.logger.debug('Resetting settings to defaults');
        
        const oldSettings = { ...this.currentSettings };
        
        try {
            this.currentSettings = this.getDefaultSettings();
            this.themeManager.setCurrentTheme(this.currentSettings.theme);
            this.updateLoggingState(this.currentSettings.enableLogging);
            
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
     * Get theme manager
     */
    getThemeManager(): {
        getCurrentTheme(): string;
        setTheme(theme: string): void;
        getAvailableThemes(): string[];
    } {
        return {
            getCurrentTheme: () => this.themeManager.getCurrentTheme(),
            setTheme: (theme: string) => {
                this.logger.debug('Setting theme', { theme });
                this.themeManager.setCurrentTheme(theme);
                this.updateSetting('theme', theme);
            },
            getAvailableThemes: () => [...this.themeManager.getAvailableThemes()]
        };
    }

    /**
     * Get settings UI component
     */
    getSettingsUI(): SettingsUI {
        return this.settingsUI;
    }

    /**
     * Validate settings
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
            const validHeaderStyles = ['full', 'short', 'first-heading-bold', 'first-heading-short', 'first-heading-tidy'];
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
     * Get settings statistics
     */
    getStatistics(): {
        totalSettings: number;
        customSettings: number;
        currentTheme: string;
        lastModified: Date;
    } {
        const defaultSettings = this.getDefaultSettings();
        const customSettings = Object.keys(this.currentSettings).filter(
            key => this.currentSettings[key as keyof CoalescePluginSettings] !== 
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
     * Cleanup resources used by this slice
     */
    cleanup(): void {
        this.logger.debug('Cleaning up Settings slice');

        this.settingsUI.cleanup();
        this.themeManager.cleanup();
        this.settingsStore?.cleanup();

        this.logger.debug('Settings slice cleanup completed');
    }

    /**
     * Get default settings
     */
    private getDefaultSettings(): CoalescePluginSettings {
        return {
            mySetting: 'default',
            sortDescending: true,
            showInDailyNotes: false,
            blockBoundaryStrategy: 'default',
            theme: this.themeManager.getDefaultTheme(),
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
     * Update logging state based on settings
     */
    private updateLoggingState(enabled: boolean): void {
        this.logger.debug('Updating logging state', { enabled });

        if (enabled) {
            this.logger.on();
        } else {
            this.logger.off();
        }
    }
}

// Export the interface for external use
export type { ISettingsSlice } from '../shared-contracts/slice-interfaces';