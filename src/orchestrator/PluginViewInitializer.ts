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

  constructor(
    private readonly app: App,
    private readonly orchestrator: PluginOrchestrator,
    private readonly logger?: DebugLogger,
  ) {}

  /**
   * Initialize existing markdown views by emitting file:opened for each one.
   * Waits for metadata cache 'resolved' event before processing the active view.
   * This mirrors the behavior of CoalescePlugin.initializeExistingViews.
   */
  initializeExistingViews(): void {
    this.logger?.debug?.('Initializing existing views');

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

        existingViews.forEach((leaf, index) => {
          const view = leaf.view as MarkdownView;
          const file = view?.file;
          if (file) {
            const isActiveView = leaf === activeLeaf;
            
            if (isActiveView && activeFilePath) {
              // For the active view, wait for metadata cache 'resolved' event
              // This ensures it follows the same code path as when a note is focused normally
              const coldStartTime = Date.now();
              
              this.logger?.info?.('=== COLD START: Processing active view ===', {
                index,
                filePath: activeFilePath,
                timestamp: coldStartTime,
                initialMetadataCacheState: cacheState
              });
              
              // Mark that we're processing the initial active view
              this.initialActiveViewProcessed = true;
              
              // Wait for metadata cache 'resolved' event before processing
              if (cacheState.hasContent) {
                // Cache already has content, process immediately
                this.logger?.info?.('Metadata cache already ready, processing active view immediately', {
                  filePath: activeFilePath
                });
                void this.updateForFile(activeFilePath);
              } else {
                // Wait for 'resolved' event, but also check cache periodically
                // The event might have already fired, so we check both
                this.logger?.info?.('Waiting for metadata cache resolved event before processing active view', {
                  filePath: activeFilePath
                });
                
                let handlerSet = false;
                let checkInterval: NodeJS.Timeout | null = null;
                
                // Check cache periodically in case event already fired
                const checkCacheAndProcess = () => {
                  const currentCacheState = {
                    resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                    unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                    hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                               Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
                  };
                  
                  if (currentCacheState.hasContent) {
                    // Cache is ready, process now
                    if (checkInterval) clearInterval(checkInterval);
                    if (handlerSet) {
                      this.app.metadataCache.off('resolved', handleResolved);
                    }
                    
                    const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (currentView?.file?.path === activeFilePath) {
                      this.logger?.info?.('Metadata cache populated (checked during wait), calling updateForFile for active view', {
                        filePath: activeFilePath,
                        metadataCacheState: currentCacheState
                      });
                      void this.updateForFile(activeFilePath);
                    }
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
                
                // Create handler that processes the active view when metadata cache is ready
                const handleResolved = () => {
                  if (checkInterval) clearInterval(checkInterval);
                  this.app.metadataCache.off('resolved', handleResolved);
                  
                  const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
                  if (currentView?.file?.path === activeFilePath) {
                    const resolvedCacheState = {
                      resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
                      unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
                      hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                                 Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
                    };
                    
                    this.logger?.info?.('Metadata cache resolved event received, calling updateForFile for active view', {
                      filePath: activeFilePath,
                      metadataCacheState: resolvedCacheState
                    });
                    void this.updateForFile(activeFilePath);
                  }
                };
                
                // Register the event listener
                handlerSet = true;
                this.app.metadataCache.on('resolved', handleResolved);
              }
            } else {
              // For non-active views, use orchestrator handler (faster, no duplicate suppression)
              this.logger?.debug?.('Emitting file:opened for existing view (non-active)', {
                index,
                filePath: file.path,
              });
              // Emit file open event for each existing view
              this.orchestrator.emit('file:opened', { file });
            }
          } else {
            this.logger?.debug?.('Skipping existing view - no file', { index });
          }
        });
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
            if (view?.file) {
              this.logger?.debug?.('Emitting file:opened for delayed view', {
                index,
                filePath: view.file.path,
              });
              // Emit file open event for new views
              this.orchestrator.emit('file:opened', { file: view.file });
            } else {
              this.logger?.debug?.('Skipping delayed view - no file', { index });
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
    
    this.logger?.info?.('=== CODE PATH: updateForFile ===', {
      filePath,
      codePath,
      timestamp,
      metadataCacheState: {
        resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
        unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
        hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                   Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
      }
    });

    // Prevent duplicate processing
    if (!this.shouldProcessFile(filePath)) {
      this.logger?.debug?.('Returning early due to shouldProcessFile check', { filePath, codePath });
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

      // Process each matching view
      for (const view of matchingViews) {
        if (!view.file) {
          continue;
        }

        try {
          // Initialize view integration first
          await viewIntegration.initializeView?.(view.file, view);

          // Always clear existing coalesce containers from the view
          const existingContainers =
            view.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
          existingContainers.forEach((container) => container.remove());

          // Use the consolidated backlinks slice to attach the complete UI
          // The slice will handle backlink discovery, block extraction, header UI, and rendering
          // Force refresh for user-initiated file opens to ensure backlinks are always current
          const attachStartTime = Date.now();
          this.logger?.info?.('Calling attachToDOM', {
            filePath,
            viewId: (view.leaf as any).id,
            codePath: this.initialActiveViewProcessed ? 'COLD_START_ACTIVE_VIEW' : 'NORMAL_FOCUS',
            metadataCacheState: {
              resolvedLinksCount: Object.keys(this.app.metadataCache.resolvedLinks).length,
              unresolvedLinksCount: Object.keys(this.app.metadataCache.unresolvedLinks).length,
              hasContent: Object.keys(this.app.metadataCache.resolvedLinks).length > 0 || 
                         Object.keys(this.app.metadataCache.unresolvedLinks).length > 0
            }
          });
          
          const uiAttached = await backlinksSlice.attachToDOM?.(view, filePath, true);
          
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
        }
      }
    } catch (error) {
      this.logger?.error?.('Failed to update Coalesce UI for file', { filePath, error });
    }
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