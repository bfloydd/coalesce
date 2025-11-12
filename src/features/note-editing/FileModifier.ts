import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IFileModifier, FileModificationResult } from './types';
import { IContentEditor } from './types';
import { ContentEditor } from './ContentEditor';

/**
 * File Modifier for Note Editing Slice
 * 
 * Handles safe file modification with backup and validation
 * for the vertical slice architecture.
 */
export class FileModifier implements IFileModifier {
    private app: App;
    private logger: Logger;
    private contentEditor: IContentEditor;
    private modificationHistory: Map<string, Array<{
        timestamp: Date;
        operation: string;
        success: boolean;
    }>> = new Map();

    constructor(app: App, logger: Logger, contentEditor: ContentEditor) {
        this.app = app;
        this.logger = logger.child('FileModifier');
        this.contentEditor = contentEditor;
        
        this.logger.debug('FileModifier initialized');
    }

    /**
     * Create a backup of a file before modification
     */
    async createBackup(filePath: string): Promise<string> {
        this.logger.debug('Creating backup', { filePath });
        
        try {
            // Generate backup path
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}.coalesce-backup-${timestamp}`;
            
            // Read the original file
            const content = await this.contentEditor.readFile(filePath);
            
            // Create the backup file
            const backupFile = await this.app.vault.create(backupPath, content);
            
            this.logger.debug('Backup created successfully', { 
                filePath, 
                backupPath, 
                contentLength: content.length 
            });
            
            return backupPath;
        } catch (error) {
            this.logger.error('Failed to create backup', { filePath, error });
            throw error;
        }
    }

    /**
     * Restore a file from backup
     */
    async restoreFromBackup(filePath: string, backupPath: string): Promise<void> {
        this.logger.debug('Restoring from backup', { filePath, backupPath });
        
        try {
            // Read the backup content
            const backupContent = await this.contentEditor.readFile(backupPath);
            
            // Write to the original file
            await this.contentEditor.writeFile(filePath, backupContent);
            
            this.logger.debug('File restored from backup successfully', { 
                filePath, 
                backupPath, 
                contentLength: backupContent.length 
            });
        } catch (error) {
            this.logger.error('Failed to restore from backup', { filePath, backupPath, error });
            throw error;
        }
    }

    /**
     * Safely modify a file with validation
     */
    async safeModifyFile(
        filePath: string, 
        modifier: (content: string) => string,
        options?: {
            createBackup?: boolean;
            validateContent?: boolean;
        }
    ): Promise<boolean> {
        this.logger.debug('Safely modifying file', { filePath, options });
        
        const createBackup = options?.createBackup !== false; // Default to true
        const validateContent = options?.validateContent !== false; // Default to true
        
        let backupPath: string | undefined;
        
        try {
            // Create backup if requested
            if (createBackup) {
                backupPath = await this.createBackup(filePath);
            }
            
            // Read the current content
            const currentContent = await this.contentEditor.readFile(filePath);
            
            // Apply the modifier
            const modifiedContent = modifier(currentContent);
            
            // Validate the modified content if requested
            if (validateContent) {
                const validation = this.validateModifiedContent(modifiedContent);
                if (!validation.isValid) {
                    this.logger.warn('Modified content validation failed', { 
                        filePath, 
                        errors: validation.errors 
                    });
                    
                    // Restore from backup if we created one
                    if (backupPath) {
                        await this.restoreFromBackup(filePath, backupPath);
                    }
                    
                    return false;
                }
            }
            
            // Write the modified content
            await this.contentEditor.writeFile(filePath, modifiedContent);
            
            // Record the modification in history
            this.recordModification(filePath, 'safeModifyFile', true);
            
            this.logger.debug('File safely modified successfully', { 
                filePath, 
                contentLength: modifiedContent.length,
                backupCreated: !!backupPath 
            });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to safely modify file', { filePath, error });
            
            // Record the failure in history
            this.recordModification(filePath, 'safeModifyFile', false);
            
            // Restore from backup if we created one
            if (backupPath) {
                try {
                    await this.restoreFromBackup(filePath, backupPath);
                    this.logger.debug('File restored from backup after modification failure', { filePath });
                } catch (restoreError) {
                    this.logger.error('Failed to restore from backup after modification failure', { 
                        filePath, 
                        backupPath, 
                        restoreError 
                    });
                }
            }
            
            throw error;
        }
    }

    /**
     * Validate file content after modification
     */
    validateModifiedContent(content: string): {
        isValid: boolean;
        errors: string[];
    } {
        this.logger.debug('Validating modified content', { contentLength: content.length });
        
        const result = {
            isValid: true,
            errors: [] as string[]
        };
        
        try {
            // Check if content is empty
            if (!content || content.trim().length === 0) {
                result.isValid = false;
                result.errors.push('Content is empty');
            }
            
            // Check for basic markdown structure
            const lines = content.split('\n');
            
            // Check for lines that are too long
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > 10000) {
                    result.isValid = false;
                    result.errors.push(`Line ${i + 1} is too long (${lines[i].length} characters)`);
                }
            }
            
            // Check for potential encoding issues
            if (content.includes('\u0000')) {
                result.isValid = false;
                result.errors.push('Content contains null characters');
            }
            
            this.logger.debug('Content validation completed', { 
                contentLength: content.length, 
                isValid: result.isValid, 
                errorCount: result.errors.length 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to validate modified content', { error });
            
            result.isValid = false;
            result.errors.push('Validation failed due to error');
            
            return result;
        }
    }

    /**
     * Get modification history
     */
    getModificationHistory(filePath: string): Array<{
        timestamp: Date;
        operation: string;
        success: boolean;
    }> {
        this.logger.debug('Getting modification history', { filePath });
        
        const history = this.modificationHistory.get(filePath) || [];
        
        this.logger.debug('Modification history retrieved', { 
            filePath, 
            historySize: history.length 
        });
        
        return [...history]; // Return a copy
    }

    /**
     * Clear modification history for a file
     */
    clearModificationHistory(filePath: string): void {
        this.logger.debug('Clearing modification history', { filePath });
        
        this.modificationHistory.delete(filePath);
        
        this.logger.debug('Modification history cleared', { filePath });
    }

    /**
     * Get all backup files for a given file
     */
    async getBackupFiles(filePath: string): Promise<string[]> {
        this.logger.debug('Getting backup files', { filePath });
        
        try {
            // Get all files in the vault
            const allFiles = this.app.vault.getFiles();
            
            // Filter for backup files of the given file
            const backupFiles = allFiles
                .filter(file => file.path.includes(`${filePath}.coalesce-backup-`))
                .map(file => file.path)
                .sort(); // Sort by timestamp (newest last)
            
            this.logger.debug('Backup files retrieved', { 
                filePath, 
                backupCount: backupFiles.length 
            });
            
            return backupFiles;
        } catch (error) {
            this.logger.error('Failed to get backup files', { filePath, error });
            return [];
        }
    }

    /**
     * Clean up old backup files
     */
    async cleanupOldBackups(filePath: string, keepCount: number = 5): Promise<void> {
        this.logger.debug('Cleaning up old backups', { filePath, keepCount });
        
        try {
            const backupFiles = await this.getBackupFiles(filePath);
            
            // If we have more backups than we want to keep, delete the oldest ones
            if (backupFiles.length > keepCount) {
                const filesToDelete = backupFiles.slice(0, backupFiles.length - keepCount);
                
                for (const backupPath of filesToDelete) {
                    const file = this.app.vault.getAbstractFileByPath(backupPath);
                    if (file) {
                        await this.app.vault.delete(file);
                        this.logger.debug('Deleted old backup', { backupPath });
                    }
                }
                
                this.logger.debug('Old backups cleaned up', { 
                    filePath, 
                    deletedCount: filesToDelete.length,
                    remainingCount: backupFiles.length - filesToDelete.length
                });
            }
        } catch (error) {
            this.logger.error('Failed to cleanup old backups', { filePath, error });
        }
    }

    /**
     * Record a modification in history
     */
    private recordModification(filePath: string, operation: string, success: boolean): void {
        this.logger.debug('Recording modification', { filePath, operation, success });
        
        // Get existing history or create new one
        const history = this.modificationHistory.get(filePath) || [];
        
        // Add the new modification
        history.push({
            timestamp: new Date(),
            operation,
            success
        });
        
        // Keep only the last 50 modifications
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
        
        // Update the history
        this.modificationHistory.set(filePath, history);
        
        this.logger.debug('Modification recorded', { 
            filePath, 
            operation, 
            success, 
            historySize: history.length 
        });
    }

    /**
     * Get statistics about file modification operations
     */
    getStatistics(): {
        totalModifications: number;
        successfulModifications: number;
        failedModifications: number;
        filesModified: number;
        backupsCreated: number;
    } {
        let totalModifications = 0;
        let successfulModifications = 0;
        let failedModifications = 0;
        
        // Calculate statistics from history
        for (const [filePath, history] of this.modificationHistory.entries()) {
            for (const modification of history) {
                totalModifications++;
                if (modification.success) {
                    successfulModifications++;
                } else {
                    failedModifications++;
                }
            }
        }
        
        return {
            totalModifications,
            successfulModifications,
            failedModifications,
            filesModified: this.modificationHistory.size,
            backupsCreated: 0 // This would need actual tracking in a real implementation
        };
    }

    /**
     * Cleanup resources used by this file modifier
     */
    cleanup(): void {
        this.logger.debug('Cleaning up FileModifier');
        
        // Clear modification history
        this.modificationHistory.clear();
        
        this.logger.debug('FileModifier cleanup completed');
    }
}