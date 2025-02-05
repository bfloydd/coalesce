import { Logger } from '../../utils/Logger';
import { BlockBoundary } from '../types/BlockBoundary';

export abstract class AbstractBlockFinder {
    constructor(protected logger: Logger) {}

    // Template method that defines the algorithm structure
    findBlockBoundaries(content: string, noteName: string): BlockBoundary[] {
        this.logger.debug('Finding block boundaries for:', noteName);
        this.logger.debug('Content:', content);
        
        const boundaries: BlockBoundary[] = [];
        const escapedNoteName = this.escapeRegExp(noteName);
        const matches = this.findNoteReferences(content, escapedNoteName);
        
        for (const match of matches) {
            const boundary = this.determineBlockBoundary(content, match, noteName);
            if (this.isValidBlock(content, boundary)) {
                boundaries.push(boundary);
            }
        }
        
        return boundaries;
    }

    // Helper methods that can be used by all implementations
    protected escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    protected findNoteReferences(content: string, escapedNoteName: string): RegExpMatchArray[] {
        const regex = new RegExp(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`, 'g');
        return Array.from(content.matchAll(regex));
    }

    // Abstract methods that must be implemented by concrete classes
    protected abstract determineBlockBoundary(
        content: string, 
        match: RegExpMatchArray, 
        noteName: string
    ): BlockBoundary;

    protected abstract isValidBlock(content: string, boundary: BlockBoundary): boolean;
} 