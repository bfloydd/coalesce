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

		this.addSettingTab(new ObsidianSettingsComponent(this.app, this, this.settingsManager));

		this.coalesceManager = new CoalesceManager(
			this.app,
			this.settingsManager,
			this.logger
		);
		
		// Handle initial load with a slight delay to ensure everything is ready
		setTimeout(() => {
			// Initialize all markdown views
			this.coalesceManager.initializeAllViews();
		}, 300);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.logger.info("Layout-change event triggered");
				
				// Get all markdown views
				const markdownViews = this.app.workspace.getLeavesOfType('markdown')
					.map(leaf => leaf.view as MarkdownView)
					.filter(view => view?.file);

				markdownViews.forEach(view => {
					if (!view.file) return;
					
					const isDaily = this.isDailyNote(view.file);
					if (!isDaily || (isDaily && this.settingsManager.settings.showInDailyNotes)) {
						this.logger.info("Handling file open from layout-change:", view.file.path);
						this.coalesceManager.handleFileOpen(view.file);
					}
				});
			})
		);

		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				this.logger.debug("File-open event triggered");
				
				if (!file) {
					this.logger.debug("No file provided in file-open event");
					// Clear all views when no file is opened
					this.coalesceManager.clearBacklinks();
					return;
				}
				
				this.logger.debug("File opened:", file.path);
				const isDaily = this.isDailyNote(file);
				
				// Always clear existing views first
				this.coalesceManager.clearBacklinks();

				// Then create new views if appropriate
				if (!isDaily || (isDaily && this.settingsManager.settings.onlyDailyNotes)) {
					this.logger.info("Handling file open from file-open event:", file.path);
					this.coalesceManager.handleFileOpen(file);
				}
			})
		);

		(window as any).coalesceLog = (level: string | boolean = true) => {
			console.log('coalesceLog called with:', level);
			this.logger.setLogging(level);
		};

		console.log("Coalesce plugin loaded");
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