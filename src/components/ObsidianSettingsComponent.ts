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

        const settingsContainer = containerEl.createDiv('coalesce-settings');

        this.addDailyNotesToggle(settingsContainer);
        this.addHideBacklinkLineToggle(settingsContainer);
    }
    
    private addDailyNotesToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Hide in Daily Notes')
            .setDesc('Hide Coalesce view in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.onlyDailyNotes)
                .onChange(async (value) => {
                    this.logSettingChange("Hide in Daily Notes", value);
                    this.settingsManager.settings.onlyDailyNotes = value;
                    await this.settingsManager.saveSettings();
                }));
    }
    
    private addHideBacklinkLineToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Hide Backlink Line')
            .setDesc('Hide the line containing the backlink in blocks')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.hideBacklinkLine)
                .onChange(async (value) => {
                    this.logSettingChange("Hide Backlink Line", value);
                    this.settingsManager.settings.hideBacklinkLine = value;
                    await this.settingsManager.saveSettings();
                    this.refreshViewsIfNeeded();
                }));
    }
    
    private logSettingChange(settingName: string, value: any): void {
        this.logger.debug("Setting changed", {
            setting: settingName,
            value: value
        });
    }
    
    private refreshViewsIfNeeded(): void {
        if (this.plugin.coalesceManager) {
            this.logger.debug("Refreshing views after hideBacklinkLine change");
            this.plugin.coalesceManager.refreshActiveViews();
        }
    }
}
