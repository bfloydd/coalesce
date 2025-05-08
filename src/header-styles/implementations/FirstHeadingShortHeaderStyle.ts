import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading short style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        
        this.logger.debug('File name extracted', {
            parts,
            fileName
        });
        
        const firstHeading = this.findFirstHeading();
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

    private findFirstHeading(): string | null {
        this.logger.debug('Searching for first heading in block content');
        
        const headingMatch = this.blockContent.match(/^#{1,5}\s+(.+?)$/m);
        const heading = headingMatch ? headingMatch[1] : null;
        
        this.logger.debug('First heading search result', {
            found: !!heading,
            heading,
            matchGroups: headingMatch ? headingMatch.length : 0
        });
        
        return heading;
    }
} 