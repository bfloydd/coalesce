import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { Logger } from './Logger';

export class SingleLineBlockBoundaryStrategy implements BlockBoundaryStrategy {
    constructor(private logger: Logger) { }

    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        this.logger.debug('Finding block boundaries for:', currentNoteName);
        this.logger.debug('Content:', content);
        
        const boundaries: { start: number, end: number }[] = [];
        const lines = content.split('\n');

        if (lines.length > 0) {
            const firstLine = lines[0];
            boundaries.push({ start: 0, end: firstLine.length });
        }

        return boundaries;
    }
}
