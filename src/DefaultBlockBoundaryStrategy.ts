import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { Logger } from './Logger';

export class DefaultBlockBoundaryStrategy implements BlockBoundaryStrategy {
    constructor(private logger: Logger) {}

    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        this.logger.debug('Finding block boundaries for:', currentNoteName);
        this.logger.debug('Content:', content);

        const boundaries: { start: number, end: number }[] = [];
        const escapedNoteName = currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`, 'g');
        
        /*
        [[currentNoteName]]
        [[Full/Path/currentNoteName]]
        [[Full/Path/currentNoteName|shortname]] 
        */

        this.logger.debug('Escaped note name:', escapedNoteName);
        this.logger.debug('Regex pattern:', regex.source);

        let match;
        while ((match = regex.exec(content)) !== null) {
            this.logger.debug('Found match:', match[0]);

            const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
            const endIndex = content.indexOf('---', match.index);
            const nextMentionIndex = content.indexOf(`[[${currentNoteName}]]`, match.index + 1);

            let blockEndIndex = content.length;
            if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
                blockEndIndex = endIndex;
            } else if (nextMentionIndex !== -1) {
                blockEndIndex = nextMentionIndex;
            }

            boundaries.push({ start: lineStartIndex, end: blockEndIndex });
        }

        return boundaries;
    }
}
