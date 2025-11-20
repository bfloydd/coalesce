import { App } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { NavigationService } from './NavigationService';
import { FileOpener } from './FileOpener';
import { LinkHandler } from './LinkHandler';

/**
 * NavigationFacade
 *
 * Provides a shared NavigationService (and its underlying FileOpener and
 * LinkHandler) so multiple slices (navigation, backlinks, etc.) can coordinate
 * navigation through a single abstraction.
 *
 * This avoids each slice constructing its own NavigationService and keeps
 * navigation behavior consistent across the plugin.
 */
export interface SharedNavigation {
  navigationService: NavigationService;
  fileOpener: FileOpener;
  linkHandler: LinkHandler;
}

let sharedNavigation: SharedNavigation | null = null;

/**
 * Get (or lazily create) the shared navigation components.
 *
 * The first caller provides the App and a base logger. Subsequent callers
 * reuse the same NavigationService / FileOpener / LinkHandler instances.
 */
export function getSharedNavigation(
  app: App,
  baseLogger: Logger,
): SharedNavigation {
  if (sharedNavigation) {
    return sharedNavigation;
  }

  const navigationLogger =
    typeof (baseLogger as any).child === 'function'
      ? (baseLogger as any).child('NavigationFacade')
      : new Logger('NavigationFacade');

  const fileOpener = new FileOpener(app, navigationLogger);
  const linkHandler = new LinkHandler(app, navigationLogger);
  const navigationService = new NavigationService(app, fileOpener, linkHandler, navigationLogger);

  sharedNavigation = {
    navigationService,
    fileOpener,
    linkHandler,
  };

  return sharedNavigation;
}

/**
 * Test-only helper to reset the shared navigation instance.
 */
export function __resetSharedNavigationForTests(): void {
  sharedNavigation = null;
}