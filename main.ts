import { App, Plugin, TFile } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger, LogLevel } from './src/utils/Logger';
import { ObsidianSettingsComponent } from './src/components/ObsidianSettingsComponent';
import { MarkdownView } from 'obsidian';

// Define proper types for the Obsidian plugin instance
interface CoalescePluginInstance {
	log?: {
		on: (level?: LogLevel | keyof typeof LogLevel | number) => void;
		off: () => void;
		isEnabled: () => boolean;
	};
}

// Type for the plugins container
interface ObsidianPlugins {
	plugins: {
		coalesce: CoalescePluginInstance;
		[key: string]: unknown;
	};
}

// Type for the extended App with plugins
interface ExtendedApp extends App {
	plugins: ObsidianPlugins;
}

export default class CoalescePlugin extends Plugin {
	private settingsManager: SettingsManager;
	public coalesceManager: CoalesceManager;
	private logger: Logger;

	async onload() {
		this.initializeLogger();
		
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

		this.registerEventHandlers();
		this.addSettingTab(new ObsidianSettingsComponent(this.app, this, this.settingsManager));
		this.logger.debug("Plugin initialization complete");
	}

	private initializeLogger() {
		this.logger = new Logger('Coalesce');
		
		const obsidianApp = this.app as ExtendedApp;
		
		if (obsidianApp.plugins?.plugins?.coalesce) {
			obsidianApp.plugins.plugins.coalesce.log = {
				on: (level?: LogLevel | keyof typeof LogLevel | number) => this.logger.on(level),
				off: () => this.logger.off(),
				isEnabled: () => this.logger.isEnabled()
			};
		}
		
		this.logger.debug("Initializing plugin");
	}

	private registerEventHandlers() {
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file) {
					this.logger.debug("File open event", { path: file.path });
					this.coalesceManager.handleFileOpen(file);
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.logger.debug("Layout change event", { path: activeView.file.path });
					this.coalesceManager.handleModeSwitch(activeView.file, activeView);
				}
			})
		);
	}

	onunload() {
		this.logger.debug("Unloading plugin");
		
		const obsidianApp = this.app as ExtendedApp;
		
		if (obsidianApp.plugins?.plugins?.coalesce?.log) {
			obsidianApp.plugins.plugins.coalesce.log = undefined;
		}
		
		this.coalesceManager.clearBacklinks();
		this.logger.debug("Plugin cleanup complete");
	}
}