import { AbstractHeaderStyle } from './base/AbstractHeaderStyle';
import { FullHeaderStyle } from './implementations/FullHeaderStyle';
import { ShortHeaderStyle } from './implementations/ShortHeaderStyle';
import { FirstHeadingShortHeaderStyle } from './implementations/FirstHeadingShortHeaderStyle';
import { FirstHeadingTidyHeaderStyle } from './implementations/FirstHeadingTidyHeaderStyle';
import { FirstHeadingTidyBoldHeaderStyle } from './implementations/FirstHeadingTidyBoldHeaderStyle';

export class HeaderStyleFactory {
    static createHeaderStyle(style: string, blockContent: string = ''): AbstractHeaderStyle {
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
            default:
                return new FullHeaderStyle(blockContent);
        }
    }
}  