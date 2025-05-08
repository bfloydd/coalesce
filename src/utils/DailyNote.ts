import { Logger } from './Logger';

export class DailyNote {
    private static logger: Logger = new Logger('DailyNote');

    static isDaily(app: any, filePath: string): boolean {
        const dailyNotesPlugin = app.internalPlugins.plugins['daily-notes'];
        
        this.logger.debug('Checking if file is a daily note', { filePath });
        
        if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
            this.logger.debug('Daily notes plugin not found or disabled', {
                pluginFound: !!dailyNotesPlugin,
                pluginEnabled: dailyNotesPlugin?.enabled
            });
            return false;
        }

        const dailyNotesFolder = dailyNotesPlugin.instance.options.folder || '';
        const dailyNotePattern = /^\d{4}-\d{2}-\d{2}\.md$/;

        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];

        const isInDailyFolder = filePath.startsWith(dailyNotesFolder);
        const matchesPattern = dailyNotePattern.test(fileName);
        
        this.logger.debug('Daily note check result', {
            filePath,
            dailyNotesFolder,
            fileName,
            isInDailyFolder,
            matchesPattern,
            isDaily: isInDailyFolder && matchesPattern
        });

        return isInDailyFolder && matchesPattern;
    }
} 