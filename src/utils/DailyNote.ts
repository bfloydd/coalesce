import { Logger } from './Logger';
import { App } from 'obsidian';

// Define types for the daily notes plugin
interface DailyNotesPlugin {
    enabled: boolean;
    instance: {
        options: {
            folder: string;
        };
    };
}

// Define types for the internal plugins
interface InternalPlugins {
    plugins: {
        'daily-notes': DailyNotesPlugin;
        [key: string]: unknown;
    };
}

// Define the extended App interface
interface ExtendedApp extends App {
    internalPlugins: InternalPlugins;
}

export class DailyNote {
    private static logger: Logger = new Logger('DailyNote');

    static isDaily(app: ExtendedApp, filePath: string): boolean {
        const dailyNotesPlugin = app.internalPlugins.plugins['daily-notes'];
        
        this.logger.debug('Checking if file is a daily note', { filePath });
        
        if (!this.isDailyNotesPluginEnabled(dailyNotesPlugin)) {
            return false;
        }

        const dailyNotesFolder = this.getDailyNotesFolder(dailyNotesPlugin);
        const fileName = this.getFileNameFromPath(filePath);

        const isInDailyFolder = filePath.startsWith(dailyNotesFolder);
        const matchesPattern = this.matchesDailyNotePattern(fileName);
        
        this.logDailyNoteCheckResult(filePath, dailyNotesFolder, fileName, isInDailyFolder, matchesPattern);

        return isInDailyFolder && matchesPattern;
    }
    
    private static isDailyNotesPluginEnabled(plugin: DailyNotesPlugin | undefined): boolean {
        const isEnabled = !!plugin && plugin.enabled;
        
        if (!isEnabled) {
            this.logger.debug('Daily notes plugin not found or disabled', {
                pluginFound: !!plugin,
                pluginEnabled: plugin?.enabled
            });
        }
        
        return isEnabled;
    }
    
    private static getDailyNotesFolder(plugin: DailyNotesPlugin): string {
        return plugin.instance.options.folder || '';
    }
    
    private static getFileNameFromPath(filePath: string): string {
        const pathParts = filePath.split('/');
        return pathParts[pathParts.length - 1];
    }
    
    private static matchesDailyNotePattern(fileName: string): boolean {
        const dailyNotePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
        return dailyNotePattern.test(fileName);
    }
    
    private static logDailyNoteCheckResult(
        filePath: string, 
        dailyNotesFolder: string, 
        fileName: string, 
        isInDailyFolder: boolean, 
        matchesPattern: boolean
    ): void {
        this.logger.debug('Daily note check result', {
            filePath,
            dailyNotesFolder,
            fileName,
            isInDailyFolder,
            matchesPattern,
            isDaily: isInDailyFolder && matchesPattern
        });
    }
} 