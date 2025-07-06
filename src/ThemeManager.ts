import { Logger } from './utils/Logger';

export class ThemeManager {
    private static readonly THEMES = ['default', 'modern', 'compact', 'naked'] as const;
    private static logger: Logger = new Logger('ThemeManager');
    
    public static get themes(): readonly string[] {
        this.logger.debug('Getting available themes');
        return this.THEMES;
    }

    public static isValidTheme(theme: string): boolean {
        // Use type predicate to check if theme is in THEMES
        const isValidTheme = (t: string): t is typeof this.THEMES[number] => 
            this.THEMES.includes(t as typeof this.THEMES[number]);
            
        const isValid = isValidTheme(theme);
        this.logThemeValidation(theme, isValid);
        return isValid;
    }
    
    private static logThemeValidation(theme: string, isValid: boolean): void {
        this.logger.debug('Validating theme', {
            theme,
            isValid,
            availableThemes: this.THEMES
        });
    }

    public static getDefaultTheme(): string {
        const defaultTheme = this.THEMES[0];
        this.logger.debug('Getting default theme', { defaultTheme });
        return defaultTheme;
    }
} 