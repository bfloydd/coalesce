import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		this.app.workspace.on('file-open', (file) => {
			if (file) {
				// Get all backlinks to the current file
				const backlinks = this.app.metadataCache.resolvedLinks;
				const filesLinkingToThis = Object.entries(backlinks)
					.filter(([_, links]) => file.path in links)
					.map(([sourcePath]) => sourcePath);
				
				// Get the current view
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return;

				// Create or get the backlinks container
				let backlinksContainer = view.containerEl.querySelector('.custom-backlinks-container');
				if (!backlinksContainer) {
					backlinksContainer = view.containerEl.createDiv('custom-backlinks-container');
					const backlinksEl = backlinksContainer as HTMLElement;
					backlinksEl.style.borderTop = '1px solid var(--background-modifier-border)';
					backlinksEl.style.marginTop = '20px';
					backlinksEl.style.paddingTop = '10px';
				}

				// Clear existing content
				backlinksContainer.empty();

				// Add header
				const header = backlinksContainer.createEl('h4', {
					text: `${filesLinkingToThis.length} Backlinks`
				});

				// Add backlinks
				const linksContainer = backlinksContainer.createDiv('backlinks-list');
				filesLinkingToThis.forEach(sourcePath => {
					const linkEl = linksContainer.createDiv('backlink-item');
					linkEl.createEl('a', {
						text: sourcePath,
						cls: 'internal-link',
					}).addEventListener('click', (event) => {
						event.preventDefault();
						this.app.workspace.openLinkText(sourcePath, '');
					});
				});
			}
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}