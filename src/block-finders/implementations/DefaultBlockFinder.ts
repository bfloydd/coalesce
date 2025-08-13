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
        this.logger.debug('Determining block boundary', {
            noteName,
            matchIndex: match.index,
            matchText: match[0]
        });

        this.validateMatchIndex(match);

        const lineStartIndex = this.findLineStart(content, match.index!);
        const endIndex = this.findEndMarker(content, match.index!);
        const nextMentionIndex = this.findNextMention(content, match.index!, noteName);

        const boundary = {
            start: lineStartIndex,
            end: this.determineEndIndex(endIndex, nextMentionIndex, content.length)
        };

        this.logger.debug('Block boundary determined', {
            lineStartIndex,
            endIndex,
            nextMentionIndex,
            boundary,
            contentLength: content.length
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

    private findEndMarker(content: string, matchIndex: number): number {
        let searchIndex = matchIndex;
        
        while (true) {
            const dashIndex = content.indexOf('---', searchIndex);
            if (dashIndex === -1) {
                return -1; // No more "---" found
            }
            
            // Check if this "---" is actually a horizontal rule (not a table separator)
            if (this.isHorizontalRule(content, dashIndex)) {
                return dashIndex;
            }
            
            // Continue searching after this "---"
            searchIndex = dashIndex + 3;
        }
    }
    
    private isHorizontalRule(content: string, dashIndex: number): boolean {
        // Find the start and end of the line containing the "---"
        const lineStart = content.lastIndexOf('\n', dashIndex) + 1;
        const lineEnd = content.indexOf('\n', dashIndex);
        const lineEndIndex = lineEnd === -1 ? content.length : lineEnd;
        
        // Get the full line content
        const line = content.substring(lineStart, lineEndIndex);
        
        // Check if this line looks like a table separator row
        // Table separator rows typically have pipes and dashes like: | --- | --- |
        if (line.includes('|')) {
            return false; // Likely a table separator, not an HR
        }
        
        // Check if the line is a proper horizontal rule
        // HR should be mostly dashes with optional leading/trailing whitespace
        const trimmedLine = line.trim();
        
        // Valid horizontal rule patterns: ---, ----, -----, etc. (3 or more dashes)
        // Can also be ***, ___, etc. but we're specifically looking for dashes here
        return /^-{3,}$/.test(trimmedLine);
    }

    private findNextMention(content: string, matchIndex: number, noteName: string): number {
        return content.indexOf(`[[${noteName}]]`, matchIndex + 1);
    }

    protected isValidBlock(content: string, boundary: BlockBoundary): boolean {
        this.logger.debug('Validating block', {
            boundary,
            blockLength: boundary.end - boundary.start
        });
        return true; // Default finder accepts all blocks
    }

    private determineEndIndex(endIndex: number, nextMentionIndex: number, contentLength: number): number {
        this.logger.debug('Determining end index', {
            endIndex,
            nextMentionIndex,
            contentLength
        });

        let finalEndIndex: number;
        
        if (this.isEndMarkerValid(endIndex, nextMentionIndex)) {
            finalEndIndex = endIndex;
        } else {
            finalEndIndex = this.fallbackEndIndex(nextMentionIndex, contentLength);
        }

        this.logger.debug('End index determined', {
            endIndex,
            nextMentionIndex,
            contentLength,
            finalEndIndex
        });

        return finalEndIndex;
    }
    
    private isEndMarkerValid(endIndex: number, nextMentionIndex: number): boolean {
        return endIndex !== -1 && (nextMentionIndex === -1 || endIndex < nextMentionIndex);
    }
    
    private fallbackEndIndex(nextMentionIndex: number, contentLength: number): number {
        return nextMentionIndex !== -1 ? nextMentionIndex : contentLength;
    }
} 