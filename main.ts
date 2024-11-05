import { App, Plugin } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { BacklinksManager } from './src/BacklinksManager';
import { Logger } from './src/Logger';

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	private backlinksManager: BacklinksManager;

	async onload() {
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();

		this.backlinksManager = new BacklinksManager(this.app);
		this.app.workspace.on('file-open', (file) => {
			if (file) {
				this.backlinksManager.handleFileOpen(file);
			}
		});

		// Usage: In the browser console, type `enableLogging()` to enable logging.
		(window as any).enableLogging = function() {
			Logger.enable();
			console.log("Logging enabled");
		};

		// Usage: In the browser console, type `disableLogging()` to disable logging.
		(window as any).disableLogging = function() {
			Logger.disable();
			console.log("Logging disabled");
		};
	}

	onunload() {
		this.backlinksManager.clearBacklinks();
	}
}