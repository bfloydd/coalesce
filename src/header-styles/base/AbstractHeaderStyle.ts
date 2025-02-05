export abstract class AbstractHeaderStyle {
    constructor(protected blockContent: string = '') {}

    getDisplayTitle(filePath: string): string {
        const sanitizedPath = this.sanitizePath(filePath);
        return this.formatTitle(sanitizedPath);
    }

    protected sanitizePath(path: string): string {
        return path.replace(/\.md$/, '');
    }

    protected abstract formatTitle(path: string): string;
} 