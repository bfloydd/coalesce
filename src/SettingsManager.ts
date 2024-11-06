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
