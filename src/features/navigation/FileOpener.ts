import { App, TFile, WorkspaceLeaf } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { CommonHelpers } from '../shared-utilities/CommonHelpers';

/**
 * File Opener for Navigation Slice
 * 
 * Handles opening files in different tabs and positions
 * for the vertical slice architecture.
 */
export class FileOpener {
    private app: App;
    private logger: Logger;

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('FileOpener');
        
        this.logger.debug('FileOpener initialized');
    }

    /**
     * Open a file in the current tab or new tab
     */
    async openFile(path: string, openInNewTab: boolean = false, line?: number): Promise<void> {
        this.logger.debug('Opening file', { path, openInNewTab, line });
        
        try {
            // Validate the path
            if (!this.isValidPath(path)) {
                throw new Error(`Invalid file path: ${path}`);
            }
            
            // Get the file
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            
            if (!(file instanceof TFile)) {
                throw new Error(`Path is not a file: ${path}`);
            }
            
            // Open the file
            if (openInNewTab) {
                await this.openFileInNewTab(file, line);
            } else {
                await this.openFileInCurrentTab(file, line);
            }
            
            this.logger.debug('File opened successfully', { path, openInNewTab, line });
        } catch (error) {
            this.logger.error('Failed to open file', { path, openInNewTab, line, error });
            throw error;
        }
    }

    /**
     * Open a file in a new tab
     */
    async openFileInNewTab(file: TFile, line?: number): Promise<void> {
        this.logger.debug('Opening file in new tab', { path: file.path, line });
        
        try {
            // Create a new leaf
            const leaf = this.app.workspace.getLeaf(true);
            
            // Open the file in the new leaf
            await leaf.openFile(file);
            
            // Navigate to specific line if provided
            if (line !== undefined) {
                await this.navigateToLine(leaf, line);
            }
            
            this.logger.debug('File opened in new tab successfully', { path: file.path, line });
        } catch (error) {
            this.logger.error('Failed to open file in new tab', { path: file.path, line, error });
            throw error;
        }
    }

    /**
     * Open a file in the current tab
     */
    async openFileInCurrentTab(file: TFile, line?: number): Promise<void> {
        this.logger.debug('Opening file in current tab', { path: file.path, line });
        
        try {
            // Get the active leaf
            const activeLeaf = this.app.workspace.activeLeaf;
            
            if (activeLeaf) {
                // Open file in active leaf
                await activeLeaf.openFile(file);
                
                // Navigate to specific line if provided
                if (line !== undefined) {
                    await this.navigateToLine(activeLeaf, line);
                }
            } else {
                // No active leaf, create a new one
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                
                // Navigate to specific line if provided
                if (line !== undefined) {
                    await this.navigateToLine(leaf, line);
                }
            }
            
            this.logger.debug('File opened in current tab successfully', { path: file.path, line });
        } catch (error) {
            this.logger.error('Failed to open file in current tab', { path: file.path, line, error });
            throw error;
        }
    }

    /**
     * Open a file in a specific position
     */
    async openFileInPosition(file: TFile, position: 'left' | 'right' | 'center'): Promise<void> {
        this.logger.debug('Opening file in position', { path: file.path, position });
        
        try {
            let leaf: WorkspaceLeaf;
            
            switch (position) {
                case 'left':
                    leaf = this.app.workspace.getLeftLeaf(false) || this.app.workspace.getLeaf(false);
                    break;
                case 'right':
                    leaf = this.app.workspace.getRightLeaf(false) || this.app.workspace.getLeaf(false);
                    break;
                case 'center':
                default:
                    leaf = this.app.workspace.getLeaf(false);
                    break;
            }
            
            await leaf.openFile(file);
            
            this.logger.debug('File opened in position successfully', { path: file.path, position });
        } catch (error) {
            this.logger.error('Failed to open file in position', { path: file.path, position, error });
            throw error;
        }
    }

    /**
     * Check if a file exists
     */
    fileExists(path: string): boolean {
        this.logger.debug('Checking if file exists', { path });
        
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            const exists = file !== null && file instanceof TFile;
            
            this.logger.debug('File existence check completed', { path, exists });
            return exists;
        } catch (error) {
            this.logger.error('Failed to check file existence', { path, error });
            return false;
        }
    }

    /**
     * Get file information
     */
    getFileInfo(path: string): {
        exists: boolean;
        isFile: boolean;
        size?: number;
        modified?: Date;
    } {
        this.logger.debug('Getting file info', { path });
        
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            
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
            this.logger.error('Failed to get file info', { path, error });
            return { exists: false, isFile: false };
        }
    }

    /**
     * Get statistics about file operations
     */
    getStatistics(): {
        openFilesCount: number;
        activeFiles: string[];
        workspaceLeavesCount: number;
    } {
        const openFiles = this.app.workspace.getLeavesOfType('markdown');
        const activeFiles = openFiles
            .filter(leaf => (leaf.view as any).file)
            .map(leaf => (leaf.view as any).file?.path)
            .filter((path): path is string => Boolean(path));
        
        return {
            openFilesCount: openFiles.length,
            activeFiles: [...new Set(activeFiles)], // Remove duplicates
            workspaceLeavesCount: this.app.workspace.getLeavesOfType('markdown').length
        };
    }

    /**
     * Cleanup resources used by this file opener
     */
    cleanup(): void {
        this.logger.debug('Cleaning up FileOpener');
        
        // No specific cleanup needed for this component currently
        
        this.logger.debug('FileOpener cleanup completed');
    }

    /**
     * Validate a file path
     */
    private isValidPath(path: string): boolean {
        // Basic validation
        return Boolean(path &&
            path.length > 0 &&
            !path.includes('<') &&
            !path.includes('>') &&
            !path.includes('|') &&
            !path.includes('?') &&
            !path.includes('*'));
    }

    /**
     * Navigate to a specific line in a file
     */
    private async navigateToLine(leaf: WorkspaceLeaf, line: number): Promise<void> {
        this.logger.debug('Navigating to line', { line });
        
        try {
            // Get the editor view (cast to MarkdownView for editor access)
            const editor = (leaf.view as any).editor;
            
            if (editor) {
                // Convert line number to position (0-indexed)
                const lineIndex = Math.max(0, line - 1);
                
                // Get the line's start position
                const lineStart = editor.offsetToPos({ line: lineIndex, ch: 0 });
                
                // Set cursor position
                editor.setCursor(lineStart);
                
                // Scroll to cursor
                editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
                
                this.logger.debug('Navigated to line successfully', { line });
            } else {
                this.logger.warn('No editor available for line navigation', { line });
            }
        } catch (error) {
            this.logger.error('Failed to navigate to line', { line, error });
            // Don't throw error for line navigation failure
        }
    }
}

// Export the interface for external use
export interface IFileOpener {
    openFile(path: string, openInNewTab?: boolean, line?: number): Promise<void>;
    openFileInNewTab(file: TFile, line?: number): Promise<void>;
    openFileInCurrentTab(file: TFile, line?: number): Promise<void>;
    openFileInPosition(file: TFile, position: 'left' | 'right' | 'center'): Promise<void>;
    fileExists(path: string): boolean;
    getFileInfo(path: string): {
        exists: boolean;
        isFile: boolean;
        size?: number;
        modified?: Date;
    };
}