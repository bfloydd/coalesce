import { App } from 'obsidian';
import { AppWithInternalPlugins } from '../shared-contracts/obsidian';

/**
 * Daily Note Utilities for Vertical Slice Architecture
 * 
 * Provides utilities for detecting and working with daily notes
 * in Obsidian, particularly for the daily notes plugin integration.
 */
export class DailyNote {
    /**
     * Check if a file path represents a daily note
     * 
     * @param app The Obsidian app instance with internal plugins
     * @param filePath The file path to check
     * @returns True if the file is a daily note, false otherwise
     */
    static isDaily(app: AppWithInternalPlugins, filePath: string): boolean {
        try {
            // Check if daily notes plugin is enabled
            if (!app.internalPlugins?.plugins?.['daily-notes']?.enabled) {
                return false;
            }

            const dailyNotesPlugin = app.internalPlugins.plugins['daily-notes'];
            const dailyNotesFolder = dailyNotesPlugin?.instance?.options?.folder || '';
            
            // Normalize the file path for comparison
            const normalizedPath = filePath.replace(/\\/g, '/');
            
            // Check if the file is in the daily notes folder
            if (dailyNotesFolder && !normalizedPath.startsWith(dailyNotesFolder.replace(/\\/g, '/'))) {
                return false;
            }

            // Extract filename from path
            const fileName = normalizedPath.split('/').pop() || '';
            const fileNameWithoutExt = fileName.replace(/\.md$/, '');

            // Check if filename matches daily note format (YYYY-MM-DD)
            const dailyNotePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!dailyNotePattern.test(fileNameWithoutExt)) {
                return false;
            }

            // Validate that it's a valid date
            const dateParts = fileNameWithoutExt.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10);
            const day = parseInt(dateParts[2], 10);

            const date = new Date(year, month - 1, day);
            
            // Check if the date is valid
            return (
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day
            );
        } catch (error) {
            // If there's any error checking, assume it's not a daily note
            return false;
        }
    }

    /**
     * Get the path for today's daily note
     * 
     * @param app The Obsidian app instance with internal plugins
     * @param date Optional date to get daily note for (defaults to today)
     * @returns The file path for the daily note, or null if not configured
     */
    static getDailyNotePath(app: AppWithInternalPlugins, date: Date = new Date()): string | null {
        try {
            // Check if daily notes plugin is enabled
            if (!app.internalPlugins?.plugins?.['daily-notes']?.enabled) {
                return null;
            }

            const dailyNotesPlugin = app.internalPlugins.plugins['daily-notes'];
            const dailyNotesFolder = dailyNotesPlugin?.instance?.options?.folder || '';
            
            // Format date as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            // Construct the file path
            const fileName = `${dateStr}.md`;
            const fullPath = dailyNotesFolder ? 
                `${dailyNotesFolder.replace(/\\/g, '/')}/${fileName}` : 
                fileName;
                
            return fullPath;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the date from a daily note file path
     * 
     * @param filePath The file path to extract date from
     * @returns The Date object if valid, null otherwise
     */
    static getDateFromPath(filePath: string): Date | null {
        try {
            // Extract filename from path
            const fileName = filePath.split('/').pop() || '';
            const fileNameWithoutExt = fileName.replace(/\.md$/, '');

            // Check if filename matches daily note format (YYYY-MM-DD)
            const dailyNotePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!dailyNotePattern.test(fileNameWithoutExt)) {
                return null;
            }

            // Parse the date
            const dateParts = fileNameWithoutExt.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10);
            const day = parseInt(dateParts[2], 10);

            const date = new Date(year, month - 1, day);
            
            // Validate the date
            if (
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day
            ) {
                return date;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get all daily note file paths in the vault
     * 
     * @param app The Obsidian app instance
     * @returns Array of daily note file paths
     */
    static getAllDailyNotePaths(app: App): string[] {
        try {
            const allFiles = app.vault.getMarkdownFiles();
            const dailyNotePaths: string[] = [];

            for (const file of allFiles) {
                if (this.isDaily(app as AppWithInternalPlugins, file.path)) {
                    dailyNotePaths.push(file.path);
                }
            }

            // Sort by date (newest first)
            dailyNotePaths.sort((a, b) => {
                const dateA = this.getDateFromPath(a);
                const dateB = this.getDateFromPath(b);
                
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
            });

            return dailyNotePaths;
        } catch (error) {
            return [];
        }
    }

    /**
     * Get the most recent daily note path
     * 
     * @param app The Obsidian app instance
     * @returns The most recent daily note path, or null if none found
     */
    static getMostRecentDailyNote(app: App): string | null {
        const dailyNotes = this.getAllDailyNotePaths(app);
        return dailyNotes.length > 0 ? dailyNotes[0] : null;
    }

    /**
     * Check if daily notes are configured and available
     * 
     * @param app The Obsidian app instance with internal plugins
     * @returns True if daily notes are configured, false otherwise
     */
    static isConfigured(app: AppWithInternalPlugins): boolean {
        try {
            return !!app.internalPlugins?.plugins?.['daily-notes']?.enabled;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the daily notes folder path
     * 
     * @param app The Obsidian app instance with internal plugins
     * @returns The daily notes folder path, or empty string if not configured
     */
    static getDailyNotesFolder(app: AppWithInternalPlugins): string {
        try {
            const dailyNotesPlugin = app.internalPlugins?.plugins?.['daily-notes'];
            return dailyNotesPlugin?.instance?.options?.folder || '';
        } catch (error) {
            return '';
        }
    }

    /**
     * Create a daily note for a specific date if it doesn't exist
     * 
     * @param app The Obsidian app instance
     * @param date The date to create daily note for
     * @param template Optional template content for the daily note
     * @returns The file path of the created or existing daily note
     */
    static async createDailyNoteIfNotExists(
        app: App, 
        date: Date = new Date(), 
        template: string = ''
    ): Promise<string | null> {
        try {
            const dailyNotePath = this.getDailyNotePath(app as AppWithInternalPlugins, date);
            
            if (!dailyNotePath) {
                return null;
            }

            // Check if the file already exists
            const existingFile = app.vault.getAbstractFileByPath(dailyNotePath);
            if (existingFile) {
                return dailyNotePath;
            }

            // Create the daily note
            await app.vault.create(dailyNotePath, template);
            return dailyNotePath;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get daily note statistics
     * 
     * @param app The Obsidian app instance
     * @returns Statistics about daily notes in the vault
     */
    static getDailyNoteStatistics(app: App): {
        totalDailyNotes: number;
        oldestDailyNote: string | null;
        newestDailyNote: string | null;
        dailyNotesFolder: string;
    } {
        const dailyNotes = this.getAllDailyNotePaths(app);
        
        return {
            totalDailyNotes: dailyNotes.length,
            oldestDailyNote: dailyNotes.length > 0 ? dailyNotes[dailyNotes.length - 1] : null,
            newestDailyNote: dailyNotes.length > 0 ? dailyNotes[0] : null,
            dailyNotesFolder: this.getDailyNotesFolder(app as AppWithInternalPlugins)
        };
    }
}