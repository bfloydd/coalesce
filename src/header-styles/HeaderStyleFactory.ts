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

        let headerStyle: AbstractHeaderStyle;

        switch (style) {
            case 'first-heading-tidy-bold':
                headerStyle = new FirstHeadingTidyBoldHeaderStyle(blockContent);
                break;
            case 'first-heading-tidy':
                headerStyle = new FirstHeadingTidyHeaderStyle(blockContent);
                break;
            case 'first-heading-short':
                headerStyle = new FirstHeadingShortHeaderStyle(blockContent);
                break;
            case 'short':
                headerStyle = new ShortHeaderStyle(blockContent);
                break;
            case 'full':
            default:
                if (!this.VALID_STYLES.includes(style as any)) {
                    this.logger.warn('Invalid header style, falling back to full style', {
                        invalidStyle: style,
                        validStyles: this.VALID_STYLES
                    });
                }
                headerStyle = new FullHeaderStyle(blockContent);
                break;
        }

        this.logger.debug('Header style created', {
            style,
            type: headerStyle.constructor.name
        });

        return headerStyle;
    }
}  