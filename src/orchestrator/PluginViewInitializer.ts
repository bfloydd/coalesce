import { App, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './PluginOrchestrator';
import { DebugLogger } from './PluginDebugCommands';

/**
 * Encapsulates view initialization and backlinks UI attachment logic that was
 * previously implemented directly in CoalescePlugin (main.ts).
 *
 * Responsibilities:
 * - Prevent duplicate processing of the same file in a short interval.
 * - Initialize view integration and attach the consolidated backlinks UI.
 * - Drive initial file:opened events for existing markdown views on startup.
 */
export class PluginViewInitializer {
  private lastProcessedFile: { path: string; timestamp: number } | null = null;
  private initialActiveViewProcessed: boolean = false;
  private periodicCheckInterval: NodeJS.Timeout | null = null;
  private processedViewIds: Set<string> = new Set();
  private coldStartProcessedFiles: Set<string> = new Set();
  private coldStartProcessing: boolean = false;
  private processingFiles: Set<string> = new Set(); // Track files currently being processed
  private processingViews: Map<string, Promise<void>> = new Map(); // Track views currently being processed with their promises

  constructor(
    private readonly app: App,
    private readonly orchestrator: PluginOrchestrator,
    private readonly logger?: DebugLogger,
  ) {}

  /**
   * Initialize existing markdown views by processing all visible views in preview mode.
   * Waits for metadata cache 'resolved' event before processing views.
   * This ensures ALL visible notes get Coalesce UI, not just the focused one.
   */
  initializeExistingViews(): void {
    this.logger?.debug?.('Initializing existing views');

    // Mark that we're starting cold start processing IMMEDIATELY
    // This must be set before requestAnimationFrame to prevent race conditions
    // where event handlers might fire before coldStartProcessing is set
    this.coldStartProcessing = true;
    this.coldStartProcessedFiles.clear();

    // Use requestAnimationFrame to ensure workspace is fully ready
    requestAnimationFrame(() => {
      const existingViews = this.app.workspace.getLeavesOfType('markdown');
      this.logger?.debug?.('Found existing views on app load', {
        count: existingViews.length,
      });

      if (existingViews.length > 0) {
        this.logger?.debug?.('Initializing existing views on fresh app load', {
          count: existingViews.length,
        });

        // Get the active view to process it differently - use updateForFile instead of orchestrator
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const activeLeaf = activeView?.leaf;
        const activeFilePath = activeView?.file?.path;

        // Check if metadata cache is already ready
        const cacheState = {
          resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
          unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
          hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                     Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
        };

        // Process all views in preview mode
        const viewsToProcess: Array<{ view: MarkdownView; file: any; isActive: boolean }> = [];
        
        existingViews.forEach((leaf, index) => {
          const view = leaf.view as MarkdownView;
          const file = view?.file;
          if (file) {
            const isActiveView = leaf === activeLeaf;
            const isPreviewMode = view.getMode() === 'preview';
            
            this.logger?.debug?.('Checking view for initialization', {
              index,
              filePath: file.path,
              isActiveView,
              isPreviewMode,
            });
            
            // Only process views that are in preview mode
            if (isPreviewMode) {
              viewsToProcess.push({ view, file, isActive: isActiveView });
            } else {
              this.logger?.debug?.('Skipping view - not in preview mode', {
                index,
                filePath: file.path,
                mode: view.getMode(),
              });
            }
          } else {
            this.logger?.debug?.('Skipping existing view - no file', { index });
          }
        });

        this.logger?.info?.('Found views in preview mode to process', {
          totalViews: existingViews.length,
          viewsInPreviewMode: viewsToProcess.length,
          activeViewInPreview: viewsToProcess.some(v => v.isActive),
        });

        // Process all views in preview mode
        if (viewsToProcess.length > 0) {
          
          // Helper function to process views (with deduplication)
          const processViews = () => {
            if (!this.coldStartProcessing) {
              this.logger?.debug?.('Cold start processing already completed, skipping');
              return;
            }
            
            this.logger?.info?.('Processing all views in preview mode', {
              viewsToProcess: viewsToProcess.length,
            });
            
            for (const { view, file, isActive } of viewsToProcess) {
              const filePath = file.path;
              
              // Skip if we've already processed this file during cold start
              if (this.coldStartProcessedFiles.has(filePath)) {
                this.logger?.debug?.('Skipping file - already processed during cold start', {
                  filePath,
                  isActive,
                });
                continue;
              }
              
              if (isActive && activeFilePath) {
                // Additional check: ensure we haven't already started processing this file
                if (this.processingFiles.has(filePath)) {
                  this.logger?.warn?.('Skipping active view - already being processed', {
                    filePath: activeFilePath,
                  });
                  continue;
                }
                
                // Mark as processed BEFORE calling updateForFile to prevent duplicate calls
                // This ensures that if updateForFile is called from elsewhere, it will skip
                this.coldStartProcessedFiles.add(filePath);
                
                // Mark that we're processing the initial active view
                this.initialActiveViewProcessed = true;
                this.logger?.info?.('=== COLD START: Processing active view ===', {
                  filePath: activeFilePath,
                });
                void this.updateForFile(activeFilePath);
              } else {
                // Process non-active views via orchestrator
                this.logger?.debug?.('Processing non-active view in preview mode', {
                  filePath: file.path,
                });
                this.orchestrator.emit('file:opened', { file });
              }
            }
            
            // Mark cold start processing as complete after a short delay
            // This allows the initial processing to complete
            setTimeout(() => {
              this.coldStartProcessing = false;
              this.logger?.debug?.('Cold start processing marked as complete');
            }, 2000);
          };
          
          // Check if metadata cache is ready
          if (cacheState.hasContent) {
            // Cache already has content, process all views immediately
            this.logger?.info?.('Metadata cache already ready, processing all views in preview mode immediately');
            processViews();
          } else {
            // Wait for metadata cache 'resolved' event before processing
            this.logger?.info?.('Waiting for metadata cache resolved event before processing views');
            
            let handlerSet = false;
            let checkInterval: NodeJS.Timeout | null = null;
            let processed = false;
            
            // Check cache periodically in case event already fired
            const checkCacheAndProcess = () => {
              const currentCacheState = {
                resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                           Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
              };
              
              if (currentCacheState.hasContent && !processed) {
                processed = true;
                // Cache is ready, process all views now
                if (checkInterval) clearInterval(checkInterval);
                if (handlerSet) {
                  this.app.metadataCache.off('resolved', handleResolved);
                }
                
                this.logger?.info?.('Metadata cache populated (checked during wait), processing all views in preview mode', {
                  metadataCacheState: currentCacheState,
                  viewsToProcess: viewsToProcess.length,
                });
                
                processViews();
                return true;
              }
              return false;
            };
            
            // Check immediately in case event already fired
            if (checkCacheAndProcess()) {
              return; // Already processed
            }
            
            // Check periodically (every 50ms) in case event already fired
            checkInterval = setInterval(() => {
              checkCacheAndProcess();
            }, 50);
            
            // Create handler that processes all views when metadata cache is ready
            const handleResolved = () => {
              if (checkInterval) clearInterval(checkInterval);
              this.app.metadataCache.off('resolved', handleResolved);
              
              if (processed) return;
              processed = true;
              
              const resolvedCacheState = {
                resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                           Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
              };
              
              this.logger?.info?.('Metadata cache resolved event received, processing all views in preview mode', {
                metadataCacheState: resolvedCacheState,
                viewsToProcess: viewsToProcess.length,
              });
              
              processViews();
            };
            
            // Register the event listener
            handlerSet = true;
            this.app.metadataCache.on('resolved', handleResolved);
          }
        }

        // Also set up a periodic check for views that enter preview mode later
        // This handles the case where views start in edit mode and switch to preview mode
        this.setupPeriodicViewCheck();
      }

      // Fallback check in case views weren't ready yet
      setTimeout(() => {
        const delayedViews = this.app.workspace.getLeavesOfType('markdown');
        this.logger?.debug?.('Fallback check for delayed views', {
          count: delayedViews.length,
        });

        if (delayedViews.length > existingViews.length) {
          this.logger?.debug?.('Processing additional delayed views', {
            originalCount: existingViews.length,
            delayedCount: delayedViews.length,
          });

          delayedViews.forEach((leaf, index) => {
            const view = leaf.view as MarkdownView;
            if (view?.file && view.getMode() === 'preview') {
              this.logger?.debug?.('Emitting file:opened for delayed view in preview mode', {
                index,
                filePath: view.file.path,
              });
              // Emit file open event for new views in preview mode
              this.orchestrator.emit('file:opened', { file: view.file });
            } else {
              this.logger?.debug?.('Skipping delayed view - no file or not in preview mode', { 
                index,
                hasFile: !!view?.file,
                mode: view?.getMode(),
              });
            }
          });
        } else {
          this.logger?.debug?.('No additional delayed views to process');
        }
      }, 500);
    });
  }

  /**
   * Update the Coalesce UI for a given file path, with duplicate suppression.
   * Processes all markdown views displaying this file, not just the active one.
   * This mirrors CoalescePlugin.updateCoalesceUIForFile.
   */
  async updateForFile(filePath: string): Promise<void> {
    const codePath = this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS';
    const timestamp = Date.now();
    const callStack = new Error().stack;
    
    this.logger?.info?.('=== CODE PATH: updateForFile CALLED ===', {
      filePath,
      codePath,
      timestamp,
      isProcessing: this.processingFiles.has(filePath),
      inColdStart: this.coldStartProcessing,
      coldStartProcessed: this.coldStartProcessedFiles.has(filePath),
      callStack: callStack?.split('\n').slice(1, 4).join(' -> '), // First 3 stack frames
      metadataCacheState: {
        resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
        unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
        hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                   Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
      }
    });

    // Prevent duplicate processing - check if file is currently being processed (atomic check)
    if (this.processingFiles.has(filePath)) {
      this.logger?.warn?.('BLOCKED: file is currently being processed', { filePath, codePath, timestamp });
      return;
    }
    
    // Mark file as being processed IMMEDIATELY (atomic operation)
    // This must happen before checking coldStartProcessedFiles to prevent race conditions
    this.processingFiles.add(filePath);
    
    // During cold start, check if this file was already processed by another call
    // If we just added it to processingFiles above, we're the first call and should proceed
    // If it's in coldStartProcessedFiles but NOT in processingFiles, another call is processing it
    if (this.coldStartProcessing && this.coldStartProcessedFiles.has(filePath)) {
      // Check if we're the one processing it (we just added it to processingFiles)
      // If another call is processing it, they would have added it to processingFiles first
      // So if we're here and it's in coldStartProcessedFiles, we should allow it (we're the first)
      // Actually, wait - if it's in coldStartProcessedFiles, that means initializeExistingViews marked it
      // So we should proceed with processing
      this.logger?.debug?.('File marked in coldStartProcessedFiles, proceeding with processing', { filePath, codePath });
    }
    
    // Prevent duplicate processing - check both file-level and view-level
    if (!this.shouldProcessFile(filePath)) {
      this.logger?.debug?.('Returning early due to shouldProcessFile check', { filePath, codePath });
      this.processingFiles.delete(filePath); // Remove since we're not processing
      return;
    }

    this.logger?.debug?.('Proceeding with UI update for file', { filePath, codePath });

    try {
      // Get all markdown views, not just the active one
      const allMarkdownViews = this.app.workspace.getLeavesOfType('markdown');
      
      // Filter to only views that have the matching file
      const matchingViews = allMarkdownViews
        .map(leaf => leaf.view as MarkdownView)
        .filter(view => view?.file?.path === filePath);

      this.logger?.debug?.('Found matching views for file', {
        filePath,
        matchingCount: matchingViews.length,
        totalMarkdownViews: allMarkdownViews.length,
      });

      if (matchingViews.length === 0) {
        this.logger?.debug?.('No matching views found for file', { filePath });
        return;
      }

      // Get consolidated backlinks slice and other necessary slices
      const backlinksSlice = this.orchestrator.getSlice('backlinks') as any;
      const viewIntegration = this.orchestrator.getSlice('viewIntegration') as any;
      const settingsSlice = this.orchestrator.getSlice('settings') as any;

      if (!backlinksSlice || !viewIntegration || !settingsSlice) {
        this.logger?.warn?.('Required slices not available', {
          hasBacklinks: !!backlinksSlice,
          hasViewIntegration: !!viewIntegration,
          hasSettings: !!settingsSlice,
        });
        return;
      }

      // Get current settings - ensure settings are loaded
      let settings = settingsSlice.getSettings?.();

      // If settings aren't loaded yet, load them now
      if (!settings || Object.keys(settings).length === 0) {
        await settingsSlice.loadSettings?.();
        settings = settingsSlice.getSettings?.() || {};
      }

      // Process each matching view that is in preview mode
      for (const view of matchingViews) {
        if (!view.file) {
          continue;
        }

        const viewId = (view.leaf as any).id || 'unknown';
        
        // CRITICAL: Check if this view is already being processed FIRST
        // This must be the first check to prevent race conditions
        if (this.processingViews.has(viewId)) {
          this.logger?.debug?.('View already being processed, skipping duplicate', {
            filePath,
            viewId,
          });
          continue;
        }

        // Check if UI is already attached to this view
        // This check must come before we start processing
        const existingUI = view.contentEl.querySelector('.coalesce-custom-backlinks-container');
        if (existingUI) {
          this.logger?.error?.('ERROR: updateForFile attempting to process a view that already has coalesce UI attached!', {
            filePath,
            viewId,
            codePath: this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS',
            coldStartProcessing: this.coldStartProcessing,
            callStack: new Error().stack?.split('\n').slice(1, 6).join(' -> ')
          });
          continue;
        }

        // Only process views in preview mode (UI can only be attached in preview mode)
        const isPreviewMode = view.getMode() === 'preview';
        if (!isPreviewMode) {
          this.logger?.debug?.('Skipping view - not in preview mode', {
            filePath,
            viewId,
            mode: view.getMode(),
          });
          continue;
        }

        // Mark as being processed IMMEDIATELY before creating the promise
        // This prevents race conditions where updateForFile is called twice
        this.processedViewIds.add(viewId);
        const processingPromise = this.processView(view, filePath, viewId, viewIntegration, backlinksSlice, settings);
        
        // Mark view as being processed in the map IMMEDIATELY
        // This must happen synchronously before any await to prevent race conditions
        this.processingViews.set(viewId, processingPromise);
        
        // Clean up after processing completes
        processingPromise.finally(() => {
          this.processingViews.delete(viewId);
          // Remove from processed set after 5 seconds to allow reprocessing if needed
          setTimeout(() => {
            this.processedViewIds.delete(viewId);
          }, 5000);
        }).catch(() => {
          // Error already logged in processView
        });

        // Wait for this view to finish processing before moving to next
        try {
          await processingPromise;
        } catch (error) {
          this.logger?.error?.('Error processing view', { viewId, error });
        }
      }
    } catch (error) {
      this.logger?.error?.('Failed to update Coalesce UI for file', { filePath, error });
    } finally {
      // Remove from processing set after a short delay to allow reprocessing if needed
      setTimeout(() => {
        this.processingFiles.delete(filePath);
      }, 1000);
    }
  }

  /**
   * Process a single view - extracted to allow proper promise tracking
   */
  private async processView(
    view: MarkdownView, 
    filePath: string, 
    viewId: string,
    viewIntegration: any,
    backlinksSlice: any,
    settings: any
  ): Promise<void> {
    try {
      // Check if UI is already attached to this view BEFORE doing any work
      // This prevents duplicate processing if processView is called multiple times
      const existingUI = view.contentEl.querySelector('.coalesce-custom-backlinks-container');
      if (existingUI) {
        // If UI is already attached, skip processing (even during cold start)
        // The view-level check in updateForFile should prevent this, but this is a safety net
        this.logger?.debug?.('Skipping processView - UI already attached', {
          filePath,
          viewId,
          coldStartProcessing: this.coldStartProcessing,
        });
        return;
      }

      // Initialize view integration first
      await viewIntegration.initializeView?.(view.file, view);

      // CRITICAL: Check if UI is already attached in the DOM - this is an ERROR condition
      const existingContainers =
        view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
      if (existingContainers.length > 0) {
        this.logger?.error?.('ERROR: processView called for a view that already has coalesce UI attached!', {
          filePath,
          viewId: (view.leaf as any).id,
          existingContainerCount: existingContainers.length,
          coldStartProcessing: this.coldStartProcessing,
          codePath: this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS',
          callStack: new Error().stack?.split('\n').slice(1, 6).join(' -> ')
        });
        // Still clear and reattach to prevent duplicates, but log the error
        existingContainers.forEach((container) => container.remove());
      }

      // Use the consolidated backlinks slice to attach the complete UI
      // The slice will handle backlink discovery, block extraction, header UI, and rendering
      // Only force refresh if we're not in cold start (cold start should be fresh)
      const forceRefresh = !this.coldStartProcessing;
      const attachStartTime = Date.now();
      this.logger?.info?.('Calling attachToDOM', {
        filePath,
        viewId: (view.leaf as any).id,
        codePath: this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS',
        forceRefresh,
        coldStartProcessing: this.coldStartProcessing,
        metadataCacheState: {
          resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
          unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
          hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                     Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
        }
      });
      
      const uiAttached = await backlinksSlice.attachToDOM?.(view, filePath, forceRefresh);
      
      const attachDuration = Date.now() - attachStartTime;
      this.logger?.info?.('attachToDOM completed', {
        filePath,
        viewId: (view.leaf as any).id,
        uiAttached,
        duration: attachDuration,
        codePath: this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS'
      });

      // Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
      if (uiAttached) {
        backlinksSlice.setOptions?.({
          sort: settings.sortByFullPath || false,
          sortDescending: settings.sortDescending ?? true,
          collapsed: settings.blocksCollapsed || false,
          strategy: 'default', // Default strategy
          theme: settings.theme || 'default',
          alias: null, // No alias filter by default
          filter: '', // No text filter by default
        });

        const leafId = (view.leaf as any).id || 'unknown';
        this.logger?.info?.('Consolidated backlinks UI attached for file', {
          filePath,
          leafId,
        });
      }
    } catch (error) {
      this.logger?.error?.('Failed to update UI for view', {
        filePath,
        viewLeafId: (view.leaf as any).id,
        error,
      });
      throw error; // Re-throw so caller knows processing failed
    }
  }

  /**
   * Set up periodic check for views that enter preview mode after initial load.
   * This ensures views that start in edit mode get UI when they switch to preview mode.
   */
  private setupPeriodicViewCheck(): void {
    // Clear any existing interval
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
    }

    // Check every 2 seconds for views that need UI
    this.periodicCheckInterval = setInterval(() => {
      const allViews = this.app.workspace.getLeavesOfType('markdown');
      const viewsNeedingUI: Array<{ view: MarkdownView; file: any }> = [];

      allViews.forEach((leaf) => {
        const view = leaf.view as MarkdownView;
        const viewId = (leaf as any).id || 'unknown';
        const file = view?.file;

        if (file && view.getMode() === 'preview') {
          // Check if this view already has UI attached
          const hasUI = view.contentEl.querySelector('.coalesce-custom-backlinks-container') !== null;
          
          if (!hasUI && !this.processedViewIds.has(viewId)) {
            viewsNeedingUI.push({ view, file });
          }
        }
      });

      if (viewsNeedingUI.length > 0) {
        this.logger?.debug?.('Found views in preview mode that need UI', {
          count: viewsNeedingUI.length,
        });

        viewsNeedingUI.forEach(({ view, file }) => {
          const viewId = (view.leaf as any).id || 'unknown';
          this.processedViewIds.add(viewId);
          
          this.logger?.debug?.('Processing view that entered preview mode', {
            filePath: file.path,
            viewId,
          });
          
          // Process via orchestrator
          this.orchestrator.emit('file:opened', { file });
        });
      }
    }, 2000); // Check every 2 seconds

    // Stop checking after 30 seconds (views should be initialized by then)
    setTimeout(() => {
      if (this.periodicCheckInterval) {
        clearInterval(this.periodicCheckInterval);
        this.periodicCheckInterval = null;
        this.logger?.debug?.('Stopped periodic view check');
      }
    }, 30000);
  }

  /**
   * Check if we're currently in cold start processing phase
   */
  isColdStartProcessing(): boolean {
    return this.coldStartProcessing;
  }

  // ===== Internal helpers =====

  private shouldProcessFile(filePath: string): boolean {
    const now = Date.now();
    const minInterval = 1000; // 1 second minimum between processing the same file

    this.logger?.debug?.('Checking if file should be processed', { filePath });

    // Check if this is the initial active view that was processed
    // If so, allow reprocessing after a delay to handle metadata cache not being ready
    const isInitialActiveView = this.initialActiveViewProcessed && 
                                 this.lastProcessedFile?.path === filePath;
    
    if (
      this.lastProcessedFile &&
      this.lastProcessedFile.path === filePath &&
      now - this.lastProcessedFile.timestamp < minInterval &&
      !isInitialActiveView
    ) {
      this.logger?.debug?.('Skipping duplicate file processing', {
        filePath,
        timeSinceLast: now - this.lastProcessedFile.timestamp,
        minInterval,
      });
      return false;
    }

    // If this is a reprocess of the initial active view, mark it as done
    if (isInitialActiveView) {
      this.initialActiveViewProcessed = false;
      this.logger?.debug?.('Allowing reprocess of initial active view', { filePath });
    }

    this.lastProcessedFile = { path: filePath, timestamp: now };
    this.logger?.debug?.('Allowing file processing', { filePath });
    return true;
  }
}

/**
 * Factory helper to create a PluginViewInitializer instance.
 */
export function createViewInitializer(
  app: App,
  orchestrator: PluginOrchestrator,
  logger?: DebugLogger,
): PluginViewInitializer {
  return new PluginViewInitializer(app, orchestrator, logger);
}