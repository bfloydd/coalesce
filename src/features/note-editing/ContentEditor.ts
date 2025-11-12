import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IContentEditor } from './types';

/**
 * Content Editor for Note Editing Slice
 * 
 * Handles reading and writing file content
 * for the vertical slice architecture.
 */
export class ContentEditor implements IContentEditor {
    private app: App;
    private logger: Logger;

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('ContentEditor');
        
        this.logger.debug('ContentEditor initialized');
    }

    /**
     * Read content from a file
     */
    async readFile(filePath: string): Promise<string> {
        this.logger.debug('Reading file content', { filePath });
        
        try {
            // Get the file
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            if (!(file instanceof TFile)) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
            
            // Read the content
            const content = await this.app.vault.read(file);
            
            this.logger.debug('File content read successfully', { 
                filePath, 
                contentLength: content.length 
            });
            
            return content;
        } catch (error) {
            this.logger.error('Failed to read file content', { filePath, error });
            throw error;
        }
    }

    /**
     * Write content to a file
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        this.logger.debug('Writing file content', { filePath, contentLength: content.length });
        
        try {
            // Get the file
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            if (!(file instanceof TFile)) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
            
            // Write the content
            await this.app.vault.modify(file, content);
            
            this.logger.debug('File content written successfully', { 
                filePath, 
                contentLength: content.length 
            });
        } catch (error) {
            this.logger.error('Failed to write file content', { filePath, error });
            throw error;
        }
    }

    /**
     * Insert content at a specific line
     */
    async insertContentAtLine(filePath: string, line: number, content: string): Promise<void> {
        this.logger.debug('Inserting content at line', { filePath, line, contentLength: content.length });
        
        try {
            // Read the current content
            const currentContent = await this.readFile(filePath);
            
            // Split into lines
            const lines = currentContent.split('\n');
            
            // Insert the content at the specified line
            lines.splice(line, 0, content);
            
            // Join back into content
            const newContent = lines.join('\n');
            
            // Write the modified content
            await this.writeFile(filePath, newContent);
            
            this.logger.debug('Content inserted at line successfully', { 
                filePath, 
                line, 
                contentLength: content.length 
            });
        } catch (error) {
            this.logger.error('Failed to insert content at line', { filePath, line, error });
            throw error;
        }
    }

    /**
     * Append content to a file
     */
    async appendContent(filePath: string, content: string): Promise<void> {
        this.logger.debug('Appending content to file', { filePath, contentLength: content.length });
        
        try {
            // Read the current content
            const currentContent = await this.readFile(filePath);
            
            // Append the content
            const newContent = currentContent + '\n' + content;
            
            // Write the modified content
            await this.writeFile(filePath, newContent);
            
            this.logger.debug('Content appended successfully', { 
                filePath, 
                contentLength: content.length 
            });
        } catch (error) {
            this.logger.error('Failed to append content', { filePath, error });
            throw error;
        }
    }

    /**
     * Prepend content to a file
     */
    async prependContent(filePath: string, content: string): Promise<void> {
        this.logger.debug('Prepending content to file', { filePath, contentLength: content.length });
        
        try {
            // Read the current content
            const currentContent = await this.readFile(filePath);
            
            // Prepend the content
            const newContent = content + '\n' + currentContent;
            
            // Write the modified content
            await this.writeFile(filePath, newContent);
            
            this.logger.debug('Content prepended successfully', { 
                filePath, 
                contentLength: content.length 
            });
        } catch (error) {
            this.logger.error('Failed to prepend content', { filePath, error });
            throw error;
        }
    }

    /**
     * Get file statistics
     */
    async getFileStats(filePath: string): Promise<{
        lineCount: number;
        wordCount: number;
        characterCount: number;
    }> {
        this.logger.debug('Getting file statistics', { filePath });
        
        try {
            // Read the content
            const content = await this.readFile(filePath);
            
            // Calculate statistics
            const lineCount = content.split('\n').length;
            const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
            const characterCount = content.length;
            
            const stats = {
                lineCount,
                wordCount,
                characterCount
            };
            
            this.logger.debug('File statistics retrieved', { filePath, stats });
            
            return stats;
        } catch (error) {
            this.logger.error('Failed to get file statistics', { filePath, error });
            throw error;
        }
    }

    /**
     * Check if a file exists
     */
    fileExists(filePath: string): boolean {
        this.logger.debug('Checking if file exists', { filePath });
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            const exists = file !== null && file instanceof TFile;
            
            this.logger.debug('File existence check completed', { filePath, exists });
            
            return exists;
        } catch (error) {
            this.logger.error('Failed to check file existence', { filePath, error });
            return false;
        }
    }

    /**
     * Get file information
     */
    getFileInfo(filePath: string): {
        exists: boolean;
        isFile: boolean;
        size?: number;
        modified?: Date;
    } {
        this.logger.debug('Getting file information', { filePath });
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            
            if (!file) {
                return { exists: false, isFile: false };
            }
            
            const isFile = file instanceof TFile;
            
            if (!isFile) {
                return { exists: true, isFile: false };
            }
            
            const tFile = file as TFile;
            
            return {
                exists: true,
                isFile: true,
                size: tFile.stat.size,
                modified: new Date(tFile.stat.mtime)
            };
        } catch (error) {
            this.logger.error('Failed to get file information', { filePath, error });
            return { exists: false, isFile: false };
        }
    }

    /**
     * Get statistics about content operations
     */
    getStatistics(): {
        filesRead: number;
        filesWritten: number;
        totalCharactersRead: number;
        totalCharactersWritten: number;
    } {
        // This would need actual tracking in a real implementation
        // For now, return basic statistics
        return {
            filesRead: 0,
            filesWritten: 0,
            totalCharactersRead: 0,
            totalCharactersWritten: 0
        };
    }

    /**
     * Cleanup resources used by this content editor
     */
    cleanup(): void {
        this.logger.debug('Cleaning up ContentEditor');
        
        // No specific cleanup needed for this component currently
        
        this.logger.debug('ContentEditor cleanup completed');
    }
}