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

  constructor(
    private readonly app: App,
    private readonly orchestrator: PluginOrchestrator,
    private readonly logger?: DebugLogger,
  ) {}

  /**
   * Initialize existing markdown views by emitting file:opened for each one.
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

        existingViews.forEach((leaf, index) => {
          const view = leaf.view as MarkdownView;
          if (view?.file) {
            this.logger?.debug?.('Emitting file:opened for existing view', {
              index,
              filePath: view.file.path,
            });
            // Emit file open event for each existing view
            this.orchestrator.emit('file:opened', { file: view.file });
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
   * This mirrors CoalescePlugin.updateCoalesceUIForFile.
   */
  async updateForFile(filePath: string): Promise<void> {
    this.logger?.debug?.('Updating Coalesce UI for file', { filePath });

    // Prevent duplicate processing
    if (!this.shouldProcessFile(filePath)) {
      this.logger?.debug?.('Returning early due to shouldProcessFile check', { filePath });
      return;
    }

    this.logger?.debug?.('Proceeding with UI update for file', { filePath });

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
          const existingContainers =
            activeView.contentEl.querySelectorAll('.coalesce-custom-backlinks-container');
          existingContainers.forEach((container) => container.remove());

          // Get current settings - ensure settings are loaded
          let settings = settingsSlice.getSettings?.();

          // If settings aren't loaded yet, load them now
          if (!settings || Object.keys(settings).length === 0) {
            await settingsSlice.loadSettings?.();
            settings = settingsSlice.getSettings?.() || {};
          }

          const currentFilePath = activeView.file.path;

          // Use the consolidated backlinks slice to attach the complete UI
          // The slice will handle backlink discovery, block extraction, header UI, and rendering
          // Force refresh for user-initiated file opens to ensure backlinks are always current
          const uiAttached = await backlinksSlice.attachToDOM?.(
            activeView,
            currentFilePath,
            true, // forceRefresh = true for user file-open events
          );

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

            this.logger?.info?.('Consolidated backlinks UI attached for file', {
              currentFilePath,
            });
          }
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

    if (
      this.lastProcessedFile &&
      this.lastProcessedFile.path === filePath &&
      now - this.lastProcessedFile.timestamp < minInterval
    ) {
      this.logger?.debug?.('Skipping duplicate file processing', {
        filePath,
        timeSinceLast: now - this.lastProcessedFile.timestamp,
        minInterval,
      });
      return false;
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