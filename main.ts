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

		if (this.lastProcessedFile &&
			this.lastProcessedFile.path === filePath &&
			(now - this.lastProcessedFile.timestamp) < minInterval) {
			this.logger?.debug("Skipping duplicate file processing", { filePath, timeSinceLast: now - this.lastProcessedFile.timestamp });
			return false;
		}

		this.lastProcessedFile = { path: filePath, timestamp: now };
		return true;
	}

	private async updateCoalesceUIForFile(filePath: string) {
		// Prevent duplicate processing
		if (!this.shouldProcessFile(filePath)) {
			return;
		}

		try {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.file) {
				// Get slices first
				const backlinksSlice = this.orchestrator.getSlice('backlinks') as any;
				const backlinkBlocksSlice = this.orchestrator.getSlice('backlinkBlocks') as any;
				const viewIntegration = this.orchestrator.getSlice('viewIntegration') as any;
				const settingsSlice = this.orchestrator.getSlice('settings') as any;

				if (backlinksSlice && backlinkBlocksSlice && viewIntegration && settingsSlice) {
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

					// Extract display name from frontmatter
					const frontmatter = this.app.metadataCache.getFileCache(activeView.file)?.frontmatter;
					let displayName = activeView.file.basename;
					if (frontmatter?.title) {
						displayName = frontmatter.title;
					}

					const currentFilePath = activeView.file.path;

					// Discover backlinks (with delay to allow metadata cache to update)
					await new Promise(resolve => setTimeout(resolve, 100));
					const backlinkFiles = await backlinksSlice.discoverBacklinks(currentFilePath);
					console.log('Coalesce: Discovered backlinks for', currentFilePath, ':', backlinkFiles);

					// Only render UI if there are backlinks
					if (backlinkFiles.length > 0) {
						const currentCollapsed = settings.blocksCollapsed || false;
						const sortByPath = true; // Always sort by path

						// Create container for the UI
						const container = document.createElement('div');
						container.className = 'coalesce-custom-backlinks-container';

						// Extract aliases and title from the current file's frontmatter
						const frontmatter = this.app.metadataCache.getFileCache(activeView.file)?.frontmatter;
						let fileAliases: string[] = [];
						let displayName = activeView.file.basename;
						if (frontmatter) {
						    const aliases = frontmatter.aliases || frontmatter.alias;
						    if (Array.isArray(aliases)) {
						        fileAliases = aliases;
						    } else if (typeof aliases === 'string') {
						        fileAliases = [aliases];
						    }

						    // Use title from frontmatter if available
						    if (frontmatter.title) {
						        displayName = frontmatter.title;
						    }
						}

						// Update header slice with correct sort state
						const backlinksHeader = this.orchestrator.getSlice('backlinksHeader') as any;
						backlinksHeader?.setInitialSortState?.(sortByPath, settings.sortDescending);

						// Create header with full callback wiring
						const headerElement = backlinksHeader?.createHeader?.(container, {
						    fileCount: backlinkFiles.length,
						    sortDescending: settings.sortDescending,
						    isCollapsed: currentCollapsed,
						    currentStrategy: 'default',
						    currentTheme: settings.theme || 'default',
						    showFullPathTitle: false,
						    aliases: fileAliases,
						    currentAlias: null,
						    unsavedAliases: [],
						    currentHeaderStyle: 'full',
						    currentFilter: '',
						    onSortToggle: () => backlinksHeader?.handleSortToggle?.(),
						    onCollapseToggle: () => backlinksHeader?.handleCollapseToggle?.(),
						    onStrategyChange: (strategy: string) => backlinksHeader?.handleStrategyChange?.(strategy),
						    onThemeChange: (theme: string) => {
						        backlinksHeader?.handleThemeChange?.(theme);
						        // Save theme to settings
						        settingsSlice?.updateSettings?.({ theme });
						    },
						    onFullPathTitleChange: (show: boolean) => backlinksHeader?.updateHeaderState?.({ showFullPathTitle: show }),
						    onAliasSelect: (alias: string | null) => backlinksHeader?.handleAliasSelection?.(alias),
						    onHeaderStyleChange: (style: string) => backlinksHeader?.handleHeaderStyleChange?.(style),
						    onFilterChange: (filterText: string) => backlinksHeader?.handleFilterChange?.(filterText),
						    onSettingsClick: () => backlinksHeader?.handleSettingsClick?.()
						});

						if (headerElement) {
							container.appendChild(headerElement);
						}

						// Set initial theme on backlink blocks slice
						backlinkBlocksSlice.setCurrentTheme?.(settings.theme || 'default');

						// Create blocks container
						const blocksContainer = document.createElement('div');
						blocksContainer.className = 'backlinks-list';
						container.appendChild(blocksContainer);

						// Update block render options with current state
						backlinkBlocksSlice.updateRenderOptions?.({
							collapsed: currentCollapsed,
							sortByPath: sortByPath,
							sortDescending: settings.sortDescending
						});

						// Extract and render blocks
						console.log('Coalesce: Extracting blocks from files:', backlinkFiles, 'for note:', displayName, 'using file path:', currentFilePath);
						if (backlinkFiles.length > 0) {
							backlinkBlocksSlice.extractAndRenderBlocks?.(
								backlinkFiles,
								currentFilePath, // Use full file path for block extraction to match links
								blocksContainer
							);
							console.log('Coalesce: Block extraction completed, container children:', blocksContainer.children.length);
						} else {
							console.log('Coalesce: No backlink files to extract blocks from');
						}

						// Attach container to view
						const success = viewIntegration.attachToView?.(activeView, container);
						if (success) {
							console.log('Coalesce UI attached successfully');
						}
					} else {
						console.log('Coalesce: No backlinks found for', currentFilePath, '- UI not rendered');
					}
				}
			}
		} catch (error) {
			this.logger?.error("Failed to update Coalesce UI for file", { filePath, error });
		}
	}

	private registerEventHandlers() {
		// Register coalesce-navigate event handler
		document.addEventListener('coalesce-navigate', (event: CustomEvent) => {
			const { filePath, openInNewTab, blockId } = event.detail;
			console.log('Coalesce: Received coalesce-navigate event for scrolling to block location', { filePath, openInNewTab, blockId });
			this.logger?.debug("Coalesce navigate event", { filePath, openInNewTab, blockId });

			try {
				if (blockId) {
				    // Use Obsidian's built-in link handling for block references
				    const linkText = `[[${filePath}#^${blockId}]]`;
				    console.log('Coalesce: Attempting to scroll to block location using Obsidian link:', linkText);
				    this.app.workspace.openLinkText(linkText, '', openInNewTab || false);
				    console.log('Coalesce: Block reference navigation initiated for', filePath, 'block', blockId);
				} else {
					// Fallback to navigation slice for regular file navigation
					console.log('Coalesce: No blockId provided, using regular navigation for', filePath);
					const navigation = this.orchestrator.getSlice('navigation');
					if (navigation) {
						(navigation as any).handleLinkClick(filePath, openInNewTab || false);
					}
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

						// Detach any existing coalesce containers from the active view
						const existingContainers = activeView.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
						existingContainers.forEach(container => container.remove());

						// Create container for the UI
						const container = document.createElement('div');
						container.className = 'coalesce-custom-backlinks-container';

						// Extract aliases and title from the current file's frontmatter
						const frontmatter = this.app.metadataCache.getFileCache(data.file)?.frontmatter;
						let fileAliases: string[] = [];
						let displayName = data.file.basename; // Default to basename
						if (frontmatter) {
						    const aliases = frontmatter.aliases || frontmatter.alias;
						    if (Array.isArray(aliases)) {
						        fileAliases = aliases;
						    } else if (typeof aliases === 'string') {
						        fileAliases = [aliases];
						    }

						    // Use title from frontmatter if available
						    if (frontmatter.title) {
						        displayName = frontmatter.title;
						    }
						}

						// Get current collapse state from settings to maintain state across file navigation
						const currentCollapsed = settings.blocksCollapsed || false;

						// Sorting is always enabled, just set the direction
						const sortByPath = true;

						// Update header slice with correct sort state
						(backlinksHeader as any)?.setInitialSortState?.(sortByPath, settings.sortDescending);

						// Create header with full callback wiring so controls work (including Block selector)
						const headerElement = (backlinksHeader as any)?.createHeader?.(container, {
						    fileCount: backlinkFiles.length,
						    sortDescending: settings.sortDescending,
						    isCollapsed: currentCollapsed,
						    currentStrategy: 'default',
						    currentTheme: settings.theme || 'default',
						    showFullPathTitle: false,
						    aliases: fileAliases,
						    currentAlias: null,
						    unsavedAliases: [],
						    currentHeaderStyle: 'full',
						    currentFilter: '',
						    onSortToggle: () => (backlinksHeader as any)?.handleSortToggle?.(),
						    onCollapseToggle: () => (backlinksHeader as any)?.handleCollapseToggle?.(),
						    onStrategyChange: (strategy: string) => (backlinksHeader as any)?.handleStrategyChange?.(strategy),
						    onThemeChange: (theme: string) => {
						        (backlinksHeader as any)?.handleThemeChange?.(theme);
						        // Save theme to settings
						        settingsSlice?.updateSettings?.({ theme });
						    },
						    onFullPathTitleChange: (show: boolean) => (backlinksHeader as any)?.updateHeaderState?.({ showFullPathTitle: show }),
						    onAliasSelect: (alias: string | null) => (backlinksHeader as any)?.handleAliasSelection?.(alias),
						    onHeaderStyleChange: (style: string) => (backlinksHeader as any)?.handleHeaderStyleChange?.(style),
						    onFilterChange: (filterText: string) => (backlinksHeader as any)?.handleFilterChange?.(filterText),
						    onSettingsClick: () => (backlinksHeader as any)?.handleSettingsClick?.()
						});

						if (headerElement) {
							container.appendChild(headerElement);
						}

						// Set initial theme on backlink blocks slice
						(backlinkBlocks as any)?.setCurrentTheme?.(settings.theme || 'default');

						// Create blocks container
						const blocksContainer = document.createElement('div');
						blocksContainer.className = 'backlinks-list';
						container.appendChild(blocksContainer);

						// Update block render options with current state
						(backlinkBlocks as any)?.updateRenderOptions?.({
							collapsed: currentCollapsed,
							sortByPath: sortByPath,
							sortDescending: settings.sortDescending
						});

						// Extract and render blocks
						console.log('Coalesce: Extracting blocks from files:', backlinkFiles, 'for note:', displayName);
						await (backlinkBlocks as any)?.extractAndRenderBlocks?.(
							backlinkFiles,
							displayName,
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