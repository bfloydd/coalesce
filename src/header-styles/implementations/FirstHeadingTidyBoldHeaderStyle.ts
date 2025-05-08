import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingTidyBoldHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading tidy bold style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        
        this.logger.debug('File name extracted', {
            parts,
            fileName
        });
        
        const firstHeading = this.findAndFormatFirstHeading();
        
        if (!firstHeading) {
            this.logger.debug('No heading found, using file name only', { fileName });
            return fileName;
        }
        
        // Split the text into parts: outside brackets and inside brackets
        const parts2 = firstHeading.split(/(\[[^\]]+\])/);
        this.logger.debug('Split heading into parts', { parts: parts2 });
        
        // Convert each part, but only apply bold to parts outside brackets
        const processedText = parts2.map(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                this.logger.debug('Preserving bracketed content', { part });
                // Keep brackets content in original case
                return part;
            } else {
                // Convert to uppercase first, then to mathematical bold for letters only
                const upperPart = part.toUpperCase();
                const boldPart = upperPart.replace(/[A-Z]/g, char => {
                    const boldMap: { [key: string]: string } = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return boldMap[char] || char;
                });
                
                this.logger.debug('Converted text to bold', {
                    original: part,
                    uppercase: upperPart,
                    bold: boldPart
                });
                
                return boldPart;
            }
        }).join('');
        
        const formattedTitle = `${fileName} - ${processedText}`;
        this.logger.debug('Final title formatted', {
            fileName,
            processedText,
            formattedTitle
        });
        
        return formattedTitle;
    }

    private findAndFormatFirstHeading(): string | null {
        this.logger.debug('Searching for first heading in block content');
        
        const headingMatch = this.blockContent.match(/^#{1,5}\s+(.+?)$/m);
        if (!headingMatch) {
            this.logger.debug('No heading found in block content');
            return null;
        }

        let headingText = headingMatch[1];
        this.logger.debug('Found raw heading text', { headingText });
        
        // Replace all wiki-links with formatted versions
        headingText = headingText.replace(/\[\[([^\]]+)\]\]/g, (_match, content) => {
            // Split by pipe if it exists
            const [fullPath, alias] = content.split('|').map((s: string) => s.trim());
            
            // Get the last part of the path
            const pathParts = fullPath.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            
            this.logger.debug('Processing wiki-link', {
                fullPath,
                alias,
                lastPart
            });
            
            let formattedLink: string;
            if (!alias) {
                // Case: [[Coal]] -> [Coal]
                formattedLink = `[${lastPart}]`;
            } else if (lastPart === alias) {
                // Case: [[Path/To/Something|Something]] -> [Something]
                formattedLink = `[${alias}]`;
            } else {
                // Case: [[Path/To/Something|Other]] -> [Something > Other]
                formattedLink = `[${lastPart} > ${alias}]`;
            }
            
            this.logger.debug('Wiki-link formatted', {
                original: content,
                formatted: formattedLink
            });
            
            return formattedLink;
        });

        this.logger.debug('Heading text fully formatted', {
            original: headingMatch[1],
            formatted: headingText
        });

        return headingText;
    }
} 