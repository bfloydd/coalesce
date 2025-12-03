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

  // active-leaf-change - forward to orchestrator
  plugin.registerEvent(
    app.workspace.on('active-leaf-change', () => {
      const activeView = app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        logger?.debug?.('Active leaf change event', { path: activeView.file.path });

        orchestrator.emit('active-leaf:changed', {
          file: activeView.file,
          view: activeView,
        });
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

      // Initialize view for the file
      const activeView = app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView && activeView.file?.path === data.file.path) {
        logger?.debug?.('Orchestrator active view matches, proceeding', {
          filePath: data.file.path,
        });

        // Initialize view integration
        await (viewIntegration as any)?.initializeView?.(data.file, activeView);

        // Use the consolidated backlinks slice to attach the complete UI
        logger?.debug?.('Orchestrator calling attachToDOM', { filePath: data.file.path });

        // Don't force refresh for orchestrator events (automatic app startup processing)
        const uiAttached = await (backlinks as any)?.attachToDOM?.(
          activeView,
          data.file.path,
          false,
        );

        logger?.debug?.('Orchestrator attachToDOM result', {
          filePath: data.file.path,
          uiAttached,
        });

        // Only apply settings and log if UI was actually attached (not skipped due to recent attachment)
        if (uiAttached) {
          logger?.debug?.('Orchestrator applying settings', { filePath: data.file.path });

          // Apply current settings to the backlinks UI
          const settingsSlice = orchestrator.getSlice('settings') as any;
          let settings = settingsSlice?.getSettings?.() || {};

          // If settings aren't loaded yet, load them now
          if (!settings || Object.keys(settings).length === 0) {
            await settingsSlice?.loadSettings?.();
            settings = settingsSlice?.getSettings?.() || {};
          }

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
          });
        } else {
          logger?.debug?.('Orchestrator UI was not attached (skipped)', {
            filePath: data.file.path,
          });
        }
      } else {
        logger?.debug?.('Orchestrator active view does not match', {
          activeViewPath: activeView?.file?.path,
          eventFilePath: data.file.path,
        });
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