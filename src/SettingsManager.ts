import { Logger } from './utils/Logger';

interface CoalescePluginSettings {
    mySetting: string;
    sortDescending: boolean;
    blocksCollapsed: boolean;
    showInDailyNotes: boolean;
    blockBoundaryStrategy: string;
    theme: string;
    showFullPathTitle: boolean;
    position: 'high' | 'low';
    onlyDailyNotes: boolean; // When true, hide Coalesce in daily notes
    headerStyle: string;
}

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
    headerStyle: 'full'
};

interface Plugin {
    loadData(): Promise<Partial<CoalescePluginSettings>>;
    saveData(settings: CoalescePluginSettings): Promise<void>;
}

class Plugin {
    async loadData(): Promise<Partial<CoalescePluginSettings>> {
        return {};
    }

    async saveData(settings: CoalescePluginSettings): Promise<void> {
    }
}

export class SettingsManager {
    private plugin: Plugin;
    settings: CoalescePluginSettings;
    private logger: Logger;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.logger = new Logger('SettingsManager');
    }

    async loadSettings() {
        this.logger.debug('Loading settings');
        const savedData = await this.plugin.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
        
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
            this.logger.error('Failed to save settings:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }
}
