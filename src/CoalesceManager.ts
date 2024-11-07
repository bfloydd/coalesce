import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView } from './CoalesceView';
import { Logger } from './Logger';
import { SettingsManager } from './SettingsManager';
import { DefaultBlockBoundaryStrategy } from './DefaultBlockBoundaryStrategy';
import { SingleLineBlockBoundaryStrategy } from './SingleLineBlockBoundaryStrategy';

export class CoalesceManager {
    private coalesceView: CoalesceView | null = null;
    private logger: Logger = new Logger();

    constructor(private app: App, private settingsManager: SettingsManager) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        if (this.coalesceView) {
            this.coalesceView.clear();
        }

        const currentNoteName = file.basename;
        const blockBoundaryStrategy = this.getStrategyFromSettings();
        this.coalesceView = new CoalesceView(view, currentNoteName, this.settingsManager, blockBoundaryStrategy);

        const backlinks = this.app.metadataCache.resolvedLinks;
        const filesLinkingToThis = Object.entries(backlinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);

        this.coalesceView.updateBacklinks(filesLinkingToThis, (path) => {
            this.app.workspace.openLinkText(path, '', false);
        });
    }

    private getStrategyFromSettings() {
        const blockBoundaryStrategy = this.settingsManager.settings.blockBoundaryStrategy;
        switch (blockBoundaryStrategy) {
            case 'single-line':
                return new SingleLineBlockBoundaryStrategy();
            case 'default':
            default:
                return new DefaultBlockBoundaryStrategy();
        }
    }

    clearBacklinks() {
        if (this.coalesceView) {
            this.coalesceView.clear();
        }
    }
}
