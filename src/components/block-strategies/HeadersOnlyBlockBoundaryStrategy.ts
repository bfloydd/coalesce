import { BlockBoundaryStrategy } from './BlockBoundaryStrategy';
import { Logger } from '../../utils/Logger';

export class HeadersOnlyBlockBoundaryStrategy implements BlockBoundaryStrategy {
    constructor(private logger: Logger) { }

    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[] {
        this.logger.debug('Finding header boundaries for:', currentNoteName);
        this.logger.debug('Content:', content);
        
        const boundaries: { start: number, end: number }[] = [];
        const lines = content.split('\n');
        let currentPosition = 0;

        for (const line of lines) {
            // Check if line starts with 1-5 hash symbols followed by a space
            if (/^#{1,5}\s/.test(line)) {
                boundaries.push({
                    start: currentPosition,
                    end: currentPosition + line.length
                });
            }
            // Add +1 for the newline character
            currentPosition += line.length + 1;
        }

        return boundaries;
    }
}
