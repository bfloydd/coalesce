import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingTidyHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        const firstHeading = this.findAndFormatFirstHeading();
        return firstHeading ? 
            `${fileName} - ${firstHeading}` : 
            fileName;
    }

    private findAndFormatFirstHeading(): string | null {
        const headingMatch = this.blockContent.match(/^#{1,5}\s+(.+?)$/m);
        if (!headingMatch) return null;

        let headingText = headingMatch[1];
        
        // Replace all wiki-links with formatted versions
        headingText = headingText.replace(/\[\[([^\]]+)\]\]/g, (_match, content) => {
            // Split by pipe if it exists
            const [fullPath, alias] = content.split('|').map((s: string) => s.trim());
            
            // Get the last part of the path
            const pathParts = fullPath.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            
            if (!alias) {
                // Case: [[Coal]] -> [Coal]
                return `[${lastPart}]`;
            }
            
            if (lastPart === alias) {
                // Case: [[Path/To/Something|Something]] -> [Something]
                return `[${alias}]`;
            }
            
            // Case: [[Path/To/Something|Other]] -> [Something > Other]
            return `[${lastPart} > ${alias}]`;
        });

        return headingText;
    }
} 