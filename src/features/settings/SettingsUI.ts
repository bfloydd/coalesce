import { App, PluginSettingTab, Setting } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { CoalescePluginSettings } from '../shared-contracts/plugin';

/**
 * Settings UI for Settings Slice
 * 
 * Handles the Obsidian settings tab UI for the plugin
 * in the vertical slice architecture.
 */
export class SettingsUI {
    private app: App;
    private logger: Logger;
    private settingsTab: PluginSettingTab | null = null;
    private onSettingsChange: ((settings: Partial<CoalescePluginSettings>) => void) | null = null;

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('SettingsUI');
        
        this.logger.debug('SettingsUI initialized');
    }

    /**
     * Create and register the settings tab
     */
    createSettingsTab(
        plugin: any,
        currentSettings: CoalescePluginSettings,
        onSettingsChange: (settings: Partial<CoalescePluginSettings>) => void
    ): PluginSettingTab {
        this.logger.debug('Creating settings tab');
        
        this.onSettingsChange = onSettingsChange;
        
        this.settingsTab = new CoalesceSettingTab(
            this.app, 
            plugin, 
            currentSettings, 
            this.handleSettingsChange.bind(this)
        );
        
        this.logger.debug('Settings tab created successfully');
        return this.settingsTab;
    }

    /**
     * Handle settings changes from the UI
     */
    private handleSettingsChange(settings: Partial<CoalescePluginSettings>): void {
        this.logger.debug('Settings changed from UI', { settings });
        
        if (this.onSettingsChange) {
            this.onSettingsChange(settings);
        } else {
            this.logger.warn('No settings change handler registered');
        }
    }

    /**
     * Update the settings tab with new settings
     */
    updateSettings(newSettings: CoalescePluginSettings): void {
        this.logger.debug('Updating settings tab with new settings');
        
        if (this.settingsTab) {
            (this.settingsTab as CoalesceSettingTab).updateSettings(newSettings);
        } else {
            this.logger.warn('No settings tab available to update');
        }
    }

    /**
     * Get the current settings tab
     */
    getSettingsTab(): PluginSettingTab | null {
        return this.settingsTab;
    }

    /**
     * Check if settings tab is active
     */
    isSettingsTabActive(): boolean {
        return this.settingsTab !== null;
    }

    /**
     * Get UI statistics
     */
    getStatistics(): {
        hasSettingsTab: boolean;
        hasChangeHandler: boolean;
    } {
        return {
            hasSettingsTab: this.settingsTab !== null,
            hasChangeHandler: this.onSettingsChange !== null
        };
    }

    /**
     * Cleanup resources used by this settings UI
     */
    cleanup(): void {
        this.logger.debug('Cleaning up SettingsUI');
        
        this.settingsTab = null;
        this.onSettingsChange = null;
        
        this.logger.debug('SettingsUI cleanup completed');
    }
}

/**
 * Coalesce Setting Tab Implementation
 * 
 * Internal class that implements the actual Obsidian settings tab
 */
class CoalesceSettingTab extends PluginSettingTab {
    private plugin: any;
    private currentSettings: CoalescePluginSettings;
    private onSettingsChange: (settings: Partial<CoalescePluginSettings>) => void;
    private logger: Logger;

    constructor(
        app: App, 
        plugin: any, 
        currentSettings: CoalescePluginSettings,
        onSettingsChange: (settings: Partial<CoalescePluginSettings>) => void
    ) {
        super(app, plugin);
        this.plugin = plugin;
        this.currentSettings = { ...currentSettings };
        this.onSettingsChange = onSettingsChange;
        this.logger = new Logger('CoalesceSettingTab');
        
        this.logger.debug('CoalesceSettingTab initialized');
    }

    /**
     * Display the settings UI
     */
    display(): void {
        this.logger.debug('Displaying settings UI');
        
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Coalesce Plugin Settings' });

        // General Settings Section
        this.createGeneralSettings(containerEl);
        
        // Display Settings Section
        this.createDisplaySettings(containerEl);
        
        // Behavior Settings Section
        this.createBehaviorSettings(containerEl);
        
        // Advanced Settings Section
        this.createAdvancedSettings(containerEl);
        
        this.logger.debug('Settings UI displayed successfully');
    }

    /**
     * Update settings and refresh the UI
     */
    updateSettings(newSettings: CoalescePluginSettings): void {
        this.logger.debug('Updating settings in UI', { newSettings });
        this.currentSettings = { ...newSettings };
        this.display();
    }

    /**
     * Create general settings section
     */
    private createGeneralSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'General' });

        new Setting(containerEl)
            .setName('Enable logging')
            .setDesc('Enable debug logging for troubleshooting')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.enableLogging)
                .onChange(async (value) => {
                    this.logger.debug('Enable logging setting changed', { value });
                    this.currentSettings.enableLogging = value;
                    this.onSettingsChange({ enableLogging: value });
                }));

        new Setting(containerEl)
            .setName('Only show in daily notes')
            .setDesc('Only show Coalesce backlinks in daily notes')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.onlyDailyNotes)
                .onChange(async (value) => {
                    this.logger.debug('Only daily notes setting changed', { value });
                    this.currentSettings.onlyDailyNotes = value;
                    this.onSettingsChange({ onlyDailyNotes: value });
                }));
    }

    /**
     * Create display settings section
     */
    private createDisplaySettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Display' });

        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Choose the visual theme for Coalesce')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default')
                .addOption('modern', 'Modern')
                .addOption('compact', 'Compact')
                .addOption('naked', 'Naked')
                .setValue(this.currentSettings.theme)
                .onChange(async (value) => {
                    this.logger.debug('Theme setting changed', { value });
                    this.currentSettings.theme = value;
                    this.onSettingsChange({ theme: value });
                }));

        new Setting(containerEl)
            .setName('Header style')
            .setDesc('Choose how to display file headers')
            .addDropdown(dropdown => dropdown
                .addOption('full', 'Full Path')
                .addOption('short', 'Short Path')
                .addOption('first-heading-bold', 'First Heading (Bold)')
                .addOption('first-heading-short', 'First Heading (Short)')
                .addOption('first-heading-tidy', 'First Heading (Tidy)')
                .setValue(this.currentSettings.headerStyle)
                .onChange(async (value) => {
                    this.logger.debug('Header style setting changed', { value });
                    this.currentSettings.headerStyle = value;
                    this.onSettingsChange({ headerStyle: value });
                }));

        new Setting(containerEl)
            .setName('Show full path in title')
            .setDesc('Display the full file path instead of just the filename')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.showFullPathTitle)
                .onChange(async (value) => {
                    this.logger.debug('Show full path title setting changed', { value });
                    this.currentSettings.showFullPathTitle = value;
                    this.onSettingsChange({ showFullPathTitle: value });
                }));
    }

    /**
     * Create behavior settings section
     */
    private createBehaviorSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Sort descending')
            .setDesc('Sort backlinks in descending order (newest first)')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.sortDescending)
                .onChange(async (value) => {
                    this.logger.debug('Sort descending setting changed', { value });
                    this.currentSettings.sortDescending = value;
                    this.onSettingsChange({ sortDescending: value });
                }));

        new Setting(containerEl)
            .setName('Sort by full path')
            .setDesc('Sort by full file path instead of filename')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.sortByFullPath)
                .onChange(async (value) => {
                    this.logger.debug('Sort by full path setting changed', { value });
                    this.currentSettings.sortByFullPath = value;
                    this.onSettingsChange({ sortByFullPath: value });
                }));

        new Setting(containerEl)
            .setName('Start with blocks collapsed')
            .setDesc('Initially show all backlink blocks in collapsed state')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.blocksCollapsed)
                .onChange(async (value) => {
                    this.logger.debug('Blocks collapsed setting changed', { value });
                    this.currentSettings.blocksCollapsed = value;
                    this.onSettingsChange({ blocksCollapsed: value });
                }));
    }

    /**
     * Create advanced settings section
     */
    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Advanced' });

        new Setting(containerEl)
            .setName('Block boundary strategy')
            .setDesc('How to determine block boundaries when extracting content')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default')
                .addOption('headers-only', 'Headers Only')
                .addOption('top-line', 'Top Line')
                .setValue(this.currentSettings.blockBoundaryStrategy)
                .onChange(async (value) => {
                    this.logger.debug('Block boundary strategy setting changed', { value });
                    this.currentSettings.blockBoundaryStrategy = value;
                    this.onSettingsChange({ blockBoundaryStrategy: value });
                }));

        new Setting(containerEl)
            .setName('Hide backlink line')
            .setDesc('Hide the line that shows the backlink in the source file')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.hideBacklinkLine)
                .onChange(async (value) => {
                    this.logger.debug('Hide backlink line setting changed', { value });
                    this.currentSettings.hideBacklinkLine = value;
                    this.onSettingsChange({ hideBacklinkLine: value });
                }));

        new Setting(containerEl)
            .setName('Hide first header')
            .setDesc('Hide the first header in extracted blocks')
            .addToggle(toggle => toggle
                .setValue(this.currentSettings.hideFirstHeader)
                .onChange(async (value) => {
                    this.logger.debug('Hide first header setting changed', { value });
                    this.currentSettings.hideFirstHeader = value;
                    this.onSettingsChange({ hideFirstHeader: value });
                }));
    }
}

// Export the interface for external use
export interface ISettingsUI {
    createSettingsTab(
        plugin: any,
        currentSettings: CoalescePluginSettings,
        onSettingsChange: (settings: Partial<CoalescePluginSettings>) => void
    ): PluginSettingTab;
    updateSettings(newSettings: CoalescePluginSettings): void;
    getSettingsTab(): PluginSettingTab | null;
    isSettingsTabActive(): boolean;
}