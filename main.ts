import { App, Plugin, TFile, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './src/orchestrator';
import { LogLevel } from './src/features/shared-utilities';
import { CoalescePluginSettings, CoalescePluginInstance, ObsidianPlugins, ExtendedApp } from './src/features/shared-contracts';

export default class CoalescePlugin extends Plugin {
	private orchestrator: PluginOrchestrator;
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

	private registerEventHandlers() {
		// Register file open handler
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file) {
					this.logger?.debug("File open event", { 
						path: file.path,
						extension: file.extension,
						basename: file.basename
					});
					
					// Handle through orchestrator
					this.orchestrator.emit('file:opened', { file });
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
			const viewIntegration = this.orchestrator.getSlice('viewIntegration');
			const backlinks = this.orchestrator.getSlice('backlinks');
			const backlinkBlocks = this.orchestrator.getSlice('backlinkBlocks');
			const backlinksHeader = this.orchestrator.getSlice('backlinksHeader');

			if (viewIntegration && backlinks && backlinkBlocks && backlinksHeader && data.file) {
				// Initialize view for the file
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file?.path === data.file.path) {
					// Initialize view integration
					await (viewIntegration as any)?.initializeView?.(data.file, activeView);

					// Get backlinks for the file
					const backlinkFiles = await (backlinks as any)?.discoverBacklinks?.(data.file.path) || [];
					console.log('Coalesce: Discovered backlinks for', data.file.path, ':', backlinkFiles);

					if (backlinkFiles.length > 0) {
						// Get settings for initial state - ensure settings are loaded
						const settingsSlice = this.orchestrator.getSlice('settings') as any;
						let settings = settingsSlice?.getSettings?.() || {};

						// If settings aren't loaded yet, load them now
						if (!settings || Object.keys(settings).length === 0) {
							await settingsSlice?.loadSettings?.();
							settings = settingsSlice?.getSettings?.() || {};
						}

						// Create container for the UI
						const container = document.createElement('div');
						container.className = 'coalesce-custom-backlinks-container';

						// Create header with full callback wiring so controls work (including Block selector)
						const headerElement = (backlinksHeader as any)?.createHeader?.(container, {
							fileCount: backlinkFiles.length,
							sortDescending: true,
							isCollapsed: false,
							currentStrategy: 'default',
							currentTheme: 'default',
							showFullPathTitle: false,
							aliases: [],
							currentAlias: null,
							unsavedAliases: [],
							currentHeaderStyle: 'full',
							currentFilter: '',
							onSortToggle: () => (backlinksHeader as any)?.handleSortToggle?.(),
							onCollapseToggle: () => (backlinksHeader as any)?.handleCollapseToggle?.(),
							onStrategyChange: (strategy: string) => (backlinksHeader as any)?.handleStrategyChange?.(strategy),
							onThemeChange: (theme: string) => (backlinksHeader as any)?.handleThemeChange?.(theme),
							onFullPathTitleChange: (show: boolean) => (backlinksHeader as any)?.updateHeaderState?.({ showFullPathTitle: show }),
							onAliasSelect: (alias: string | null) => (backlinksHeader as any)?.handleAliasSelection?.(alias),
							onHeaderStyleChange: (style: string) => (backlinksHeader as any)?.updateHeaderState?.({ currentHeaderStyle: style }),
							onFilterChange: (filterText: string) => (backlinksHeader as any)?.handleFilterChange?.(filterText),
							onSettingsClick: () => (backlinksHeader as any)?.handleSettingsClick?.()
						});

						if (headerElement) {
							container.appendChild(headerElement);
						}

						// Create blocks container
						const blocksContainer = document.createElement('div');
						blocksContainer.className = 'backlinks-list';
						container.appendChild(blocksContainer);

						// Update block render options with default collapse state
						(backlinkBlocks as any)?.updateRenderOptions?.({
							collapsed: false
						});

						// Extract and render blocks
						console.log('Coalesce: Extracting blocks from files:', backlinkFiles, 'for note:', data.file.basename);
						await (backlinkBlocks as any)?.extractAndRenderBlocks?.(
							backlinkFiles,
							data.file.basename,
							blocksContainer
						);
						console.log('Coalesce: Block extraction completed, container children:', blocksContainer.children.length);

						// Attach container to view
						const success = (viewIntegration as any)?.attachToView?.(activeView, container);
						if (success) {
							console.log('Coalesce UI attached successfully');
						}
					}
				}
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
		// Use requestAnimationFrame to ensure workspace is fully ready
		requestAnimationFrame(() => {
			const existingViews = this.app.workspace.getLeavesOfType('markdown');
			if (existingViews.length > 0) {
				this.logger?.debug("Initializing existing views on fresh app load", { count: existingViews.length });
				
				existingViews.forEach(leaf => {
					const view = leaf.view as MarkdownView;
					if (view?.file) {
						// Emit file open event for each existing view
						this.orchestrator.emit('file:opened', { file: view.file });
					}
				});
			}
			
			// Fallback check in case views weren't ready yet
			setTimeout(() => {
				const delayedViews = this.app.workspace.getLeavesOfType('markdown');
				if (delayedViews.length > existingViews.length) {
					delayedViews.forEach(leaf => {
						const view = leaf.view as MarkdownView;
						if (view?.file) {
							// Emit file open event for new views
							this.orchestrator.emit('file:opened', { file: view.file });
						}
					});
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