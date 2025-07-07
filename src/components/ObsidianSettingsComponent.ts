import { App, PluginSettingTab, Setting } from 'obsidian';
import { SettingsManager } from '../SettingsManager';
import { Logger } from '../utils/Logger';
import { CoalescePlugin } from '../types';

export class ObsidianSettingsComponent extends PluginSettingTab {
    private logger: Logger;

    constructor(
        app: App,
        private plugin: CoalescePlugin,
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
        this.addHideFirstHeaderToggle(settingsContainer);
        this.addSortByFullPathToggle(settingsContainer);
    }
    
    private addDailyNotesToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Hide in daily notes')
            .setDesc('Hide Coalesce view in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.onlyDailyNotes)
                .onChange(async (value) => {
                    this.logSettingChange("Hide in daily notes", value);
                    this.settingsManager.settings.onlyDailyNotes = value;
                    await this.settingsManager.saveSettings();
                }));
    }
    
    private addHideBacklinkLineToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Hide backlink line')
            .setDesc('Hide the line containing the backlink in blocks')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.hideBacklinkLine)
                .onChange(async (value) => {
                    this.logSettingChange("Hide backlink line", value);
                    this.settingsManager.settings.hideBacklinkLine = value;
                    await this.settingsManager.saveSettings();
                    this.refreshViewsIfNeeded();
                }));
    }
    
    private addHideFirstHeaderToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Hide first header')
            .setDesc('Hide the first header line when "Hide backlink line" is enabled')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.hideFirstHeader)
                .onChange(async (value) => {
                    this.logSettingChange("Hide first header", value);
                    this.settingsManager.settings.hideFirstHeader = value;
                    await this.settingsManager.saveSettings();
                    this.refreshViewsIfNeeded();
                }));
    }
    
    private addSortByFullPathToggle(container: HTMLElement): void {
        new Setting(container)
            .setName('Sort by full path')
            .setDesc('Sort blocks by full path')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.sortByFullPath)
                .onChange(async (value) => {
                    this.logSettingChange("Sort by full path", value);
                    this.settingsManager.settings.sortByFullPath = value;
                    await this.settingsManager.saveSettings();
                }));
    }
    
    private logSettingChange(settingName: string, value: unknown): void {
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
