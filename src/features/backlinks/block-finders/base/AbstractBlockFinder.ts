import { Logger } from '../../../shared-utilities/Logger';
import { BlockBoundary } from '../types/BlockBoundary';

export abstract class AbstractBlockFinder {
    constructor(protected logger: Logger) {}

    // Template method that defines the algorithm structure
    findBlockBoundaries(content: string, noteName: string): BlockBoundary[] {
        this.logger.debug('Finding block boundaries:', { noteName, contentLength: content.length });

        const boundaries: BlockBoundary[] = [];
        const matches = this.findNoteReferences(content, noteName);

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

    protected findNoteReferences(content: string, noteName: string): RegExpMatchArray[] {
        // Check multiple possible reference patterns
        const patterns = this.generateReferencePatterns(noteName);
        const allMatches: RegExpMatchArray[] = [];

        for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'g');
            const matches = Array.from(content.matchAll(regex));
            allMatches.push(...matches);
        }

        // Remove duplicates based on index
        const uniqueMatches = allMatches.filter((match, index, self) =>
            index === self.findIndex(m => m.index === match.index)
        );

        this.logger.debug('Finding note references', {
            noteName,
            patterns,
            contentLength: content.length,
            matchCount: uniqueMatches.length,
            matches: uniqueMatches.map(m => ({ index: m.index, text: m[0] }))
        });

        return uniqueMatches;
    }

    private generateReferencePatterns(noteName: string): string[] {
        const escapedNoteName = this.escapeRegExp(noteName);
        const patterns: string[] = [];

        // If noteName includes path, extract basename
        const pathParts = noteName.split('/');
        const basename = pathParts[pathParts.length - 1].replace(/\.md$/, '');
        const escapedBasename = this.escapeRegExp(basename);

        // Pattern 1: Full path with extension
        patterns.push(`\\[\\[([^\\]]*\\/)*${escapedNoteName}(\\|[^\\]]*)?\\]\\]`);

        // Pattern 2: Full path without extension
        if (noteName.endsWith('.md')) {
            const withoutExt = noteName.slice(0, -3);
            const escapedWithoutExt = this.escapeRegExp(withoutExt);
            patterns.push(`\\[\\[([^\\]]*\\/)*${escapedWithoutExt}(\\|[^\\]]*)?\\]\\]`);
        }

        // Pattern 3: Just basename
        patterns.push(`\\[\\[([^\\]]*\\/)*${escapedBasename}(\\|[^\\]]*)?\\]\\]`);

        // Pattern 4: Basename with extension (in case someone links with .md)
        patterns.push(`\\[\\[([^\\]]*\\/)*${escapedBasename}\\.md(\\|[^\\]]*)?\\]\\]`);

        return patterns;
    }

    // Abstract methods that must be implemented by concrete classes
    protected abstract determineBlockBoundary(
        content: string, 
        match: RegExpMatchArray, 
        noteName: string
    ): BlockBoundary;

    protected abstract isValidBlock(content: string, boundary: BlockBoundary): boolean;
} 