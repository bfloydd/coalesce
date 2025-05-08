import { AbstractBlockFinder } from '../base/AbstractBlockFinder';
import { BlockBoundary } from '../types/BlockBoundary';
import { Logger } from '../../utils/Logger';

export class HeadersOnlyBlockFinder extends AbstractBlockFinder {
    constructor(logger: Logger) {
        super(logger);
    }

    protected determineBlockBoundary(
        content: string, 
        match: RegExpMatchArray, 
        noteName: string
    ): BlockBoundary {
        this.logger.debug('Determining block boundary for headers only', {
            noteName,
            matchIndex: match.index,
            matchText: match[0]
        });

        if (match.index === undefined) {
            this.logger.error('Match index is undefined');
            throw new Error('Match index is undefined');
        }

        const lineStartIndex = content.lastIndexOf('\n', match.index) + 1;
        const endIndex = content.indexOf('---', match.index);
        const nextMentionIndex = content.indexOf(`[[${noteName}]]`, match.index + 1);

        const boundary = {
            start: lineStartIndex,
            end: this.determineEndIndex(endIndex, nextMentionIndex, content.length)
        };

        this.logger.debug('Block boundary determined for headers only', {
            lineStartIndex,
            endIndex,
            nextMentionIndex,
            boundary,
            contentLength: content.length
        });

        return boundary;
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        const blockContent = content.substring(boundary.start, boundary.end);
        const lines = blockContent.split('\n');
        const hasHeader = lines.some(line => /^#{1,5}\s/.test(line));

        this.logger.debug('Validating headers only block', {
            boundary,
            blockLength: boundary.end - boundary.start,
            lineCount: lines.length,
            hasHeader
        });

        return hasHeader;
    }

    private determineEndIndex(endIndex: number, nextMentionIndex: number, contentLength: number): number {
        this.logger.debug('Determining end index for headers only', {
            endIndex,
            nextMentionIndex,
            contentLength
        });

        let finalEndIndex: number;
        if (endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex)) {
            finalEndIndex = endIndex;
        } else {
            finalEndIndex = nextMentionIndex !== -1 ? nextMentionIndex : contentLength;
        }

        this.logger.debug('End index determined for headers only', {
            endIndex,
            nextMentionIndex,
            contentLength,
            finalEndIndex
        });

        return finalEndIndex;
    }
} 