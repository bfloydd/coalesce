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

        this.validateMatchIndex(match);

        const lineStartIndex = this.findLineStart(content, match.index!);
        const lineEndIndex = this.findLineEnd(content, match.index!);
        
        const boundary = {
            start: lineStartIndex,
            end: this.calculateEndIndex(lineEndIndex, content.length)
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

    private validateMatchIndex(match: RegExpMatchArray): void {
        if (match.index === undefined) {
            this.logger.error('Match index is undefined');
            throw new Error('Match index is undefined');
        }
    }

    private findLineStart(content: string, matchIndex: number): number {
        return content.lastIndexOf('\n', matchIndex) + 1;
    }

    private findLineEnd(content: string, matchIndex: number): number {
        return content.indexOf('\n', matchIndex);
    }

    private calculateEndIndex(lineEndIndex: number, contentLength: number): number {
        return lineEndIndex === -1 ? contentLength : lineEndIndex;
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        this.logger.debug('Validating top line block', {
            boundary,
            blockLength: boundary.end - boundary.start
        });
        return true; // Top line finder accepts all blocks
    }
} 