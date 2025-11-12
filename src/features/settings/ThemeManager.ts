import { Logger } from '../shared-utilities/Logger';

/**
 * Theme Manager for Settings Slice
 * 
 * Handles theme validation, switching, and management
 * for the vertical slice architecture.
 */
export class ThemeManager {
    private static readonly THEMES = ['default', 'modern', 'compact', 'naked'] as const;
    private currentTheme: string;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child('ThemeManager');
        this.currentTheme = this.getDefaultTheme();
        
        this.logger.debug('ThemeManager initialized', {
            currentTheme: this.currentTheme,
            availableThemes: ThemeManager.THEMES
        });
    }

    /**
     * Get all available themes
     */
    getAvailableThemes(): readonly string[] {
        this.logger.debug('Getting available themes');
        return ThemeManager.THEMES;
    }

    /**
     * Check if a theme is valid
     */
    isValidTheme(theme: string): boolean {
        const isValidTheme = (t: string): t is typeof ThemeManager.THEMES[number] => 
            ThemeManager.THEMES.includes(t as typeof ThemeManager.THEMES[number]);
            
        const isValid = isValidTheme(theme);
        this.logThemeValidation(theme, isValid);
        return isValid;
    }
    
    /**
     * Get the current theme
     */
    getCurrentTheme(): string {
        this.logger.debug('Getting current theme', { currentTheme: this.currentTheme });
        return this.currentTheme;
    }

    /**
     * Set the current theme
     */
    setCurrentTheme(theme: string): void {
        this.logger.debug('Setting current theme', { 
            oldTheme: this.currentTheme, 
            newTheme: theme 
        });
        
        if (!this.isValidTheme(theme)) {
            const error = `Invalid theme: ${theme}`;
            this.logger.error(error, {
                requestedTheme: theme,
                availableThemes: ThemeManager.THEMES
            });
            throw new Error(error);
        }
        
        this.currentTheme = theme;
        this.applyTheme(theme);
        
        this.logger.debug('Theme set successfully', { currentTheme: this.currentTheme });
    }

    /**
     * Get the default theme
     */
    getDefaultTheme(): string {
        const defaultTheme = ThemeManager.THEMES[0];
        this.logger.debug('Getting default theme', { defaultTheme });
        return defaultTheme;
    }

    /**
     * Apply theme to the UI
     */
    private applyTheme(theme: string): void {
        this.logger.debug('Applying theme to UI', { theme });
        
        try {
            // Remove existing theme classes
            ThemeManager.THEMES.forEach(t => {
                document.body.classList.remove(`coalesce-theme-${t}`);
            });
            
            // Add new theme class
            document.body.classList.add(`coalesce-theme-${theme}`);
            
            this.logger.debug('Theme applied to UI successfully', { theme });
        } catch (error) {
            this.logger.error('Failed to apply theme to UI', { theme, error });
            throw error;
        }
    }

    /**
     * Log theme validation
     */
    private logThemeValidation(theme: string, isValid: boolean): void {
        this.logger.debug('Validating theme', {
            theme,
            isValid,
            availableThemes: ThemeManager.THEMES
        });
    }

    /**
     * Get theme metadata
     */
    getThemeMetadata(theme: string): {
        name: string;
        description: string;
        isDark: boolean;
        isCompact: boolean;
    } | null {
        if (!this.isValidTheme(theme)) {
            this.logger.warn('Getting metadata for invalid theme', { theme });
            return null;
        }

        const metadata: Record<string, { name: string; description: string; isDark: boolean; isCompact: boolean }> = {
            'default': {
                name: 'Default',
                description: 'Standard theme with balanced styling',
                isDark: false,
                isCompact: false
            },
            'modern': {
                name: 'Modern',
                description: 'Clean, contemporary design with subtle shadows',
                isDark: false,
                isCompact: false
            },
            'compact': {
                name: 'Compact',
                description: 'Space-efficient layout for smaller screens',
                isDark: false,
                isCompact: true
            },
            'naked': {
                name: 'Naked',
                description: 'Minimal styling with maximum content focus',
                isDark: false,
                isCompact: false
            }
        };

        const themeMetadata = metadata[theme];
        this.logger.debug('Getting theme metadata', { theme, metadata: themeMetadata });
        
        return themeMetadata;
    }

    /**
     * Get theme statistics
     */
    getStatistics(): {
        totalThemes: number;
        currentTheme: string;
        isCustomTheme: boolean;
    } {
        const isCustomTheme = !ThemeManager.THEMES.includes(this.currentTheme as typeof ThemeManager.THEMES[number]);
        
        return {
            totalThemes: ThemeManager.THEMES.length,
            currentTheme: this.currentTheme,
            isCustomTheme
        };
    }

    /**
     * Cleanup resources used by this theme manager
     */
    cleanup(): void {
        this.logger.debug('Cleaning up ThemeManager');
        
        // Remove all theme classes
        ThemeManager.THEMES.forEach(t => {
            document.body.classList.remove(`coalesce-theme-${t}`);
        });
        
        this.logger.debug('ThemeManager cleanup completed');
    }
}

// Export the interface for external use
export interface IThemeManager {
    getCurrentTheme(): string;
    setTheme(theme: string): void;
    getAvailableThemes(): string[];
    isValidTheme(theme: string): boolean;
    getDefaultTheme(): string;
    getThemeMetadata(theme: string): {
        name: string;
        description: string;
        isDark: boolean;
        isCompact: boolean;
    } | null;
}