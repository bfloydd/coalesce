import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FirstHeadingShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with first heading short style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const fileName = this.extractFileName(path);
        const firstHeading = this.findFirstHeading();
        const formattedTitle = this.combineFileNameAndHeading(fileName, firstHeading);
            
        this.logger.debug('Title formatted with heading', {
            fileName,
            firstHeading,
            formattedTitle
        });
        
        return formattedTitle;
    }

    showsAddHeadingPrompt(): boolean {
        const firstHeading = this.findFirstHeading();
        return !firstHeading;
    }
    
    private combineFileNameAndHeading(fileName: string, heading: string | null): string {
        return heading ? `${fileName} - ${heading}` : `${fileName} - Add a heading`;
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