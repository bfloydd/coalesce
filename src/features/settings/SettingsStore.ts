import { Logger } from '../shared-utilities/Logger';
import { CoalescePluginSettings, PluginInterface } from '../shared-contracts/plugin';

/**
 * Settings Store for Settings Slice
 * 
 * Handles the persistence and retrieval of settings data
 * for the vertical slice architecture.
 */
export class SettingsStore {
    private plugin: PluginInterface;
    private logger: Logger;
    private cache: CoalescePluginSettings | null = null;
    private lastLoadTime: Date | null = null;

    constructor(plugin: PluginInterface, logger: Logger) {
        this.plugin = plugin;
        this.logger = logger.child('SettingsStore');
        
        this.logger.debug('SettingsStore initialized');
    }

    /**
     * Load settings from storage
     */
    async load(): Promise<CoalescePluginSettings> {
        this.logger.debug('Loading settings from storage');
        
        try {
            const savedData = await this.plugin.loadData();
            const defaultSettings = this.getDefaultSettings();
            const settings = Object.assign({}, defaultSettings, savedData);
            
            this.cache = settings;
            this.lastLoadTime = new Date();
            
            this.logSettingsLoaded(savedData, settings);
            
            return settings;
        } catch (error) {
            this.logger.error('Failed to load settings from storage', error);
            
            // Return default settings if load fails
            const defaultSettings = this.getDefaultSettings();
            this.cache = defaultSettings;
            this.lastLoadTime = new Date();
            
            this.logger.debug('Using default settings due to load failure');
            return defaultSettings;
        }
    }

    /**
     * Save settings to storage
     */
    async save(settings: CoalescePluginSettings): Promise<void> {
        this.logger.debug('Saving settings to storage', { settings });
        
        try {
            // Validate settings before saving
            const validation = this.validateSettings(settings);
            if (!validation.isValid) {
                const error = `Invalid settings: ${validation.errors.join(', ')}`;
                this.logger.error(error, { settings, errors: validation.errors });
                throw new Error(error);
            }
            
            await this.plugin.saveData(settings);
            
            // Update cache
            this.cache = settings;
            this.lastLoadTime = new Date();
            
            this.logger.debug('Settings saved successfully');
        } catch (error) {
            this.logger.error('Failed to save settings to storage', error);
            throw error;
        }
    }

    /**
     * Get cached settings if available
     */
    getCachedSettings(): CoalescePluginSettings | null {
        this.logger.debug('Getting cached settings', { 
            hasCache: this.cache !== null,
            lastLoadTime: this.lastLoadTime 
        });
        
        return this.cache ? { ...this.cache } : null;
    }

    /**
     * Check if cache is stale
     */
    isCacheStale(maxAgeMs: number = 5 * 60 * 1000): boolean {
        if (!this.lastLoadTime) {
            this.logger.debug('Cache is stale: never loaded');
            return true;
        }
        
        const now = new Date();
        const age = now.getTime() - this.lastLoadTime.getTime();
        const isStale = age > maxAgeMs;
        
        this.logger.debug('Checking cache staleness', { 
            age,
            maxAgeMs,
            isStale 
        });
        
        return isStale;
    }

    /**
     * Clear the settings cache
     */
    clearCache(): void {
        this.logger.debug('Clearing settings cache');
        this.cache = null;
        this.lastLoadTime = null;
    }

    /**
     * Validate settings object
     */
    validateSettings(settings: Partial<CoalescePluginSettings>): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];
        
        // Validate theme
        if (settings.theme !== undefined) {
            const validThemes = ['default', 'modern', 'compact', 'naked'];
            if (!validThemes.includes(settings.theme)) {
                errors.push(`Invalid theme: ${settings.theme}`);
            }
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
        
        // Validate boolean settings
        const booleanSettings = [
            'sortDescending', 'showInDailyNotes',
            'showFullPathTitle', 'onlyDailyNotes', 'hideBacklinkLine',
            'hideFirstHeader', 'sortByFullPath', 'enableLogging'
        ];
        
        for (const setting of booleanSettings) {
            if (settings[setting as keyof CoalescePluginSettings] !== undefined && 
                typeof settings[setting as keyof CoalescePluginSettings] !== 'boolean') {
                errors.push(`${setting} must be a boolean`);
            }
        }
        
        // Validate string settings
        if (settings.mySetting !== undefined && typeof settings.mySetting !== 'string') {
            errors.push('mySetting must be a string');
        }
        
        this.logger.debug('Settings validation completed', { 
            isValid: errors.length === 0,
            errors 
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get settings statistics
     */
    getStatistics(): {
        hasCache: boolean;
        lastLoadTime: Date | null;
        cacheAge: number | null;
        settingsCount: number;
    } {
        const now = new Date();
        const cacheAge = this.lastLoadTime ? 
            now.getTime() - this.lastLoadTime.getTime() : null;
        
        return {
            hasCache: this.cache !== null,
            lastLoadTime: this.lastLoadTime,
            cacheAge,
            settingsCount: this.cache ? Object.keys(this.cache).length : 0
        };
    }

    /**
     * Cleanup resources used by this settings store
     */
    cleanup(): void {
        this.logger.debug('Cleaning up SettingsStore');
        
        this.clearCache();
        
        this.logger.debug('SettingsStore cleanup completed');
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
            theme: 'default',
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
     * Log settings loaded information
     */
    private logSettingsLoaded(savedData: Partial<CoalescePluginSettings>, settings: CoalescePluginSettings): void {
        this.logger.debug('Settings loaded from storage', {
            savedData,
            mergedSettings: settings,
            hasSavedData: Object.keys(savedData).length > 0
        });
    }
}

// Export the interface for external use
export interface ISettingsStore {
    load(): Promise<CoalescePluginSettings>;
    save(settings: CoalescePluginSettings): Promise<void>;
    getCachedSettings(): CoalescePluginSettings | null;
    isCacheStale(maxAgeMs?: number): boolean;
    clearCache(): void;
    validateSettings(settings: Partial<CoalescePluginSettings>): {
        isValid: boolean;
        errors: string[];
    };
}