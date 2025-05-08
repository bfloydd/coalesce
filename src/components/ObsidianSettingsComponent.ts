import { App, PluginSettingTab, Setting } from 'obsidian';
import { SettingsManager } from '../SettingsManager';
import { Logger } from '../utils/Logger';

export class ObsidianSettingsComponent extends PluginSettingTab {
    private logger: Logger;

    constructor(
        app: App,
        private plugin: any,
        private settingsManager: SettingsManager
    ) {
        super(app, plugin);
        this.logger = new Logger('CoalesceSettings');
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.logger.debug("Displaying settings tab");

        containerEl.createEl('h2', { text: 'Coalesce Settings' });
        
        const settingsContainer = containerEl.createDiv('coalesce-settings');

        new Setting(settingsContainer)
            .setName('Hide in Daily Notes')
            .setDesc('Hide Coalesce view in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.onlyDailyNotes)
                .onChange(async (value) => {
                    this.logger.debug("Setting changed", {
                        setting: "Hide in Daily Notes",
                        value: value
                    });
                    this.settingsManager.settings.onlyDailyNotes = value;
                    await this.settingsManager.saveSettings();
                }));
    }
}
