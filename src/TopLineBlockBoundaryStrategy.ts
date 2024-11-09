import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';

export class TopLineBlockBoundaryStrategy implements BlockBoundaryStrategy {
    constructor(private logger: Console = console) {}

    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        this.logger.debug('Finding block boundaries for:', currentNoteName);
        this.logger.debug('Content:', content);
        
        const boundaries: { start: number, end: number }[] = [];
        const escapedNoteName = currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`, 'g');

        let match;
        while ((match = regex.exec(content)) !== null) {
            const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
            const lineEndIndex = content.indexOf('\n', match.index);
            
            // If no newline found after match, use end of content
            const endIndex = lineEndIndex === -1 ? content.length : lineEndIndex;
            
            boundaries.push({ start: lineStartIndex, end: endIndex });
        }

        return boundaries;
    }
}
