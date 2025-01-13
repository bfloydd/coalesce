import { App, PluginSettingTab, Setting } from 'obsidian';
import { SettingsManager } from '../SettingsManager';

export class ObsidianSettingsComponent extends PluginSettingTab {
    constructor(
        app: App,
        private plugin: any,
        private settingsManager: SettingsManager
    ) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Show in Daily Notes')
            .setDesc('Enable Coalesce view in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.showInDailyNotes)
                .onChange(async (value) => {
                    this.settingsManager.settings.showInDailyNotes = value;
                    await this.settingsManager.saveSettings();
                }));
    }
}
