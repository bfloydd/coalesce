import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingTidyBoldHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        const firstHeading = this.findAndFormatFirstHeading();
        
        if (!firstHeading) return fileName;
        
        // Convert to uppercase first, then to mathematical bold for letters only
        const boldCapsText = firstHeading.toUpperCase().replace(/[A-Z]/g, char => {
            // Using Unicode Block: Mathematical Bold - a different range
            const boldMap: { [key: string]: string } = {
                'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
            };
            return boldMap[char] || char;
        });
        
        return `${fileName} - ${boldCapsText}`;
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