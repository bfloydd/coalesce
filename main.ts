import { App, Plugin, TFile } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger } from './src/utils/Logger';
import { ObsidianSettingsComponent } from './src/components/ObsidianSettingsComponent';
import { MarkdownView } from 'obsidian';

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	private coalesceManager: CoalesceManager;
	private logger: Logger;

	async onload() {
		this.logger = new Logger();
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();

		this.coalesceManager = new CoalesceManager(
			this.app,
			this.settingsManager,
			this.logger
		);

		// Register event handlers
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file) {
					this.coalesceManager.handleFileOpen(file);
				}
			})
		);

		// Handle edit/view mode switches
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.coalesceManager.handleModeSwitch(activeView.file, activeView);
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ObsidianSettingsComponent(this.app, this, this.settingsManager));
	}

	onunload() {
		this.coalesceManager.clearBacklinks();
	}
}