import { AbstractHeaderStyle } from '../base/AbstractHeaderStyle';

export class FullHeaderStyle extends AbstractHeaderStyle {
    protected formatTitle(path: string): string {
        return path;
    }
} 