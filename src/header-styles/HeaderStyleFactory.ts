import { Logger } from '../utils/Logger';
import { AbstractHeaderStyle } from './base/AbstractHeaderStyle';
import { FullHeaderStyle } from './implementations/FullHeaderStyle';
import { ShortHeaderStyle } from './implementations/ShortHeaderStyle';
import { FirstHeadingShortHeaderStyle } from './implementations/FirstHeadingShortHeaderStyle';
import { FirstHeadingTidyHeaderStyle } from './implementations/FirstHeadingTidyHeaderStyle';
import { FirstHeadingTidyBoldHeaderStyle } from './implementations/FirstHeadingTidyBoldHeaderStyle';

export class HeaderStyleFactory {
    private static readonly VALID_STYLES = [
        'first-heading-tidy-bold',
        'first-heading-tidy',
        'first-heading-short',
        'short',
        'full'
    ] as const;
    private static logger: Logger = new Logger('HeaderStyleFactory');

    static createHeaderStyle(style: string, blockContent: string = ''): AbstractHeaderStyle {
        this.logger.debug('Creating header style', {
            requestedStyle: style,
            validStyles: this.VALID_STYLES,
            hasBlockContent: !!blockContent,
            blockContentLength: blockContent.length
        });

        const headerStyle = this.instantiateHeaderStyle(style, blockContent);

        this.logger.debug('Header style created', {
            style,
            type: headerStyle.constructor.name
        });

        return headerStyle;
    }
    
    private static instantiateHeaderStyle(style: string, blockContent: string): AbstractHeaderStyle {
        switch (style) {
            case 'first-heading-tidy-bold':
                return new FirstHeadingTidyBoldHeaderStyle(blockContent);
            case 'first-heading-tidy':
                return new FirstHeadingTidyHeaderStyle(blockContent);
            case 'first-heading-short':
                return new FirstHeadingShortHeaderStyle(blockContent);
            case 'short':
                return new ShortHeaderStyle(blockContent);
            case 'full':
                return new FullHeaderStyle(blockContent);
            default:
                return this.handleInvalidStyle(style, blockContent);
        }
    }
    
    private static handleInvalidStyle(style: string, blockContent: string): AbstractHeaderStyle {
        if (!this.VALID_STYLES.includes(style as any)) {
            this.logger.warn('Invalid header style, falling back to full style', {
                invalidStyle: style,
                validStyles: this.VALID_STYLES
            });
        }
        return new FullHeaderStyle(blockContent);
    }
}  