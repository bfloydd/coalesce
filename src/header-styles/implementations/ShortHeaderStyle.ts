import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class ShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with short style', {
            path,
            blockContentLength: this.blockContent.length
        });
        
        const parts = path.split('/');
        const shortTitle = parts[parts.length - 1];
        
        this.logger.debug('Title shortened', {
            parts,
            shortTitle
        });
        
        return shortTitle;
    }
} 