import { Plugin } from 'obsidian';
import { PluginOrchestrator } from './src/orchestrator/PluginOrchestrator';
import { Logger } from './src/features/shared-utilities/Logger';
import { CoalescePluginSettings } from './src/features/shared-contracts/plugin';
import { ISettingsSlice } from './src/features/shared-contracts/slice-interfaces';
import { attachDebugCommands, detachDebugCommands } from './src/orchestrator/PluginDebugCommands';
import { registerPluginEvents } from './src/orchestrator/PluginEvents';
import { PluginViewInitializer } from './src/orchestrator/PluginViewInitializer';
import { ExtendedApp } from './src/features/shared-contracts/obsidian';

export default class CoalescePlugin extends Plugin {
	private orchestrator: PluginOrchestrator;
	private logger: Logger;
	private settings: CoalescePluginSettings;
	private viewInitializer: PluginViewInitializer;

	async onload() {
		// Initialize logger
		this.logger = new Logger('CoalescePlugin');

		// Initialize orchestrator
		this.orchestrator = new PluginOrchestrator(this.app, this);
		await this.orchestrator.initialize();
		await this.orchestrator.start();

		// Get settings slice
		const settingsSlice = this.orchestrator.getSlice<ISettingsSlice>('settings');
		if (settingsSlice) {
			const settingsUI = settingsSlice.getSettingsUI();
			const settingsTab = settingsUI.createSettingsTab(
				this,
				settingsSlice.getSettings(),
				(newSettings: Partial<CoalescePluginSettings>) => settingsSlice.updateSettings(newSettings)
			);
			this.addSettingTab(settingsTab);
		}

		// Initialize view initializer
		this.viewInitializer = new PluginViewInitializer(this.app, this.orchestrator);

		// Setup debug methods
		this.setupDebugMethods();

		// Register event handlers
		this.registerEventHandlers();

		this.logger.debug("Plugin initialization complete");
	}

	private setupDebugMethods() {
		// Use shared helper to attach debug commands to the app
		attachDebugCommands(this.app, this, this.orchestrator, this.logger);

		// Preserve explicit logging toggle helper on the app, so that
		// Logger.setGlobalLogging remains controlled from main.ts.
		(this.app as any).coalesceUpdateLogging = (enabled: boolean) => {
			Logger.setGlobalLogging(enabled);
			if (this.logger?.info) {
				this.logger.info(`Coalesce logging ${enabled ? 'enabled' : 'disabled'}`, { enabled });
			}
		};
	}


	private registerEventHandlers() {
		// Delegate DOM, workspace, and orchestrator event wiring to shared helper.
		// Use the view initializer's updateForFile so duplicate suppression and
		// UI attachment logic live in PluginViewInitializer.
		registerPluginEvents(
			this.app,
			this,
			this.orchestrator,
			this.logger,
			this.viewInitializer.updateForFile.bind(this.viewInitializer)
		);
	}


	onunload() {
		try {
			if (this.logger?.debug) {
				this.logger.debug("Unloading plugin");
			}

			// Cleanup orchestrator
			if (this.orchestrator) {
				this.orchestrator.cleanup();
			}

			// Clean up debug methods via shared helper
			detachDebugCommands(this.app);

			// Clean up Obsidian app plugin reference
			const obsidianApp = this.app as ExtendedApp;
			if (obsidianApp.plugins?.plugins?.coalesce) {
				obsidianApp.plugins.plugins.coalesce.log = undefined;
			}

			if (this.logger?.debug) {
				this.logger.debug("Plugin cleanup complete");
			}
		} catch (error) {
			console.error("Failed to cleanup Coalesce plugin:", error);
		}
	}
}