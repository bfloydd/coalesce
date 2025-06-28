import { Logger } from './utils/Logger';
import { CoalescePluginSettings, PluginInterface } from './types';

const DEFAULT_SETTINGS: CoalescePluginSettings = {
    mySetting: 'default',
    sortDescending: true,
    blocksCollapsed: true,
    showInDailyNotes: false,
    blockBoundaryStrategy: 'default',
    theme: 'default',
    showFullPathTitle: false,
    position: 'low',
    onlyDailyNotes: false,
    headerStyle: 'full',
    hideBacklinkLine: false
};

export class SettingsManager {
    private plugin: PluginInterface;
    settings: CoalescePluginSettings;
    private logger: Logger;

    constructor(plugin: PluginInterface) {
        this.plugin = plugin;
        this.logger = new Logger('SettingsManager');
    }

    async loadSettings() {
        this.logger.debug('Loading settings');
        const savedData = await this.plugin.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
        
        this.logSettingsLoaded(savedData);
    }

    private logSettingsLoaded(savedData: Partial<CoalescePluginSettings>) {
        this.logger.debug('Settings loaded', {
            defaults: DEFAULT_SETTINGS,
            saved: savedData,
            merged: this.settings
        });
    }

    async saveSettings() {
        this.logger.debug('Saving settings', {
            settings: this.settings
        });
        
        try {
            await this.plugin.saveData(this.settings);
            this.logger.debug('Settings saved successfully');
        } catch (error) {
            this.handleSaveError(error);
        }
    }

    private handleSaveError(error: unknown) {
        this.logger.error('Failed to save settings:', error);
        throw error;
    }
}
