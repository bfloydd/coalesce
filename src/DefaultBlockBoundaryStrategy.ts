import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';

export class DefaultBlockBoundaryStrategy implements BlockBoundaryStrategy {
    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        const boundaries: { start: number, end: number }[] = [];
        const escapedNoteName = currentNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`, 'g');
        
        /*
        [[currentNoteName]]
        [[Full/Path/currentNoteName]]
        [[Full/Path/currentNoteName|shortname]] 
        console.log('Escaped note name:', escapedNoteName);
        console.log('Regex pattern:', regex.source);
        */

        let match;
        while ((match = regex.exec(content)) !== null) {
            console.log('Found match:', match[0]);
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
