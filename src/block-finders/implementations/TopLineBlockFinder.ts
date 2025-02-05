import { AbstractBlockFinder } from '../base/AbstractBlockFinder';
import { BlockBoundary } from '../types/BlockBoundary';
import { Logger } from '../../utils/Logger';

export class TopLineBlockFinder extends AbstractBlockFinder {
    constructor(logger: Logger) {
        super(logger);
    }

    protected determineBlockBoundary(
        content: string, 
        match: RegExpMatchArray,
        noteName: string
    ): BlockBoundary {
        if (match.index === undefined) {
            throw new Error('Match index is undefined');
        }

        const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
        const lineEndIndex = content.indexOf('\n', match.index);
        
        return {
            start: lineStartIndex,
            end: lineEndIndex === -1 ? content.length : lineEndIndex
        };
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        return true; // Top line finder accepts all blocks
    }
} 