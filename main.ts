import { App, Plugin, TFile } from 'obsidian';
import { SettingsManager } from './src/SettingsManager';
import { CoalesceManager } from './src/CoalesceManager';
import { Logger, LogLevel } from './src/utils/Logger';
import { ObsidianSettingsComponent } from './src/components/ObsidianSettingsComponent';
import { MarkdownView } from 'obsidian';
import { 
	CoalescePluginInstance, 
	ObsidianPlugins, 
	ExtendedApp 
} from './src/types';

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
			headerStyle: this.settingsManager.settings.headerStyle,
			hideBacklinkLine: this.settingsManager.settings.hideBacklinkLine,
			hideFirstHeader: this.settingsManager.settings.hideFirstHeader
		});

		this.coalesceManager = new CoalesceManager(
			this.app,
			this.settingsManager,
			this.logger
		);

		// Expose test method for debugging
		(this.app as any).coalesceTestFocus = () => {
			this.coalesceManager.testFocusFilterInput();
		};

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

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.logger.debug("Active leaf change event", { path: activeView.file.path });
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