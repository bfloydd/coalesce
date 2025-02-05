import { AbstractBlockFinder } from '../base/AbstractBlockFinder';
import { BlockBoundary } from '../types/BlockBoundary';
import { Logger } from '../../utils/Logger';

export class DefaultBlockFinder extends AbstractBlockFinder {
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
        const endIndex = content.indexOf('---', match.index);
        const nextMentionIndex = content.indexOf(`[[${noteName}]]`, match.index + 1);

        return {
            start: lineStartIndex,
            end: this.determineEndIndex(endIndex, nextMentionIndex, content.length)
        };
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        return true; // Default finder accepts all blocks
    }

    private determineEndIndex(endIndex: number, nextMentionIndex: number, contentLength: number): number {
        if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
            return endIndex;
        }
        return nextMentionIndex !== -1 ? nextMentionIndex : contentLength;
    }
} 