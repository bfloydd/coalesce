import { Logger } from '../utils/Logger';

export class HeaderStyleManager {
    private static readonly STYLES = [
        'full', 
        'short', 
        'first-heading-short',
        'first-heading-tidy',
        'first-heading-tidy-bold'
    ] as const;
    
    private static logger: Logger = new Logger('HeaderStyleManager');
    
    public static get styles(): readonly string[] {
        this.logger.debug('Getting available header styles');
        return this.STYLES;
    }

    public static isValidStyle(style: string): boolean {
        const isValid = this.STYLES.includes(style as any);
        this.logger.debug('Validating header style', {
            style,
            isValid,
            availableStyles: this.STYLES
        });
        return isValid;
    }

    public static getDefaultStyle(): string {
        const defaultStyle = this.STYLES[0];
        this.logger.debug('Getting default header style', { defaultStyle });
        return defaultStyle;
    }
} 