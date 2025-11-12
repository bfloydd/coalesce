// ============================
// Note Editing Slice Types
// ============================

import { App, TFile } from 'obsidian';

// ============================
// Content Editor Interface
// ============================

export interface IContentEditor {
    /**
     * Read content from a file
     */
    readFile(filePath: string): Promise<string>;
    
    /**
     * Write content to a file
     */
    writeFile(filePath: string, content: string): Promise<void>;
    
    /**
     * Insert content at a specific line
     */
    insertContentAtLine(filePath: string, line: number, content: string): Promise<void>;
    
    /**
     * Append content to a file
     */
    appendContent(filePath: string, content: string): Promise<void>;
    
    /**
     * Prepend content to a file
     */
    prependContent(filePath: string, content: string): Promise<void>;
    
    /**
     * Get file statistics
     */
    getFileStats(filePath: string): Promise<{
        lineCount: number;
        wordCount: number;
        characterCount: number;
    }>;
}

// ============================
// Heading Manager Interface
// ============================

export interface IHeadingManager {
    /**
     * Validate heading content
     */
    validateHeading(heading: string): boolean;
    
    /**
     * Format heading with proper markdown syntax
     */
    formatHeading(heading: string, level: number): string;
    
    /**
     * Extract headings from content
     */
    extractHeadings(content: string): Array<{
        text: string;
        level: number;
        line: number;
    }>;
    
    /**
     * Find the best insertion point for a new heading
     */
    findHeadingInsertionPoint(content: string, targetLevel: number): number;
    
    /**
     * Check if heading already exists in content
     */
    headingExists(content: string, heading: string): boolean;
    
    /**
     * Generate unique heading if duplicate exists
     */
    generateUniqueHeading(content: string, baseHeading: string): string;
}

// ============================
// File Modifier Interface
// ============================

export interface IFileModifier {
    /**
     * Create a backup of a file before modification
     */
    createBackup(filePath: string): Promise<string>;
    
    /**
     * Restore a file from backup
     */
    restoreFromBackup(filePath: string, backupPath: string): Promise<void>;
    
    /**
     * Safely modify a file with validation
     */
    safeModifyFile(
        filePath: string, 
        modifier: (content: string) => string,
        options?: {
            createBackup?: boolean;
            validateContent?: boolean;
        }
    ): Promise<boolean>;
    
    /**
     * Validate file content after modification
     */
    validateModifiedContent(content: string): {
        isValid: boolean;
        errors: string[];
    };
    
    /**
     * Get modification history
     */
    getModificationHistory(filePath: string): Array<{
        timestamp: Date;
        operation: string;
        success: boolean;
    }>;
}

// ============================
// Heading Popup Component Interface
// ============================

export interface IHeadingPopupComponent {
    /**
     * Show the heading popup
     */
    show(options: {
        filePath: string;
        onHeadingAdded?: (heading: string) => void;
        initialText?: string;
    }): void;
    
    /**
     * Hide the heading popup
     */
    hide(): void;
    
    /**
     * Check if popup is visible
     */
    isVisible(): boolean;
    
    /**
     * Focus the input field
     */
    focusInput(): void;
    
    /**
     * Get current input value
     */
    getInputValue(): string;
    
    /**
     * Set input value
     */
    setInputValue(value: string): void;
}

// ============================
// Note Editing Options
// ============================

export interface NoteEditingOptions {
    createBackup: boolean;
    validateContent: boolean;
    headingLevel: number;
    checkDuplicates: boolean;
    autoSave: boolean;
}

// ============================
// Heading Validation Result
// ============================

export interface HeadingValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

// ============================
// File Modification Result
// ============================

export interface FileModificationResult {
    success: boolean;
    filePath: string;
    backupPath?: string;
    errors: string[];
    warnings: string[];
    timestamp: Date;
}

// ============================
// Note Editing Statistics
// ============================

export interface NoteEditingStatistics {
    totalModifications: number;
    successfulModifications: number;
    failedModifications: number;
    headingsAdded: number;
    filesModified: number;
    backupsCreated: number;
    lastModification?: Date;
}