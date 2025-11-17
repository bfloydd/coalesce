import { Plugin, TFile, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './src/orchestrator';
import { CoalescePluginSettings, ExtendedApp } from './src/features/shared-contracts';
import { Logger } from './src/features/shared-utilities/Logger';

export default class CoalescePlugin extends Plugin {
	private orchestrator: PluginOrchestrator;
	private lastProcessedFile: { path: string; timestamp: number } | null = null;
	private logger: any;

	async onload() {
		try {
			// Initialize orchestrator with configuration
			this.orchestrator = new PluginOrchestrator(this.app, this, {
				enableLogging: true,
				enableEventDebugging: false,
				enablePerformanceMonitoring: true,
				enableErrorRecovery: true,
				maxRetries: 3,
				retryDelay: 1000
			});

			// Initialize orchestrator
			await this.orchestrator.initialize();

			// Start orchestrator
			await this.orchestrator.start();

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
			this.initializeExistingViews();

			if (this.logger?.debug) {
				this.logger.debug("Plugin initialization complete");
			}
		} catch (error) {
			console.error("Failed to initialize Coalesce plugin:", error);
		}
	}

	private setupDebugMethods() {
		// Setup debug methods using orchestrator
		(this.app as any).coalesceTestFocus = () => {
			this.logger?.debug("Coalesce plugin test focus called");
			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				(viewIntegration as any)?.requestFocusWhenReady?.(leafId);
			}
		};
		
		(this.app as any).coalesceStatus = () => {
			this.logger?.info("Coalesce plugin status", {
				pluginLoaded: !!this,
				orchestrator: !!this.orchestrator,
				orchestratorState: this.orchestrator.getState(),
				orchestratorStatistics: this.orchestrator.getStatistics(),
				markdownViews: this.app.workspace.getLeavesOfType('markdown').length
			});
		};

		(this.app as any).coalesceTestDirectFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			this.logger?.debug("Test direct focus - active view", { activeView: !!activeView });
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				const isReady = (viewIntegration as any)?.isViewReadyForFocus?.(leafId);
				this.logger?.debug("Test direct focus - view ready status", { leafId, isReady });
			}
		};

		(this.app as any).coalesceForceFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				(viewIntegration as any)?.requestFocusWhenReady?.(leafId);
			}
		};

		(this.app as any).coalesceDirectFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				const isReady = (viewIntegration as any)?.isViewReadyForFocus?.(leafId);
				this.logger?.debug("Direct focus - view ready status", { leafId, isReady });
			}
		};

		(this.app as any).coalesceTestWindowFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				(viewIntegration as any)?.requestFocusWhenReady?.(leafId);
			}
		};

		(this.app as any).coalesceTestSimpleFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				(viewIntegration as any)?.requestFocusWhenReady?.(leafId);
			} else {
				this.logger?.warn("No active markdown view found for simple focus test");
			}
		};

		(this.app as any).coalesceUpdateLogging = (enabled: boolean) => {
			// Update the global logging state for all loggers
			Logger.setGlobalLogging(enabled);
			if (this.logger?.info) {
				this.logger.info(`Coalesce logging ${enabled ? 'enabled' : 'disabled'}`, { enabled });
			}
		};

		(this.app as any).coalesceTestStyles = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				const stats = (viewIntegration as any)?.getViewStatistics?.();
				this.logger?.info("View integration statistics", { stats });
			} else {
				this.logger?.warn("No active markdown view found for style test");
			}
		};

		// Add orchestrator debug methods
		(this.app as any).coalesceOrchestratorStatus = () => {
			this.logger?.info("Orchestrator status", {
				state: this.orchestrator.getState(),
				statistics: this.orchestrator.getStatistics(),
				allSlices: Object.keys(this.orchestrator.getAllSlices())
			});
		};

		(this.app as any).coalesceOrchestratorEvent = (eventType: string, data: any) => {
			this.logger?.debug(`Emitting orchestrator event: ${eventType}`, { data });
			this.orchestrator.emit(eventType, data);
		};

		(this.app as any).coalesceSliceStatus = (sliceName: string) => {
			const slice = this.orchestrator.getSlice(sliceName as any);
			if (slice) {
				this.logger?.info(`${sliceName} slice found`, { sliceName });
				if (typeof (slice as any).getStatistics === 'function') {
					this.logger?.info(`${sliceName} statistics`, { statistics: (slice as any).getStatistics() });
				}
				if (typeof (slice as any).getState === 'function') {
					this.logger?.info(`${sliceName} state`, { state: (slice as any).getState() });
				}
			} else {
				this.logger?.warn(`${sliceName} slice not found`, { sliceName });
			}
		};
	}

	private shouldProcessFile(filePath: string): boolean {
		const now = Date.now();
		const minInterval = 1000; // 1 second minimum between processing the same file

		this.logger?.debug('Checking if file should be processed', { filePath });

		if (this.lastProcessedFile &&
			this.lastProcessedFile.path === filePath &&
			(now - this.lastProcessedFile.timestamp) < minInterval) {
			this.logger?.debug("Skipping duplicate file processing", {
				filePath,
				timeSinceLast: now - this.lastProcessedFile.timestamp,
				minInterval
			});
			return false;
		}

		this.lastProcessedFile = { path: filePath, timestamp: now };
		this.logger?.debug('Allowing file processing', { filePath });
		return true;
	}

	private async updateCoalesceUIForFile(filePath: string) {
		this.logger?.debug('Updating Coalesce UI for file', { filePath });

		// Prevent duplicate processing
		if (!this.shouldProcessFile(filePath)) {
			this.logger?.debug('Returning early due to shouldProcessFile check', { filePath });
			return;
		}

		this.logger?.debug('Proceeding with UI update for file', { filePath });

		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.file) {
				// Get consolidated backlinks slice and other necessary slices
				const backlinksSlice = this.orchestrator.getSlice('backlinks') as any;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration') as any;
				const settingsSlice = this.orchestrator.getSlice('settings') as any;

				if (backlinksSlice && viewIntegration && settingsSlice) {
					// Initialize view integration first
					await viewIntegration.initializeView?.(activeView.file, activeView);

					// Always clear existing coalesce containers from the active view
					const existingContainers = activeView.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
					existingContainers.forEach(container => container.remove());

					// Get current settings - ensure settings are loaded
					let settings = settingsSlice.getSettings();

					// If settings aren't loaded yet, load them now
					if (!settings || Object.keys(settings).length === 0) {
						await settingsSlice.loadSettings?.();
						settings = settingsSlice.getSettings() || {};
					}

					const currentFilePath = activeView.file.path;

					// Use the consolidated backlinks slice to attach the complete UI
					// The slice will handle backlink discovery, block extraction, header UI, and rendering
					// Force refresh for user-initiated file opens to ensure backlinks are always current
					const uiAttached = await backlinksSlice.attachToDOM?.(
						activeView, // Pass the view, slice handles container creation and attachment
						currentFilePath,
						true // forceRefresh = true for user file-open events
					);

// Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
if (uiAttached) {
    // Apply current settings to the backlinks UI
    backlinksSlice.setOptions?.({
        sort: settings.sortByFullPath || false,
        collapsed: settings.blocksCollapsed || false,
        strategy: 'default', // Default strategy
        theme: settings.theme || 'default',
        alias: null, // No alias filter by default
        filter: '' // No text filter by default
    });

    this.logger?.info('Consolidated backlinks UI attached for file', { currentFilePath });
}
				}
			}
		} catch (error) {
			this.logger?.error("Failed to update Coalesce UI for file", { filePath, error });
		}
	}

	private registerEventHandlers() {
		// Register coalesce-settings-collapse-changed event handler
		document.addEventListener('coalesce-settings-collapse-changed', (event: CustomEvent) => {
			const { collapsed } = event.detail;
			this.logger?.debug('Received coalesce-settings-collapse-changed event', { collapsed });

			try {
				const settingsSlice = this.orchestrator.getSlice('settings') as any;
				if (settingsSlice && typeof settingsSlice.handleCollapseStateChange === 'function') {
					settingsSlice.handleCollapseStateChange({ collapsed });
				} else {
					this.logger?.warn('Settings slice not available or handleCollapseStateChange method not found');
				}
			} catch (error) {
				this.logger?.error("Failed to handle coalesce-settings-collapse-changed event", { collapsed, error });
			}
		});

		// Register coalesce-logging-state-changed event handler
		document.addEventListener('coalesce-logging-state-changed', (event: CustomEvent) => {
			const { enabled } = event.detail;
			try {
				// Update the global logging state for all loggers
				Logger.setGlobalLogging(enabled);
				if (this.logger?.debug) {
					this.logger.debug('Received coalesce-logging-state-changed event', { enabled });
				}
			} catch (error) {
				console.error("Failed to handle coalesce-logging-state-changed event", { enabled, error });
			}
		});

		// Register coalesce-navigate event handler - now handled by consolidated backlinks slice
		document.addEventListener('coalesce-navigate', (event: CustomEvent) => {
			const { filePath, openInNewTab, blockId } = event.detail;
			this.logger?.debug('Received coalesce-navigate event for navigation', { filePath, openInNewTab, blockId });

			try {
				const backlinks = this.orchestrator.getSlice('backlinks') as any;
				if (backlinks && typeof backlinks.handleNavigation === 'function') {
					backlinks.handleNavigation(filePath, openInNewTab || false, blockId);
				} else {
					// Fallback to direct navigation if backlinks slice not available
					const linkText = blockId ? `[[${filePath}#^${blockId}]]` : `[[${filePath}]]`;
					this.app.workspace.openLinkText(linkText, '', openInNewTab || false);
				}
			} catch (error) {
				this.logger?.error("Failed to handle coalesce-navigate event", { filePath, openInNewTab, blockId, error });
			}
		});

		// Register coalesce-navigate-complete event handler
		document.addEventListener('coalesce-navigate-complete', (event: CustomEvent) => {
			const { filePath } = event.detail;
			this.logger?.debug("Coalesce navigate complete event", { filePath });

			try {
				// Manually update Coalesce UI for the new file
				this.updateCoalesceUIForFile(filePath);
			} catch (error) {
				this.logger?.error("Failed to handle coalesce-navigate-complete event", { filePath, error });
			}
		});

		// Register file open handler as fallback
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file) {
					this.logger?.debug("File open event (fallback)", {
						path: file.path,
						extension: file.extension,
						basename: file.basename
					});

					// Update Coalesce UI for the opened file (with duplicate prevention)
					this.updateCoalesceUIForFile(file.path);
				}
			})
		);

		// Register layout change handler
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.logger?.debug("Layout change event", { path: activeView.file.path });
					
					// Handle through orchestrator
					this.orchestrator.emit('layout:changed', { 
						file: activeView.file,
						view: activeView 
					});
				}
			})
		);

		// Register active leaf change handler
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					this.logger?.debug("Active leaf change event", { path: activeView.file.path });
					
					// Handle through orchestrator
					this.orchestrator.emit('active-leaf:changed', { 
						file: activeView.file,
						view: activeView 
					});
				}
			})
		);

		// Register orchestrator event listeners for slice coordination
		this.orchestrator.on('file:opened', async (data: any) => {
			this.logger?.debug('Orchestrator file:opened event triggered', { filePath: data.file?.path });

			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			const backlinks = this.orchestrator.getSlice('backlinks'); // Consolidated slice

			if (viewIntegration && backlinks && data.file) {
				this.logger?.debug('Orchestrator processing file:opened', { filePath: data.file.path });

				// Initialize view for the file
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file?.path === data.file.path) {
					this.logger?.debug('Orchestrator active view matches, proceeding', { filePath: data.file.path });

					// Initialize view integration
					await (viewIntegration as any)?.initializeView?.(data.file, activeView);

					// Use the consolidated backlinks slice to attach the complete UI
					this.logger?.debug('Orchestrator calling attachToDOM', { filePath: data.file.path });
					// Don't force refresh for orchestrator events (automatic app startup processing)
					const uiAttached = await (backlinks as any)?.attachToDOM?.(
						activeView, // Pass the view, slice handles container creation and attachment
						data.file.path,
						false // forceRefresh = false for automatic orchestrator events
					);

					this.logger?.debug('Orchestrator attachToDOM result', { filePath: data.file.path, uiAttached });

					// Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
					if (uiAttached) {
						this.logger?.debug('Orchestrator applying settings', { filePath: data.file.path });

						// Apply current settings to the backlinks UI
						const settingsSlice = this.orchestrator.getSlice('settings') as any;
						let settings = settingsSlice?.getSettings?.() || {};

						// If settings aren't loaded yet, load them now
						if (!settings || Object.keys(settings).length === 0) {
							await settingsSlice?.loadSettings?.();
							settings = settingsSlice?.getSettings?.() || {};
						}

						(backlinks as any)?.setOptions?.({
							sort: settings.sortByFullPath || false,
							collapsed: settings.blocksCollapsed || false,
							strategy: 'default',
							theme: settings.theme || 'default',
							alias: null,
							filter: ''
						});

						this.logger?.info('Consolidated backlinks UI attached for file', { filePath: data.file.path });
					} else {
						this.logger?.debug('Orchestrator UI was not attached (skipped)', { filePath: data.file.path });
					}
				} else {
					this.logger?.debug('Orchestrator active view does not match', {
						activeViewPath: activeView?.file?.path,
						eventFilePath: data.file.path
					});
				}
			} else {
				this.logger?.debug('Orchestrator missing required slices or data', {
					hasViewIntegration: !!viewIntegration,
					hasBacklinks: !!backlinks,
					hasFile: !!data.file
				});
			}
		});

		this.orchestrator.on('layout:changed', (data: any) => {
			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			
			if (viewIntegration && data.file && data.view) {
				// Handle mode switch
				(viewIntegration as any)?.handleModeSwitch?.(data.file, data.view);
			}
		});

		this.orchestrator.on('active-leaf:changed', (data: any) => {
			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			
			if (viewIntegration && data.file && data.view) {
				// Handle focus change
				(viewIntegration as any)?.handleFocusChange?.(data.view, true);
				
				// Handle leaf activation
				(viewIntegration as any)?.handleLeafActivation?.(data.view.leaf);
			}
		});
	}

	private initializeExistingViews() {
		this.logger?.debug('Initializing existing views');

		// Use requestAnimationFrame to ensure workspace is fully ready
		requestAnimationFrame(() => {
			const existingViews = this.app.workspace.getLeavesOfType('markdown');
			this.logger?.debug('Found existing views on app load', { count: existingViews.length });

			if (existingViews.length > 0) {
				this.logger?.debug("Initializing existing views on fresh app load", { count: existingViews.length });

				existingViews.forEach((leaf, index) => {
					const view = leaf.view as MarkdownView;
					if (view?.file) {
						this.logger?.debug('Emitting file:opened for existing view', {
							index,
							filePath: view.file.path
						});
						// Emit file open event for each existing view
						this.orchestrator.emit('file:opened', { file: view.file });
					} else {
						this.logger?.debug('Skipping existing view - no file', { index });
					}
				});
			}

			// Fallback check in case views weren't ready yet
			setTimeout(() => {
				const delayedViews = this.app.workspace.getLeavesOfType('markdown');
				this.logger?.debug('Fallback check for delayed views', { count: delayedViews.length });

				if (delayedViews.length > existingViews.length) {
					this.logger?.debug('Processing additional delayed views', {
						originalCount: existingViews.length,
						delayedCount: delayedViews.length
					});

					delayedViews.forEach((leaf, index) => {
						const view = leaf.view as MarkdownView;
						if (view?.file) {
							this.logger?.debug('Emitting file:opened for delayed view', {
								index,
								filePath: view.file.path
							});
							// Emit file open event for new views
							this.orchestrator.emit('file:opened', { file: view.file });
						} else {
							this.logger?.debug('Skipping delayed view - no file', { index });
						}
					});
				} else {
					this.logger?.debug('No additional delayed views to process');
				}
			}, 500);
		});
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

			// Clean up debug methods
			const app = this.app as any;
			delete app.coalesceTestFocus;
			delete app.coalesceStatus;
			delete app.coalesceTestDirectFocus;
			delete app.coalesceForceFocus;
			delete app.coalesceDirectFocus;
			delete app.coalesceTestWindowFocus;
			delete app.coalesceTestSimpleFocus;
			delete app.coalesceUpdateLogging;
			delete app.coalesceTestStyles;
			delete app.coalesceOrchestratorStatus;
			delete app.coalesceOrchestratorEvent;
			delete app.coalesceSliceStatus;

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