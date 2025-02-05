import { AbstractHeaderStyle } from './base/AbstractHeaderStyle';
import { FullHeaderStyle } from './implementations/FullHeaderStyle';
import { ShortHeaderStyle } from './implementations/ShortHeaderStyle';

export class HeaderStyleFactory {
    static createHeaderStyle(style: string): AbstractHeaderStyle {
        switch (style) {
            case 'short':
                return new ShortHeaderStyle();
            case 'full':
            default:
                return new FullHeaderStyle();
        }
    }
} 