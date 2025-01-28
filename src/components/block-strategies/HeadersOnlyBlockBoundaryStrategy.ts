import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { Logger } from '../../utils/Logger';

export class HeadersOnlyBlockBoundaryStrategy implements BlockBoundaryStrategy {
    constructor(private logger: Logger) { }

    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        this.logger.debug('Finding header boundaries for:', currentNoteName);
        this.logger.debug('Content:', content);
        
        const boundaries: { start: number, end: number }[] = [];
        const escapedNoteName = currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`, 'g');
        
        // First, find all header line positions in the content
        const lines = content.split('\n');
        const headerLines = new Set<number>();
        let currentPos = 0;
        
        for (const line of lines) {
            if (/^#{1,5}\s/.test(line)) {
                headerLines.add(currentPos);
            }
            currentPos += line.length + 1; // +1 for newline
        }
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            this.logger.debug('Found match:', match[0]);

            const blockStartIndex = content.lastIndexOf('\n', match.index) + 1;
            const endIndex = content.indexOf('---', match.index);
            const nextMentionIndex = content.indexOf(`[[${currentNoteName}]]`, match.index + 1);

            let blockEndIndex = content.length;
            if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
                blockEndIndex = endIndex;
            } else if (nextMentionIndex !== -1) {
                blockEndIndex = nextMentionIndex;
            }

            // Only add block if it contains at least one header
            const blockContent = content.substring(blockStartIndex, blockEndIndex);
            if (blockContent.split('\n').some(line => /^#{1,5}\s/.test(line))) {
                boundaries.push({ start: blockStartIndex, end: blockEndIndex });
            }
        }

        return boundaries;
    }
}
