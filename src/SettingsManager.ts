interface CoalescePluginSettings {
    mySetting: string;
    sortDescending: boolean;
    blocksCollapsed: boolean;
}

const DEFAULT_SETTINGS: CoalescePluginSettings = {
    mySetting: 'default',
    sortDescending: true,
    blocksCollapsed: true
};

// Assuming Plugin is an interface, add the method signature
interface Plugin {
    loadData(): Promise<Partial<CoalescePluginSettings>>;
    saveData(settings: CoalescePluginSettings): Promise<void>;
}

// If Plugin is a class, add the method implementation
class Plugin {
    async loadData(): Promise<Partial<CoalescePluginSettings>> {
        // Return a partial settings object
        return {}; // or return the actual data if available
    }

    async saveData(settings: CoalescePluginSettings): Promise<void> {
        // Implement the method to save the settings
    }
}

export class SettingsManager {
    private plugin: Plugin;
    settings: CoalescePluginSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
    }

    async saveSettings() {
        await this.plugin.saveData(this.settings);
    }
}
