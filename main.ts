import { Plugin, TFile, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './src/orchestrator';
import { CoalescePluginSettings, ExtendedApp } from './src/features/shared-contracts';
import { Logger } from './src/features/shared-utilities/Logger';
import { createAndStartOrchestrator } from './src/orchestrator/PluginBootstrap';
import { attachDebugCommands, detachDebugCommands } from './src/orchestrator/PluginDebugCommands';
import { registerPluginEvents } from './src/orchestrator/PluginEvents';
import { createViewInitializer, PluginViewInitializer } from './src/orchestrator/PluginViewInitializer';

export default class CoalescePlugin extends Plugin {
	private orchestrator: PluginOrchestrator;
	private logger: any;
	private viewInitializer: PluginViewInitializer;

	async onload() {
		try {
			// Initialize and start orchestrator with configuration
			this.orchestrator = await createAndStartOrchestrator(this.app, this, {
				enableLogging: true,
				enableEventDebugging: false,
				enablePerformanceMonitoring: true,
				enableErrorRecovery: true,
				maxRetries: 3,
				retryDelay: 1000
			});

			// Initialize logger from shared utilities
			const sharedUtilities = this.orchestrator.getSlice('sharedUtilities') as { getLogger: (prefix?: string) => any };
			try {
				this.logger = sharedUtilities?.getLogger?.('Coalesce');
				// Verify the logger has the expected methods
				if (!this.logger || typeof this.logger.debug !== 'function') {
					throw new Error('Logger not properly initialized');
				}
			} catch (error) {
				console.warn('Failed to initialize logger from shared utilities, using fallback:', error);
				// Fallback logger
				this.logger = {
					debug: (message?: any, ...args: any[]) => console.debug('[Coalesce]', message, ...args),
					info: (message?: any, ...args: any[]) => console.info('[Coalesce]', message, ...args),
					warn: (message?: any, ...args: any[]) => console.warn('[Coalesce]', message, ...args),
					error: (message?: any, ...args: any[]) => console.error('[Coalesce]', message, ...args)
				};
			}

			// Set initial global logging state based on settings
			const settingsSliceInit = this.orchestrator.getSlice('settings') as any;
			if (settingsSliceInit) {
				const settings = settingsSliceInit.getSettings?.() || {};
				Logger.setGlobalLogging(settings.enableLogging || false);
			}

			// Create view initializer helper
			this.viewInitializer = createViewInitializer(this.app, this.orchestrator, this.logger);

			// Setup debug methods for development
			this.setupDebugMethods();

			// Register event handlers
			this.registerEventHandlers();

			// Add settings tab
			const settingsSlice = this.orchestrator.getSlice('settings') as any;
			if (settingsSlice) {
				// Ensure settings are loaded before creating settings tab
				await settingsSlice.loadSettings();
				
				const settingsUI = settingsSlice.getSettingsUI();
				const settingsTab = settingsUI.createSettingsTab(
					this,
					settingsSlice.getSettings(),
					(settings: Partial<CoalescePluginSettings>) => {
						settingsSlice.updateSettings(settings);
					}
				);
				this.addSettingTab(settingsTab);
			}

			// Initialize existing views
			this.viewInitializer.initializeExistingViews();

			if (this.logger?.debug) {
				this.logger.debug("Plugin initialization complete");
			}
		} catch (error) {
			console.error("Failed to initialize Coalesce plugin:", error);
		}
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