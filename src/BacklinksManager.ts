import { App, MarkdownView, TFile } from 'obsidian';
import { CoalesceView as BacklinksView } from './CoalesceView';
import { Logger } from './Logger';

export class BacklinksManager {
    private backlinksView: BacklinksView | null = null;
    private logger: Logger = new Logger();

    constructor(private app: App) {}

    handleFileOpen(file: TFile) {
        if (!file) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        if (this.backlinksView) {
            this.backlinksView.clear();
        }

        const currentNoteName = file.basename;
        this.backlinksView = new BacklinksView(view, currentNoteName);

        const backlinks = this.app.metadataCache.resolvedLinks;
        const filesLinkingToThis = Object.entries(backlinks)
            .filter(([_, links]) => file.path in (links as Record<string, unknown>))
            .map(([sourcePath]) => sourcePath);

        this.backlinksView.updateBacklinks(filesLinkingToThis, (path) => {
            this.app.workspace.openLinkText(path, '', false);
        });
    }

    clearBacklinks() {
        if (this.backlinksView) {
            this.backlinksView.clear();
        }
    }
}
