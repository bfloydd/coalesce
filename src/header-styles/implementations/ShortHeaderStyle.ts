import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class ShortHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        const parts = path.split('/');
        return parts[parts.length - 1];
    }
} 