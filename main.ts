import { App, Plugin, TFile } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger, LogLevel } from './src/utils/Logger';
import { ObsidianSettingsComponent } from './src/components/ObsidianSettingsComponent';
import { MarkdownView } from 'obsidian';

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	public coalesceManager: CoalesceManager;
	private logger: Logger;

	async onload() {
		// Initialize logger with plugin name prefix
		this.logger = new Logger('Coalesce');
		
		// Expose logging methods through plugin instance
		(this.app as any).plugins.plugins.coalesce.log = {
			on: (level?: LogLevel | keyof typeof LogLevel | number) => this.logger.on(level),
			off: () => this.logger.off(),
			isEnabled: () => this.logger.isEnabled()
		};
		
		this.logger.debug("Initializing plugin");
		
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();
		
		this.logger.debug("Settings loaded", {
			onlyDailyNotes: this.settingsManager.settings.onlyDailyNotes,
			blockBoundaryStrategy: this.settingsManager.settings.blockBoundaryStrategy,
			theme: this.settingsManager.settings.theme,
			position: this.settingsManager.settings.position,
			headerStyle: this.settingsManager.settings.headerStyle
		});

		this.coalesceManager = new CoalesceManager(
			this.app,
			this.settingsManager,
			this.logger
		);

		// Register event handlers
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file) {
					this.logger.debug("File open event", { path: file.path });
					this.coalesceManager.handleFileOpen(file);
				}
			})
		);

		// Handle edit/view mode switches
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.logger.debug("Layout change event", { path: activeView.file.path });
					this.coalesceManager.handleModeSwitch(activeView.file, activeView);
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ObsidianSettingsComponent(this.app, this, this.settingsManager));
		this.logger.debug("Plugin initialization complete");
	}

	onunload() {
		this.logger.debug("Unloading plugin");
		// Clean up logging methods
		if ((this.app as any).plugins.plugins.coalesce) {
			delete (this.app as any).plugins.plugins.coalesce.log;
		}
		this.coalesceManager.clearBacklinks();
		this.logger.debug("Plugin cleanup complete");
	}
}