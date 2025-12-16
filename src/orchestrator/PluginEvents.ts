import { App, TFile, MarkdownView } from 'obsidian';
import { PluginOrchestrator } from './PluginOrchestrator';
import { DebugLogger } from './PluginDebugCommands';

/**
 * Minimal shape of the Obsidian Plugin we need here.
 * CoalescePlugin implements this via its base Plugin class.
 */
export interface PluginLike {
  registerEvent(eventRef: any): void;
}

/**
 * Register all DOM and workspace/orchestrator event handlers that Coalesce
 * needs. This is a refactor of CoalescePlugin.registerEventHandlers from main.ts.
 */
export function registerPluginEvents(
  app: App,
  plugin: PluginLike,
  orchestrator: PluginOrchestrator,
  logger?: DebugLogger,
  updateCoalesceUIForFile?: (filePath: string) => Promise<void>,
): void {
  // ========== DOM Custom Events ==========

  // coalesce-settings-collapse-changed
  document.addEventListener('coalesce-settings-collapse-changed', (event: CustomEvent) => {
    const { collapsed } = event.detail;
    logger?.debug?.('Received coalesce-settings-collapse-changed event', { collapsed });

    try {
      const settingsSlice = orchestrator.getSlice('settings') as any;
      if (settingsSlice && typeof settingsSlice.handleCollapseStateChange === 'function') {
        settingsSlice.handleCollapseStateChange({ collapsed });
      } else {
        logger?.warn?.(
          'Settings slice not available or handleCollapseStateChange method not found',
        );
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-settings-collapse-changed event', {
        collapsed,
        error,
      });
    }
  });

  // coalesce-settings-sort-changed
  document.addEventListener('coalesce-settings-sort-changed', (event: CustomEvent) => {
    const { sortByPath, descending } = event.detail || {};
    logger?.debug?.('Received coalesce-settings-sort-changed event', {
      sortByPath,
      descending,
    });

    try {
      const settingsSlice = orchestrator.getSlice('settings') as any;
      if (settingsSlice && typeof settingsSlice.handleSortStateChange === 'function') {
        settingsSlice.handleSortStateChange({
          sortByPath: !!sortByPath,
          descending: !!descending,
        });
      } else {
        logger?.warn?.(
          'Settings slice not available or handleSortStateChange method not found',
        );
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-settings-sort-changed event', {
        sortByPath,
        descending,
        error,
      });
    }
  });

  // coalesce-settings-theme-changed
  document.addEventListener('coalesce-settings-theme-changed', (event: CustomEvent) => {
    const { theme } = event.detail || {};
    logger?.debug?.('Received coalesce-settings-theme-changed event', { theme });

    if (!theme) {
      return;
    }

    try {
      const settingsSlice = orchestrator.getSlice('settings') as any;
      if (settingsSlice && typeof settingsSlice.updateSetting === 'function') {
        // Fire-and-forget persistence of theme changes from the header UI
        void settingsSlice.updateSetting('theme', theme);
      } else {
        logger?.warn?.(
          'Settings slice not available or updateSetting method not found for theme change',
        );
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-settings-theme-changed event', {
        theme,
        error,
      });
    }
  });

  // coalesce-logging-state-changed
  document.addEventListener('coalesce-logging-state-changed', (event: CustomEvent) => {
    const { enabled } = event.detail;
    try {
      // Note: Logger.setGlobalLogging is still called in main.ts via coalesceUpdateLogging.
      logger?.debug?.('Received coalesce-logging-state-changed event', { enabled });
    } catch (error) {
      console.error('Failed to handle coalesce-logging-state-changed event', { enabled, error });
    }
  });

  // coalesce-navigate (navigation via backlinks)
  document.addEventListener('coalesce-navigate', (event: CustomEvent) => {
    const { filePath, openInNewTab, blockId } = event.detail;
    logger?.debug?.('Received coalesce-navigate event for navigation', {
      filePath,
      openInNewTab,
      blockId,
    });

    try {
      const backlinks = orchestrator.getSlice('backlinks') as any;
      if (backlinks && typeof backlinks.handleNavigation === 'function') {
        backlinks.handleNavigation(filePath, openInNewTab || false, blockId);
      } else {
        // Fallback to direct navigation if backlinks slice not available
        const linkText = blockId ? `[[${filePath}#^${blockId}]]` : `[[${filePath}]]`;
        app.workspace.openLinkText(linkText, '', openInNewTab || false);
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-navigate event', {
        filePath,
        openInNewTab,
        blockId,
        error,
      });
    }
  });

  // coalesce-navigate-complete
  document.addEventListener('coalesce-navigate-complete', (event: CustomEvent) => {
    const { filePath } = event.detail;
    logger?.debug?.('Coalesce navigate complete event', { filePath });

    try {
      if (updateCoalesceUIForFile) {
        void updateCoalesceUIForFile(filePath);
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-navigate-complete event', { filePath, error });
    }
  });

  // ========== Workspace Events ==========

  // file-open fallback: ensure UI updates even without orchestrator events
  plugin.registerEvent(
    app.workspace.on('file-open', (file: TFile) => {
      if (file) {
        logger?.debug?.('File open event (fallback)', {
          path: file.path,
          extension: file.extension,
          basename: file.basename,
        });

        if (updateCoalesceUIForFile) {
          void updateCoalesceUIForFile(file.path);
        }
      }
    }),
  );

  // layout-change - forward to orchestrator
  plugin.registerEvent(
    app.workspace.on('layout-change', () => {
      const activeView = app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        logger?.debug?.('Layout change event', { path: activeView.file.path });

        orchestrator.emit('layout:changed', {
          file: activeView.file,
          view: activeView,
        });
      }
    }),
  );

  // active-leaf-change - forward to orchestrator and refresh UI
  plugin.registerEvent(
    app.workspace.on('active-leaf-change', () => {
      const activeView = app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        logger?.debug?.('Active leaf change event', { path: activeView.file.path });

        orchestrator.emit('active-leaf:changed', {
          file: activeView.file,
          view: activeView,
        });

        // Also refresh the UI for the focused view to ensure backlinks are loaded
        // This helps with the case where initial load showed "No backlinks found"
        // due to metadata cache not being ready
        if (updateCoalesceUIForFile && activeView.file) {
          const filePath = activeView.file.path;
          const focusTime = Date.now();
          const cacheState = {
            resolvedLinksCount: Object.keys(app.metadataCache.resolvedLinks).length,
            unresolvedLinksCount: Object.keys(app.metadataCache.unresolvedLinks).length,
            hasContent: Object.keys(app.metadataCache.resolvedLinks).length > 0 || 
                       Object.keys(app.metadataCache.unresolvedLinks).length > 0
          };
          
          logger?.info?.('=== NORMAL FOCUS: active-leaf-change ===', {
            filePath,
            timestamp: focusTime,
            metadataCacheState: cacheState
          });
          
          // Use a small delay to ensure the view is fully ready
          setTimeout(() => {
            // Re-check that file still exists (defensive check)
            const currentView = app.workspace.getActiveViewOfType(MarkdownView);
            if (currentView?.file?.path === filePath) {
              logger?.info?.('Calling updateForFile from active-leaf-change', {
                filePath,
                metadataCacheState: {
                  resolvedLinksCount: Object.keys(app.metadataCache.resolvedLinks).length,
                  unresolvedLinksCount: Object.keys(app.metadataCache.unresolvedLinks).length,
                  hasContent: Object.keys(app.metadataCache.resolvedLinks).length > 0 || 
                             Object.keys(app.metadataCache.unresolvedLinks).length > 0
                }
              });
              void updateCoalesceUIForFile(filePath);
            }
          }, 100);
        }
      }
    }),
  );

  // ========== Orchestrator Events for slice coordination ==========

  // file:opened - initialize view and attach backlinks UI via slices
  orchestrator.on('file:opened', async (data: any) => {
    logger?.debug?.('Orchestrator file:opened event triggered', {
      filePath: data.file?.path,
    });

    const viewIntegration = orchestrator.getSlice('viewIntegration');
    const backlinks = orchestrator.getSlice('backlinks'); // Consolidated slice

    if (viewIntegration && backlinks && data.file) {
      logger?.debug?.('Orchestrator processing file:opened', { filePath: data.file.path });

      // Get all markdown views, not just the active one
      const allMarkdownViews = app.workspace.getLeavesOfType('markdown');
      
      // Filter to only views that have the matching file
      const matchingViews = allMarkdownViews
        .map(leaf => leaf.view as MarkdownView)
        .filter(view => view?.file?.path === data.file.path);

      logger?.debug?.('Orchestrator found matching views', {
        filePath: data.file.path,
        matchingCount: matchingViews.length,
        totalMarkdownViews: allMarkdownViews.length,
      });

      if (matchingViews.length === 0) {
        logger?.debug?.('Orchestrator no matching views found', {
          filePath: data.file.path,
        });
        return;
      }

      // Get settings slice
      const settingsSlice = orchestrator.getSlice('settings') as any;
      let settings = settingsSlice?.getSettings?.() || {};

      // If settings aren't loaded yet, load them now
      if (!settings || Object.keys(settings).length === 0) {
        await settingsSlice?.loadSettings?.();
        settings = settingsSlice?.getSettings?.() || {};
      }

      // Process each matching view
      for (const view of matchingViews) {
        if (!view.file) {
          continue;
        }

        try {
          logger?.debug?.('Orchestrator processing view', {
            filePath: data.file.path,
            leafId: (view.leaf as any).id,
          });

          // Initialize view integration
          await (viewIntegration as any)?.initializeView?.(view.file, view);

          // Use the consolidated backlinks slice to attach the complete UI
          logger?.debug?.('Orchestrator calling attachToDOM', {
            filePath: data.file.path,
            leafId: (view.leaf as any).id,
          });

          // Force refresh for initial view initialization to ensure backlinks are loaded
          // even if metadata cache isn't fully ready yet
          const uiAttached = await (backlinks as any)?.attachToDOM?.(
            view,
            data.file.path,
            true, // forceRefresh = true to ensure initial views get backlinks loaded
          );

          logger?.debug?.('Orchestrator attachToDOM result', {
            filePath: data.file.path,
            leafId: (view.leaf as any).id,
            uiAttached,
          });

          // Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
          if (uiAttached) {
            logger?.debug?.('Orchestrator applying settings', {
              filePath: data.file.path,
              leafId: (view.leaf as any).id,
            });

            (backlinks as any)?.setOptions?.({
              sort: settings.sortByFullPath || false,
              sortDescending: settings.sortDescending ?? true,
              collapsed: settings.blocksCollapsed || false,
              strategy: 'default',
              theme: settings.theme || 'default',
              alias: null,
              filter: '',
            });

            logger?.info?.('Consolidated backlinks UI attached for file', {
              filePath: data.file.path,
              leafId: (view.leaf as any).id,
            });
          } else {
            logger?.debug?.('Orchestrator UI was not attached (skipped)', {
              filePath: data.file.path,
              leafId: (view.leaf as any).id,
            });
          }
        } catch (error) {
          logger?.error?.('Orchestrator failed to process view', {
            filePath: data.file.path,
            leafId: (view.leaf as any).id,
            error,
          });
        }
      }
    } else {
      logger?.debug?.('Orchestrator missing required slices or data', {
        hasViewIntegration: !!viewIntegration,
        hasBacklinks: !!backlinks,
        hasFile: !!data.file,
      });
    }
  });

  // layout:changed - delegate to viewIntegration slice
  orchestrator.on('layout:changed', (data: any) => {
    const viewIntegration = orchestrator.getSlice('viewIntegration');

    if (viewIntegration && data.file && data.view) {
      (viewIntegration as any)?.handleModeSwitch?.(data.file, data.view);
    }
  });

  // active-leaf:changed - delegate to viewIntegration slice
  orchestrator.on('active-leaf:changed', (data: any) => {
    const viewIntegration = orchestrator.getSlice('viewIntegration');

    if (viewIntegration && data.file && data.view) {
      // Handle focus change
      (viewIntegration as any)?.handleFocusChange?.(data.view, true);

      // Handle leaf activation
      (viewIntegration as any)?.handleLeafActivation?.(data.view.leaf);
    }
  });
}