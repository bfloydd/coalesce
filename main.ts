import { App, Plugin } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { BacklinksManager } from './src/BacklinksManager';

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
	}

	onunload() {
		this.backlinksManager.clearBacklinks();
	}
}