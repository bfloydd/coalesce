import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class ShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with short style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const shortTitle = this.extractFileName(path);
        
        this.logger.debug('Title shortened', {
            shortTitle
        });
        
        return shortTitle;
    }
} 