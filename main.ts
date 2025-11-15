import { App, Plugin, TFile, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './src/orchestrator';
import { LogLevel } from './src/features/shared-utilities';
import { CoalescePluginSettings, CoalescePluginInstance, ObsidianPlugins, ExtendedApp } from './src/features/shared-contracts';

export default class CoalescePlugin extends Plugin {
	private orchestrator: PluginOrchestrator;
	private lastProcessedFile: { path: string; timestamp: number } | null = null;
	private logger: any = {
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
		on: () => {},
		off: () => {},
		isEnabled: () => false
	};

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

			// Temporarily disable logger to prevent runtime errors
			// const sharedUtilities = this.orchestrator.getSlice('sharedUtilities') as { getLogger: (prefix?: string) => any };
			// this.logger = sharedUtilities?.getLogger('Coalesce');

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

			this.logger?.debug("Plugin initialization complete");
		} catch (error) {
			console.error("Failed to initialize Coalesce plugin:", error);
		}
	}

	private setupDebugMethods() {
		// Setup debug methods using orchestrator
		(this.app as any).coalesceTestFocus = () => {
			console.log("Coalesce plugin test focus called");
			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				(viewIntegration as any)?.requestFocusWhenReady?.(leafId);
			}
		};
		
		(this.app as any).coalesceStatus = () => {
			console.log("Coalesce plugin status:");
			console.log("- Plugin loaded:", !!this);
			console.log("- Orchestrator:", !!this.orchestrator);
			console.log("- Orchestrator state:", this.orchestrator.getState());
			console.log("- Orchestrator statistics:", this.orchestrator.getStatistics());
			console.log("- All markdown views:", this.app.workspace.getLeavesOfType('markdown').length);
		};

		(this.app as any).coalesceTestDirectFocus = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			console.log("Active view:", activeView);
			if (activeView) {
				const leafId = (activeView.leaf as any).id;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				const isReady = (viewIntegration as any)?.isViewReadyForFocus?.(leafId);
				console.log("View ready for focus:", isReady);
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
				console.log("View ready for focus:", isReady);
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
				console.log("No active markdown view found");
			}
		};

		(this.app as any).coalesceUpdateLogging = (enabled: boolean) => {
			// Temporarily disabled to prevent runtime errors
			console.log(`Coalesce logging ${enabled ? 'enabled' : 'disabled'}`);
		};

		(this.app as any).coalesceTestStyles = () => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const viewIntegration = this.orchestrator.getSlice('viewIntegration');
				const stats = (viewIntegration as any)?.getViewStatistics?.();
				console.log("View integration statistics:", stats);
			} else {
				console.log("No active markdown view found");
			}
		};

		// Add orchestrator debug methods
		(this.app as any).coalesceOrchestratorStatus = () => {
			console.log("Orchestrator status:");
			console.log("- State:", this.orchestrator.getState());
			console.log("- Statistics:", this.orchestrator.getStatistics());
			console.log("- All slices:", Object.keys(this.orchestrator.getAllSlices()));
		};

		(this.app as any).coalesceOrchestratorEvent = (eventType: string, data: any) => {
			console.log(`Eitting orchestrator event: ${eventType}`, data);
			this.orchestrator.emit(eventType, data);
		};

		(this.app as any).coalesceSliceStatus = (sliceName: string) => {
			const slice = this.orchestrator.getSlice(sliceName as any);
			if (slice) {
				console.log(`${sliceName} slice:`, slice);
				if (typeof (slice as any).getStatistics === 'function') {
					console.log(`${sliceName} statistics:`, (slice as any).getStatistics());
				}
				if (typeof (slice as any).getState === 'function') {
					console.log(`${sliceName} state:`, (slice as any).getState());
				}
			} else {
				console.log(`${sliceName} slice not found`);
			}
		};
	}

	private shouldProcessFile(filePath: string): boolean {
		const now = Date.now();
		const minInterval = 1000; // 1 second minimum between processing the same file

		console.log('Coalesce: shouldProcessFile called for', filePath);

		if (this.lastProcessedFile &&
			this.lastProcessedFile.path === filePath &&
			(now - this.lastProcessedFile.timestamp) < minInterval) {
			console.log('Coalesce: SKIPPING duplicate file processing', {
				filePath,
				timeSinceLast: now - this.lastProcessedFile.timestamp,
				minInterval
			});
			this.logger?.debug("Skipping duplicate file processing", { filePath, timeSinceLast: now - this.lastProcessedFile.timestamp });
			return false;
		}

		this.lastProcessedFile = { path: filePath, timestamp: now };
		console.log('Coalesce: ALLOWING file processing for', filePath);
		return true;
	}

	private async updateCoalesceUIForFile(filePath: string) {
		console.log('Coalesce: updateCoalesceUIForFile called for', filePath);

		// Prevent duplicate processing
		if (!this.shouldProcessFile(filePath)) {
			console.log('Coalesce: updateCoalesceUIForFile returning early due to shouldProcessFile');
			return;
		}

		console.log('Coalesce: updateCoalesceUIForFile proceeding with processing for', filePath);

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

console.log('Coalesce: Consolidated backlinks UI attached for', currentFilePath);
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
			console.log('Coalesce: Received coalesce-settings-collapse-changed event', { collapsed });

			try {
				const settingsSlice = this.orchestrator.getSlice('settings') as any;
				if (settingsSlice && typeof settingsSlice.handleCollapseStateChange === 'function') {
					settingsSlice.handleCollapseStateChange({ collapsed });
				} else {
					console.warn('Coalesce: Settings slice not available or handleCollapseStateChange method not found');
				}
			} catch (error) {
				this.logger?.error("Failed to handle coalesce-settings-collapse-changed event", { collapsed, error });
			}
		});

		// Register coalesce-navigate event handler - now handled by consolidated backlinks slice
		document.addEventListener('coalesce-navigate', (event: CustomEvent) => {
			const { filePath, openInNewTab, blockId } = event.detail;
			console.log('Coalesce: Received coalesce-navigate event for navigation', { filePath, openInNewTab, blockId });

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
			console.log('Coalesce: COALESCE-NAVIGATE-COMPLETE event triggered for', filePath);
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
					console.log('Coalesce: FILE-OPEN event triggered for', file.path);
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
			console.log('Coalesce: ORCHESTRATOR file:opened event triggered for', data.file?.path);

			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			const backlinks = this.orchestrator.getSlice('backlinks'); // Consolidated slice

			if (viewIntegration && backlinks && data.file) {
				console.log('Coalesce: ORCHESTRATOR processing file:opened for', data.file.path);

				// Initialize view for the file
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file?.path === data.file.path) {
					console.log('Coalesce: ORCHESTRATOR active view matches, proceeding');

					// Initialize view integration
					await (viewIntegration as any)?.initializeView?.(data.file, activeView);

					// Use the consolidated backlinks slice to attach the complete UI
					console.log('Coalesce: ORCHESTRATOR calling attachToDOM for', data.file.path);
					// Don't force refresh for orchestrator events (automatic app startup processing)
					const uiAttached = await (backlinks as any)?.attachToDOM?.(
					    activeView, // Pass the view, slice handles container creation and attachment
					    data.file.path,
					    false // forceRefresh = false for automatic orchestrator events
					);

					console.log('Coalesce: ORCHESTRATOR attachToDOM returned', uiAttached, 'for', data.file.path);

					// Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
					if (uiAttached) {
						console.log('Coalesce: ORCHESTRATOR applying settings for', data.file.path);

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

						console.log('Coalesce: Consolidated backlinks UI attached for', data.file.path);
					} else {
						console.log('Coalesce: ORCHESTRATOR UI was not attached (skipped) for', data.file.path);
					}
				} else {
					console.log('Coalesce: ORCHESTRATOR active view does not match', {
						activeViewPath: activeView?.file?.path,
						eventFilePath: data.file.path
					});
				}
			} else {
				console.log('Coalesce: ORCHESTRATOR missing required slices or data', {
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
		console.log('Coalesce: initializeExistingViews called');

		// Use requestAnimationFrame to ensure workspace is fully ready
		requestAnimationFrame(() => {
			const existingViews = this.app.workspace.getLeavesOfType('markdown');
			console.log('Coalesce: initializeExistingViews found', existingViews.length, 'existing views');

			if (existingViews.length > 0) {
				this.logger?.debug("Initializing existing views on fresh app load", { count: existingViews.length });

				existingViews.forEach((leaf, index) => {
					const view = leaf.view as MarkdownView;
					if (view?.file) {
						console.log('Coalesce: initializeExistingViews emitting file:opened for view', index, 'file:', view.file.path);
						// Emit file open event for each existing view
						this.orchestrator.emit('file:opened', { file: view.file });
					} else {
						console.log('Coalesce: initializeExistingViews skipping view', index, '- no file');
					}
				});
			}

			// Fallback check in case views weren't ready yet
			setTimeout(() => {
				const delayedViews = this.app.workspace.getLeavesOfType('markdown');
				console.log('Coalesce: initializeExistingViews fallback check found', delayedViews.length, 'delayed views');

				if (delayedViews.length > existingViews.length) {
					console.log('Coalesce: initializeExistingViews processing additional views');

					delayedViews.forEach((leaf, index) => {
						const view = leaf.view as MarkdownView;
						if (view?.file) {
							console.log('Coalesce: initializeExistingViews fallback emitting file:opened for delayed view', index, 'file:', view.file.path);
							// Emit file open event for new views
							this.orchestrator.emit('file:opened', { file: view.file });
						} else {
							console.log('Coalesce: initializeExistingViews fallback skipping delayed view', index, '- no file');
						}
					});
				} else {
					console.log('Coalesce: initializeExistingViews fallback - no additional views to process');
				}
			}, 500);
		});
	}

	onunload() {
		this.logger?.debug("Unloading plugin");
		
		try {
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
			
			this.logger?.debug("Plugin cleanup complete");
		} catch (error) {
			console.error("Failed to cleanup Coalesce plugin:", error);
		}
	}
}