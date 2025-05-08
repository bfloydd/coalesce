import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingTidyHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading tidy style', {
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
        const formattedTitle = firstHeading ? 
            `${fileName} - ${firstHeading}` : 
            fileName;
            
        this.logger.debug('Title formatted with heading', {
            fileName,
            firstHeading,
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