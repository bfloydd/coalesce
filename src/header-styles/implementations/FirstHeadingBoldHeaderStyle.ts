import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingBoldHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading bold style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const fileName = this.extractFileName(path);
        const firstHeading = this.findAndFormatFirstHeading();
        
        if (!firstHeading) {
            this.logger.debug('No heading found, showing filename with guidance', { fileName });
            return `${fileName} - 📝 Add a heading`;
        }
        
        const processedText = this.convertToBoldText(firstHeading);
        const formattedTitle = `${fileName} - ${processedText}`;
        
        this.logger.debug('Final title formatted', {
            fileName,
            processedText,
            formattedTitle
        });
        
        return formattedTitle;
    }
    
    private convertToBoldText(text: string): string {
        // Split the text into parts: outside brackets and inside brackets
        const parts = text.split(/(\[[^\]]+\])/);
        this.logger.debug('Split heading into parts', { parts });
        
        // Convert each part, but only apply bold to parts outside brackets
        return parts.map(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                return this.preserveBracketedContent(part);
            } else {
                return this.convertPartToBold(part);
            }
        }).join('');
    }
    
    private preserveBracketedContent(part: string): string {
        this.logger.debug('Preserving bracketed content', { part });
        return part;
    }
    
    private convertPartToBold(part: string): string {
        // Convert to uppercase first, then to mathematical bold for letters only
        const upperPart = part.toUpperCase();
        const boldPart = upperPart.replace(/[A-Z]/g, char => this.getBoldLetter(char));
        
        this.logger.debug('Converted text to bold', {
            original: part,
            uppercase: upperPart,
            bold: boldPart
        });
        
        return boldPart;
    }
    
    private getBoldLetter(char: string): string {
        const boldMap: { [key: string]: string } = {
            'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
            'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
            'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
            'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
        };
        return boldMap[char] || char;
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
        headingText = this.formatWikiLinksInHeading(headingText);

        this.logger.debug('Heading text fully formatted', {
            original: headingMatch[1],
            formatted: headingText
        });

        return headingText;
    }
    
    private formatWikiLinksInHeading(headingText: string): string {
        return headingText.replace(/\[\[([^\]]+)\]\]/g, (_match, content) => {
            return this.formatWikiLink(content);
        });
    }
    
    private formatWikiLink(linkContent: string): string {
        // Split by pipe if it exists
        const [fullPath, alias] = linkContent.split('|').map((s: string) => s.trim());
        
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
            formattedLink = this.formatSimpleLink(lastPart);
        } else if (lastPart === alias) {
            formattedLink = this.formatSameNameLink(alias);
        } else {
            formattedLink = this.formatComplexLink(lastPart, alias);
        }
        
        this.logger.debug('Wiki-link formatted', {
            original: linkContent,
            formatted: formattedLink
        });
        
        return formattedLink;
    }
    
    private formatSimpleLink(text: string): string {
        // Case: [[Coal]] -> [Coal]
        return `[${text}]`;
    }
    
    private formatSameNameLink(alias: string): string {
        // Case: [[Path/To/Something|Something]] -> [Something]
        return `[${alias}]`;
    }
    
    private formatComplexLink(lastPart: string, alias: string): string {
        // Case: [[Path/To/Something|Other]] -> [Something > Other]
        return `[${lastPart} > ${alias}]`;
    }
}
