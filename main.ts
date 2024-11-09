import { App, Plugin, TFile } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger } from './src/Logger';
import { CoalesceSettingTab } from './src/SettingsTab';

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	private coalesceManager: CoalesceManager;
	private logger: Logger;

	async onload() {
		this.logger = new Logger();
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();

		this.addSettingTab(new CoalesceSettingTab(this.app, this, this.settingsManager));

		this.coalesceManager = new CoalesceManager(this.app, this.settingsManager);
		this.app.workspace.on('file-open', (file: TFile) => {
			if (!file) return;
			
			const isDaily = this.isDailyNote(file);
			if (!isDaily || (isDaily && this.settingsManager.settings.showInDailyNotes)) {
				this.coalesceManager.handleFileOpen(file);
			} else {
				this.coalesceManager.clearBacklinks();
			}
		});

		(window as any).coalesceLogging = function(enable: boolean) {
			if (enable) {
				Logger.enable();
				console.log("Logging enabled");
			} else {
				Logger.disable();
				console.log("Logging disabled");
			}
		};
	}

	onunload() {
		this.coalesceManager.clearBacklinks();
	}

	private isDailyNote(file: TFile): boolean {
		// Access the Daily Notes core plugin
		const dailyNotesPlugin = (this.app as any).internalPlugins.plugins['daily-notes'];
		if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
			this.logger.debug('Daily Notes plugin is not enabled.');
			return false;
		}

		// Retrieve the daily notes folder from the plugin's settings
		const dailyNotesFolder = dailyNotesPlugin.instance.options.folder || '';
		if (!dailyNotesFolder) {
			this.logger.debug("Daily Notes folder not set, using vault root.");
		}

		const dailyNotePattern = /^\d{4}-\d{2}-\d{2}\.md$/; // Adjust this pattern if needed

		// Check if the file is in the daily notes folder
		if (!file.path.startsWith(dailyNotesFolder)) {
			return false;
		}

		// Check if the file name matches the daily note pattern
		return dailyNotePattern.test(file.name);
	}
}