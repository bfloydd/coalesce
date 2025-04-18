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
