import { App, Plugin } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger } from './src/Logger';

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	private coalesceManager: CoalesceManager;

	async onload() {
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();

		this.coalesceManager = new CoalesceManager(this.app);
		this.app.workspace.on('file-open', (file) => {
			if (file) {
				this.coalesceManager.handleFileOpen(file);
			}
		});

		/**
		 * Logging
		 * Usage: In the browser console, type `enableLogging()` to enable logging.
		 * Usage: In the browser console, type `disableLogging()` to disable logging.
		 */
		// 
		(window as any).enableLogging = function() {
			Logger.enable();
			console.log("Logging enabled");
		};
		(window as any).disableLogging = function() {
			Logger.disable();
			console.log("Logging disabled");
		};
	}

	onunload() {
		this.coalesceManager.clearBacklinks();
	}
}