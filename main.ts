import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { BacklinksView } from './src/BacklinksView';

interface CoalescePluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: CoalescePluginSettings = {
	mySetting: 'default'
}

export default class CoalescePlugin extends Plugin {
	settings: CoalescePluginSettings;
	private backlinksView: BacklinksView | null = null; // Store the BacklinksView instance

	async onload() {
		this.app.workspace.on('file-open', (file) => {
			if (!file) return;

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			// Always create a new backlinks view for each file open
			if (this.backlinksView) {
				this.backlinksView.clear();
			}

			// Pass the current file's name to the BacklinksView
			const currentNoteName = file.basename;
			this.backlinksView = new BacklinksView(view, currentNoteName);

			// Get all backlinks to the current file
			const backlinks = this.app.metadataCache.resolvedLinks;
			const filesLinkingToThis = Object.entries(backlinks)
				.filter(([_, links]) => file.path in links)
				.map(([sourcePath]) => sourcePath);

			// Update backlinks view
			this.backlinksView.updateBacklinks(filesLinkingToThis, (path) => {
				this.app.workspace.openLinkText(path, '', false);
			});
		});
	}

	onunload() {
		if (this.backlinksView) {
			this.backlinksView.clear();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}