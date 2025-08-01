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
			console.log("Coalesce plugin test focus called");
			console.log("Coalesce manager:", this.coalesceManager);
			this.coalesceManager.testFocusFilterInput();
		};
		
		// Expose plugin status test
		(this.app as any).coalesceStatus = () => {
			console.log("Coalesce plugin status:");
			console.log("- Plugin loaded:", !!this);
			console.log("- Settings manager:", !!this.settingsManager);
			console.log("- Coalesce manager:", !!this.coalesceManager);
			console.log("- Active views count:", this.coalesceManager['activeViews'].size);
			console.log("- All markdown views:", this.app.workspace.getLeavesOfType('markdown').length);
		};

		// Expose direct focus test
		(this.app as any).coalesceTestDirectFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			console.log("Active view:", activeView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				console.log("Leaf ID:", leafId);
				console.log("Active views:", this.coalesceManager['activeViews']);
				const coalesceView = this.coalesceManager['activeViews'].get(leafId);
				console.log("Coalesce view:", coalesceView);
				if (coalesceView) {
					coalesceView.testFocus();
				} else {
					console.log("No coalesce view found for leaf:", leafId);
				}
			} else {
				console.log("No active markdown view found");
			}
		};

		// Expose force focus test
		(this.app as any).coalesceForceFocus = () => {
			this.coalesceManager.forceFocusCheck();
		};

		// Expose direct focus test
		(this.app as any).coalesceDirectFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const coalesceView = this.coalesceManager['activeViews'].get(leafId);
				if (coalesceView) {
					coalesceView.directFocusTest();
				}
			}
		};

		// Expose window focus test
		(this.app as any).coalesceTestWindowFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const coalesceView = this.coalesceManager['activeViews'].get(leafId);
				if (coalesceView) {
					coalesceView.testWindowFocus();
				}
			}
		};

		// Expose simple focus test
		(this.app as any).coalesceTestSimpleFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const coalesceView = this.coalesceManager['activeViews'].get(leafId);
				if (coalesceView) {
					console.log("Testing simple focus");
					coalesceView.requestFocusWhenReady();
				} else {
					console.log("No coalesce view found for active leaf");
				}
			} else {
				console.log("No active markdown view found");
			}
		};

		// Expose logging state update method
		(this.app as any).coalesceUpdateLogging = (enabled: boolean) => {
			if (enabled) {
				this.logger.on();
			} else {
				this.logger.off();
			}
		};

		this.registerEventHandlers();
		this.addSettingTab(new ObsidianSettingsComponent(this.app, this, this.settingsManager));
		this.logger.debug("Plugin initialization complete");
	}

	private initializeLogger() {
		this.logger = new Logger('Coalesce');
		
		// Initialize logger state based on settings
		if (this.settingsManager?.settings?.enableLogging) {
			this.logger.on();
		} else {
			this.logger.off();
		}
		
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
					this.logger.debug("File open event", { 
						path: file.path,
						extension: file.extension,
						basename: file.basename
					});
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