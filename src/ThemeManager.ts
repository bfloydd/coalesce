export class ThemeManager {
    private static readonly THEMES = ['default', 'modern', 'minimal', 'naked'] as const;
    
    public static get themes(): readonly string[] {
        return this.THEMES;
    }

    public static isValidTheme(theme: string): boolean {
        return this.THEMES.includes(theme as any);
    }

    public static getDefaultTheme(): string {
        return this.THEMES[0];
    }
} 