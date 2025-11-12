import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FullHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        this.logger.debug('Formatting title with full path style', {
            path,
            blockContentLength: this.blockContent.length
        });
        return path;
    }
} 