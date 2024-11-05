import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView } from './CoalesceView';
import { Logger } from './Logger';

export class CoalesceManager {
    private coalesceView: CoalesceView | null = null;
    private logger: Logger = new Logger();

    constructor(private app: App) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        if (this.coalesceView) {
            this.coalesceView.clear();
        }

        const currentNoteName = file.basename;
        this.coalesceView = new CoalesceView(view, currentNoteName);

        const backlinks = this.app.metadataCache.resolvedLinks;
        const filesLinkingToThis = Object.entries(backlinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);

        this.coalesceView.updateBacklinks(filesLinkingToThis, (path) => {
            this.app.workspace.openLinkText(path, '', false);
        });
    }

    clearBacklinks() {
        if (this.coalesceView) {
            this.coalesceView.clear();
        }
    }
}
