export class DailyNote {
    static isDaily(app: any, filePath: string): boolean {
        const dailyNotesPlugin = app.internalPlugins.plugins['daily-notes'];
        if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
            return false;
        }

        const dailyNotesFolder = dailyNotesPlugin.instance.options.folder || '';
        const dailyNotePattern = /^\d{4}-\d{2}-\d{2}\.md$/;

        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];

        return filePath.startsWith(dailyNotesFolder) && dailyNotePattern.test(fileName);
    }
} 