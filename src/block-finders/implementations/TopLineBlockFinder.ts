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
        this.logger.debug('Determining block boundary for top line', {
            noteName,
            matchIndex: match.index,
            matchText: match[0]
        });

        if (match.index === undefined) {
            this.logger.error('Match index is undefined');
            throw new Error('Match index is undefined');
        }

        const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
        const lineEndIndex = content.indexOf('\n', match.index);
        
        const boundary = {
            start: lineStartIndex,
            end: lineEndIndex === -1 ? content.length : lineEndIndex
        };

        this.logger.debug('Block boundary determined for top line', {
            lineStartIndex,
            lineEndIndex,
            boundary,
            contentLength: content.length,
            isLastLine: lineEndIndex === -1
        });
        
        return boundary;
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        this.logger.debug('Validating top line block', {
            boundary,
            blockLength: boundary.end - boundary.start
        });
        return true; // Top line finder accepts all blocks
    }
} 