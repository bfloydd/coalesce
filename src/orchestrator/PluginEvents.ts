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
  updateCoalesceUIForFile?: (filePath: string, forceRefresh?: boolean) => Promise<void>,
  viewInitializer?: { isColdStartProcessing?: () => boolean },
): void {
  /**
   * Normalize a path into a vault path (no wiki-link brackets).
   * Defensive: some event sources may accidentally provide [[...]] strings.
   */
  const cleanVaultPath = (input: unknown): string => {
    let p = String(input ?? '').trim();
    while (p.startsWith('[[')) p = p.slice(2);
    while (p.endsWith(']]')) p = p.slice(0, -2);
    return p;
  };

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

  // coalesce-settings-header-style-changed
  document.addEventListener('coalesce-settings-header-style-changed', (event: CustomEvent) => {
    const { headerStyle } = event.detail || {};
    logger?.debug?.('Received coalesce-settings-header-style-changed event', { headerStyle });

    if (!headerStyle) {
      return;
    }

    try {
      const settingsSlice = orchestrator.getSlice('settings') as any;
      if (settingsSlice && typeof settingsSlice.updateSetting === 'function') {
        // Fire-and-forget persistence of header style changes from the header UI
        void settingsSlice.updateSetting('headerStyle', headerStyle);
      } else {
        logger?.warn?.(
          'Settings slice not available or updateSetting method not found for header style change',
        );
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-settings-header-style-changed event', {
        headerStyle,
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

  // coalesce-settings-content-filter-changed (hideBacklinkLine, hideFirstHeader)
  document.addEventListener('coalesce-settings-content-filter-changed', (event: CustomEvent) => {
    const { hideBacklinkLine, hideFirstHeader } = event.detail || {};
    logger?.debug?.('Received coalesce-settings-content-filter-changed event', { hideBacklinkLine, hideFirstHeader });

    try {
      const backlinksSlice = orchestrator.getSlice('backlinks') as any;
      if (backlinksSlice && typeof backlinksSlice.setOptions === 'function') {
        backlinksSlice.setOptions({ hideBacklinkLine, hideFirstHeader });
        // Trigger a refresh to re-render blocks with new filter settings
        if (typeof backlinksSlice.refreshAllViews === 'function') {
          backlinksSlice.refreshAllViews();
        }
      } else {
        logger?.warn?.('Backlinks slice not available for content filter change');
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-settings-content-filter-changed event', {
        hideBacklinkLine,
        hideFirstHeader,
        error,
      });
    }
  });

  // coalesce-navigate (navigation via backlinks)
  document.addEventListener('coalesce-navigate', (event: CustomEvent) => {
    const { filePath, openInNewTab, blockId } = event.detail;
    const cleanedFilePath = cleanVaultPath(filePath);
    logger?.debug?.('Received coalesce-navigate event for navigation', {
      filePath: cleanedFilePath,
      openInNewTab,
      blockId,
    });

    try {
      const backlinks = orchestrator.getSlice('backlinks') as any;
      if (backlinks && typeof backlinks.handleNavigation === 'function') {
        backlinks.handleNavigation(cleanedFilePath, openInNewTab || false, blockId);
      } else {
        // Fallback to direct navigation if backlinks slice not available
        // IMPORTANT:
        // openLinkText expects a link-text like "path" or "path#^blockId".
        // Do NOT wrap in [[...]] (that's markdown syntax, not part of a filename).
        const linkText = blockId
          ? `${cleanedFilePath}#^${blockId}`
          : cleanedFilePath;
        app.workspace.openLinkText(linkText, '', openInNewTab || false);
      }
    } catch (error) {
      logger?.error?.('Failed to handle coalesce-navigate event', {
        filePath: cleanedFilePath,
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
        // NOTE:
        // We do NOT skip file-open during cold start.
        // The previous "skip during cold start" logic could leave the plugin stuck if cold-start
        // never flips to false (e.g., because resolvedLinks/unresolvedLinks stay empty).
        // updateForFile already has its own duplicate suppression, so it's safe to call here.
        const inColdStart = !!viewInitializer?.isColdStartProcessing?.();

        logger?.debug?.('File open event (fallback)', {
          path: file.path,
          extension: file.extension,
          basename: file.basename,
          inColdStart,
        });

        if (updateCoalesceUIForFile) {
          // Small delay so the view DOM has a chance to settle after the file switch.
          // This improves reliability when a note is opened into an existing pane/leaf.
          setTimeout(() => {
            void updateCoalesceUIForFile(file.path);
          }, inColdStart ? 250 : 50);
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
        // Skip during cold start - views are already being processed by initializeExistingViews
        if (updateCoalesceUIForFile && activeView.file && !viewInitializer?.isColdStartProcessing?.()) {
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
              // FORCE refresh to bypass duplicate suppression
              void updateCoalesceUIForFile(filePath, true);
            }
          }, 100);
        } else if (viewInitializer?.isColdStartProcessing?.()) {
          logger?.debug?.('Skipping active-leaf-change event during cold start', {
            path: activeView.file?.path,
          });
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

    if (data.file && updateCoalesceUIForFile) {
        logger?.debug?.('Delegating file:opened to updateCoalesceUIForFile', { filePath: data.file.path });
        void updateCoalesceUIForFile(data.file.path);
    } else if (!updateCoalesceUIForFile) {
        logger?.warn?.('updateCoalesceUIForFile is not defined during file:opened event');
    }
  });

  // layout:changed - process all views that are in preview mode
  orchestrator.on('layout:changed', (data: any) => {
    const viewIntegration = orchestrator.getSlice('viewIntegration');

    if (viewIntegration && data.file && data.view) {
      // Handle mode switch for the view that triggered the event
      (viewIntegration as any)?.handleModeSwitch?.(data.file, data.view);
      
      // If the view is now in preview mode, ensure it has UI attached
      if (data.view.getMode() === 'preview' && data.view.file && updateCoalesceUIForFile) {
        logger?.debug?.('Layout changed - view entered preview mode, delegating to updateCoalesceUIForFile', {
          filePath: data.file.path,
          leafId: (data.view.leaf as any).id,
        });
        
        void updateCoalesceUIForFile(data.file.path);
      }
    }
    
    // Also check all other visible views to ensure they have UI if in preview mode
    if (viewIntegration && updateCoalesceUIForFile) {
      const allViews = app.workspace.getLeavesOfType('markdown');
      allViews.forEach((leaf) => {
        const view = leaf.view as MarkdownView;
        if (view?.file && view.getMode() === 'preview') {
          const hasUI = view.contentEl.querySelector('.coalesce-custom-backlinks-container') !== null;
          if (!hasUI) {
            logger?.debug?.('Layout changed - found other view in preview mode without UI, processing', {
              filePath: view.file.path,
              leafId: (leaf as any).id,
            });
            
            void updateCoalesceUIForFile(view.file.path);
          }
        }
      });
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