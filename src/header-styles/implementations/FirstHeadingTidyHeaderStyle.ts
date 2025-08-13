import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingTidyHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading tidy style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const firstHeading = this.findAndFormatFirstHeading();
        
        if (!firstHeading) {
            this.logger.debug('No heading found, showing guidance message');
            // Show clean guidance message when no heading exists
            return '📝 Add a heading';
        }
        
        this.logger.debug('Final title formatted', {
            firstHeading,
            formattedTitle: firstHeading
        });
        
        return firstHeading;
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
