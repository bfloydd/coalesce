import { Logger } from '../shared-utilities/Logger';
import { IHeadingManager, HeadingValidationResult } from './types';

/**
 * Heading Manager for Note Editing Slice
 * 
 * Handles heading validation, formatting, and management
 * for the vertical slice architecture.
 */
export class HeadingManager implements IHeadingManager {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child('HeadingManager');
        
        this.logger.debug('HeadingManager initialized');
    }

    /**
     * Validate heading content
     */
    validateHeading(heading: string): boolean {
        this.logger.debug('Validating heading', { heading });
        
        try {
            // Check if heading is empty
            if (!heading || heading.trim().length === 0) {
                this.logger.debug('Heading validation failed: empty heading');
                return false;
            }
            
            // Check for invalid characters
            const invalidChars = ['\n', '\r', '\t'];
            for (const char of invalidChars) {
                if (heading.includes(char)) {
                    this.logger.debug('Heading validation failed: contains invalid character', { char });
                    return false;
                }
            }
            
            // Check if heading is too long
            if (heading.length > 200) {
                this.logger.debug('Heading validation failed: heading too long', { length: heading.length });
                return false;
            }
            
            this.logger.debug('Heading validation passed', { heading });
            return true;
        } catch (error) {
            this.logger.error('Failed to validate heading', { heading, error });
            return false;
        }
    }

    /**
     * Format heading with proper markdown syntax
     */
    formatHeading(heading: string, level: number): string {
        this.logger.debug('Formatting heading', { heading, level });
        
        try {
            // Validate level
            if (level < 1 || level > 6) {
                throw new Error(`Invalid heading level: ${level}. Must be between 1 and 6.`);
            }
            
            // Create the heading prefix
            const prefix = '#'.repeat(level);
            
            // Format the heading
            const formattedHeading = `${prefix} ${heading.trim()}`;
            
            this.logger.debug('Heading formatted successfully', { 
                originalHeading: heading, 
                level, 
                formattedHeading 
            });
            
            return formattedHeading;
        } catch (error) {
            this.logger.error('Failed to format heading', { heading, level, error });
            throw error;
        }
    }

    /**
     * Extract headings from content
     */
    extractHeadings(content: string): Array<{
        text: string;
        level: number;
        line: number;
    }> {
        this.logger.debug('Extracting headings from content', { contentLength: content.length });
        
        try {
            const headings: Array<{
                text: string;
                level: number;
                line: number;
            }> = [];
            
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Check if line starts with #
                if (line.startsWith('#')) {
                    // Count the number of #
                    const match = line.match(/^(#+)\s+(.+)$/);
                    
                    if (match) {
                        const level = match[1].length;
                        const text = match[2];
                        
                        headings.push({
                            text,
                            level,
                            line: i + 1 // 1-based line number
                        });
                    }
                }
            }
            
            this.logger.debug('Headings extracted successfully', { 
                contentLength: content.length, 
                headingCount: headings.length 
            });
            
            return headings;
        } catch (error) {
            this.logger.error('Failed to extract headings', { error });
            return [];
        }
    }

    /**
     * Find the best insertion point for a new heading
     */
    findHeadingInsertionPoint(content: string, targetLevel: number): number {
        this.logger.debug('Finding heading insertion point', { targetLevel });
        
        try {
            const headings = this.extractHeadings(content);
            
            // If no headings exist, insert at the beginning
            if (headings.length === 0) {
                this.logger.debug('No existing headings found, inserting at beginning');
                return 0;
            }
            
            // Find the best insertion point
            for (let i = 0; i < headings.length; i++) {
                const heading = headings[i];
                
                // If we find a heading at the same level or higher, insert before it
                if (heading.level >= targetLevel) {
                    this.logger.debug('Found insertion point', { 
                        line: heading.line, 
                        targetLevel, 
                        foundLevel: heading.level 
                    });
                    return heading.line - 1; // Convert to 0-based index
                }
            }
            
            // If no suitable insertion point found, insert at the end
            const insertionPoint = content.split('\n').length;
            this.logger.debug('No suitable insertion point found, inserting at end', { 
                insertionPoint 
            });
            
            return insertionPoint;
        } catch (error) {
            this.logger.error('Failed to find heading insertion point', { targetLevel, error });
            return 0;
        }
    }

    /**
     * Check if heading already exists in content
     */
    headingExists(content: string, heading: string): boolean {
        this.logger.debug('Checking if heading exists', { heading });
        
        try {
            const headings = this.extractHeadings(content);
            
            // Check for exact match (case-insensitive)
            const exists = headings.some(h => 
                h.text.toLowerCase() === heading.toLowerCase().trim()
            );
            
            this.logger.debug('Heading existence check completed', { 
                heading, 
                exists 
            });
            
            return exists;
        } catch (error) {
            this.logger.error('Failed to check heading existence', { heading, error });
            return false;
        }
    }

    /**
     * Generate unique heading if duplicate exists
     */
    generateUniqueHeading(content: string, baseHeading: string): string {
        this.logger.debug('Generating unique heading', { baseHeading });
        
        try {
            // If heading doesn't exist, return as-is
            if (!this.headingExists(content, baseHeading)) {
                this.logger.debug('Heading is unique, returning as-is', { baseHeading });
                return baseHeading;
            }
            
            // Generate unique heading
            let counter = 1;
            let uniqueHeading = `${baseHeading} (${counter})`;
            
            while (this.headingExists(content, uniqueHeading)) {
                counter++;
                uniqueHeading = `${baseHeading} (${counter})`;
            }
            
            this.logger.debug('Generated unique heading', { 
                baseHeading, 
                uniqueHeading, 
                counter 
            });
            
            return uniqueHeading;
        } catch (error) {
            this.logger.error('Failed to generate unique heading', { baseHeading, error });
            return baseHeading;
        }
    }

    /**
     * Comprehensive heading validation
     */
    validateHeadingComprehensive(heading: string, level: number): HeadingValidationResult {
        this.logger.debug('Comprehensive heading validation', { heading, level });
        
        const result: HeadingValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        
        try {
            // Basic validation
            if (!this.validateHeading(heading)) {
                result.isValid = false;
                result.errors.push('Heading is invalid');
            }
            
            // Level validation
            if (level < 1 || level > 6) {
                result.isValid = false;
                result.errors.push(`Invalid heading level: ${level}. Must be between 1 and 6.`);
            }
            
            // Length warnings
            if (heading.length > 100) {
                result.warnings.push('Heading is quite long, consider shortening it');
            }
            
            // Suggestions
            if (heading.length < 3) {
                result.suggestions.push('Consider using a more descriptive heading');
            }
            
            if (!heading.match(/^[A-Z]/)) {
                result.suggestions.push('Consider starting heading with capital letter');
            }
            
            this.logger.debug('Comprehensive heading validation completed', { 
                heading, 
                level, 
                result 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to validate heading comprehensively', { heading, level, error });
            
            result.isValid = false;
            result.errors.push('Validation failed due to error');
            
            return result;
        }
    }

    /**
     * Get statistics about heading operations
     */
    getStatistics(): {
        headingsValidated: number;
        headingsFormatted: number;
        headingsExtracted: number;
        uniqueHeadingsGenerated: number;
    } {
        // This would need actual tracking in a real implementation
        // For now, return basic statistics
        return {
            headingsValidated: 0,
            headingsFormatted: 0,
            headingsExtracted: 0,
            uniqueHeadingsGenerated: 0
        };
    }

    /**
     * Cleanup resources used by this heading manager
     */
    cleanup(): void {
        this.logger.debug('Cleaning up HeadingManager');
        
        // No specific cleanup needed for this component currently
        
        this.logger.debug('HeadingManager cleanup completed');
    }
}