export class HeaderStyleManager {
    private static readonly STYLES = [
        'full', 
        'short', 
        'first-heading-short',
        'first-heading-tidy',
        'first-heading-tidy-bold'
    ] as const;
    
    public static get styles(): readonly string[] {
        return this.STYLES;
    }

    public static isValidStyle(style: string): boolean {
        return this.STYLES.includes(style as any);
    }

    public static getDefaultStyle(): string {
        return this.STYLES[0];
    }
} 