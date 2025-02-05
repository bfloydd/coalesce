import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        const firstHeading = this.findFirstHeading();
        return firstHeading ? 
            `${fileName} - ${firstHeading}` : 
            fileName;
    }

    private findFirstHeading(): string | null {
        const headingMatch = this.blockContent.match(/^#{1,5}\s+(.+?)$/m);
        return headingMatch ? headingMatch[1] : null;
    }
} 