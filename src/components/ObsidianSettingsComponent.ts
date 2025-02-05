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

        containerEl.createEl('h2', { text: 'Coalesce Settings' });
        
        const settingsContainer = containerEl.createDiv('coalesce-settings');

        new Setting(settingsContainer)
            .setName('Only Daily Notes')
            .setDesc('Show Coalesce view only in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.onlyDailyNotes)
                .onChange(async (value) => {
                    this.settingsManager.settings.onlyDailyNotes = value;
                    await this.settingsManager.saveSettings();
                }));
    }
}
