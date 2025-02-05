export abstract class AbstractHeaderStyle {
    getDisplayTitle(filePath: string): string {
        const sanitizedPath = this.sanitizePath(filePath);
        return this.formatTitle(sanitizedPath);
    }

    protected sanitizePath(path: string): string {
        return path.replace(/\.md$/, '');
    }

    protected abstract formatTitle(path: string): string;
} 