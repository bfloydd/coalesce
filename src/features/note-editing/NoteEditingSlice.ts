import { App } from 'obsidian';
import { INoteEditingSlice } from '../shared-contracts/slice-interfaces';
import { IPluginSlice, SliceDependencies } from '../../orchestrator/types';
import { ContentEditor } from './ContentEditor';
import { HeadingManager } from './HeadingManager';
import { FileModifier } from './FileModifier';
import { HeadingPopupComponent } from './HeadingPopupComponent';
import { Logger } from '../shared-utilities/Logger';
import { NoteEditingOptions, FileModificationResult, NoteEditingStatistics } from './types';
import { CoalesceEvent, EventHandler, NoteEditingHeadingAddedEvent } from '../shared-contracts/events';

/**
 * Note Editing Slice Implementation
 * 
 * This slice handles heading insertion, file modifications, and content validation
 * for the vertical slice architecture.
 */
export class NoteEditingSlice implements IPluginSlice, INoteEditingSlice {
    private app: App;
    private logger: Logger;
    private contentEditor: ContentEditor;
    private headingManager: HeadingManager;
    private fileModifier: FileModifier;
    private headingPopupComponent?: HeadingPopupComponent;
    private options: NoteEditingOptions;
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private statistics: NoteEditingStatistics = {
        totalModifications: 0,
        successfulModifications: 0,
        failedModifications: 0,
        headingsAdded: 0,
        filesModified: 0,
        backupsCreated: 0
    };

    constructor(app: App, options?: Partial<NoteEditingOptions>) {
        this.app = app;
        // Logger will be re-initialized in initialize() with shared utilities
        this.logger = new Logger('NoteEditingSlice');

        // Set default options
        this.options = {
            createBackup: true,
            validateContent: true,
            headingLevel: 2,
            checkDuplicates: true,
            autoSave: true,
            ...options
        };

        // Components will be initialized in initialize()
    }

    /**
     * Initialize the slice
     */
    async initialize(dependencies: SliceDependencies): Promise<void> {
        this.logger.debug('Initializing NoteEditingSlice');

        // Use shared logger if available
        if (dependencies.sharedUtilities?.getLogger) {
            this.logger = dependencies.sharedUtilities.getLogger('NoteEditingSlice');
        }

        // Initialize components
        this.contentEditor = new ContentEditor(this.app, this.logger);
        this.headingManager = new HeadingManager(this.logger);
        this.fileModifier = new FileModifier(this.app, this.logger, this.contentEditor);

        this.logger.debug('NoteEditingSlice initialized', { options: this.options });
    }

    /**
     * Start the slice
     */
    async start(): Promise<void> {
        this.logger.debug('Starting NoteEditingSlice');
        // Any startup logic here
    }

    /**
     * Stop the slice
     */
    async stop(): Promise<void> {
        this.logger.debug('Stopping NoteEditingSlice');
        // Any shutdown logic here
    }

    /**
     * Add a heading to a file
     */
    async addHeading(filePath: string, heading: string, options?: {
        level?: number;
        position?: 'top' | 'bottom' | 'auto';
        checkDuplicates?: boolean;
    }): Promise<FileModificationResult> {
        this.logger.debug('Adding heading to file', { filePath, heading, options });

        const result: FileModificationResult = {
            success: false,
            filePath,
            errors: [],
            warnings: [],
            timestamp: new Date()
        };

        try {
            // Validate the heading
            if (!this.headingManager.validateHeading(heading)) {
                result.errors.push('Invalid heading text');
                this.statistics.failedModifications++;
                return result;
            }

            // Set default options
            const headingLevel = options?.level ?? this.options.headingLevel;
            const checkDuplicates = options?.checkDuplicates ?? this.options.checkDuplicates;

            // Read the current content
            const currentContent = await this.contentEditor.readFile(filePath);

            // Check for duplicates if requested
            let finalHeading = heading;
            if (checkDuplicates && this.headingManager.headingExists(currentContent, heading)) {
                finalHeading = this.headingManager.generateUniqueHeading(currentContent, heading);
                result.warnings.push(`Heading already exists, using: ${finalHeading}`);
            }

            // Format the heading
            const formattedHeading = this.headingManager.formatHeading(finalHeading, headingLevel);

            // Determine insertion position
            let insertionLine = 0;
            if (options?.position === 'bottom') {
                insertionLine = currentContent.split('\n').length;
            } else if (options?.position === 'auto') {
                insertionLine = this.headingManager.findHeadingInsertionPoint(currentContent, headingLevel);
            }

            // Create backup if requested
            let backupPath: string | undefined;
            if (this.options.createBackup) {
                backupPath = await this.fileModifier.createBackup(filePath);
                result.backupPath = backupPath;
                this.statistics.backupsCreated++;
            }

            // Insert the heading
            await this.contentEditor.insertContentAtLine(filePath, insertionLine, formattedHeading);

            // Update statistics
            this.statistics.totalModifications++;
            this.statistics.successfulModifications++;
            this.statistics.headingsAdded++;
            this.statistics.filesModified++;

            result.success = true;

            // Emit event
            this.emitEvent({
                type: 'noteEditing:headingAdded',
                payload: {
                    filePath,
                    heading: finalHeading
                }
            });

            this.logger.debug('Heading added successfully', {
                filePath,
                originalHeading: heading,
                finalHeading,
                level: headingLevel,
                insertionLine
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to add heading', { filePath, heading, error });

            result.errors.push(`Failed to add heading: ${error}`);
            this.statistics.failedModifications++;

            return result;
        }
    }

    /**
     * Show the heading popup for a file
     */
    showHeadingPopup(filePath: string, onHeadingAdded?: (heading: string) => void): void {
        this.logger.debug('Showing heading popup', { filePath });

        try {
            // Create the popup component if it doesn't exist
            if (!this.headingPopupComponent) {
                this.headingPopupComponent = new HeadingPopupComponent(
                    this.app,
                    filePath,
                    (heading) => this.handleHeadingAddedFromPopup(filePath, heading)
                );
            }

            // Show the popup
            this.headingPopupComponent.show({
                filePath,
                onHeadingAdded
            });

            this.logger.debug('Heading popup shown successfully', { filePath });
        } catch (error) {
            this.logger.error('Failed to show heading popup', { filePath, error });
        }
    }

    /**
     * Hide the heading popup
     */
    hideHeadingPopup(): void {
        this.logger.debug('Hiding heading popup');

        try {
            if (this.headingPopupComponent) {
                this.headingPopupComponent.hide();
                this.logger.debug('Heading popup hidden successfully');
            } else {
                this.logger.debug('No heading popup to hide');
            }
        } catch (error) {
            this.logger.error('Failed to hide heading popup', { error });
        }
    }

    /**
     * Modify file content safely
     */
    async modifyFile(filePath: string, modifier: (content: string) => string): Promise<FileModificationResult> {
        this.logger.debug('Modifying file safely', { filePath });

        const result: FileModificationResult = {
            success: false,
            filePath,
            errors: [],
            warnings: [],
            timestamp: new Date()
        };

        try {
            // Create backup if requested
            let backupPath: string | undefined;
            if (this.options.createBackup) {
                backupPath = await this.fileModifier.createBackup(filePath);
                result.backupPath = backupPath;
                this.statistics.backupsCreated++;
            }

            // Safely modify the file
            const success = await this.fileModifier.safeModifyFile(
                filePath,
                modifier,
                {
                    createBackup: false, // Already created above
                    validateContent: this.options.validateContent
                }
            );

            if (success) {
                result.success = true;
                this.statistics.totalModifications++;
                this.statistics.successfulModifications++;
                this.statistics.filesModified++;

                this.logger.debug('File modified successfully', { filePath });
            } else {
                result.errors.push('File modification failed validation');
                this.statistics.failedModifications++;

                this.logger.debug('File modification failed validation', { filePath });
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to modify file', { filePath, error });

            result.errors.push(`Failed to modify file: ${error}`);
            this.statistics.failedModifications++;

            return result;
        }
    }

    /**
     * Get content editor
     */
    getContentEditor(): ContentEditor {
        return this.contentEditor;
    }

    /**
     * Get heading manager
     */
    getHeadingManager(): HeadingManager {
        return this.headingManager;
    }

    /**
     * Get file modifier
     */
    getFileModifier(): FileModifier {
        return this.fileModifier;
    }

    /**
     * Get heading popup component
     */
    getHeadingPopupComponent(): HeadingPopupComponent | undefined {
        return this.headingPopupComponent;
    }

    /**
     * Get statistics
     */
    getStatistics(): NoteEditingStatistics {
        return { ...this.statistics };
    }

    /**
     * Update options
     */
    updateOptions(options: Partial<NoteEditingOptions>): void {
        this.logger.debug('Updating options', { options });

        this.options = { ...this.options, ...options };

        this.logger.debug('Options updated successfully', { options: this.options });
    }

    /**
     * Handle heading added from popup
     */
    private async handleHeadingAddedFromPopup(filePath: string, heading: string): Promise<void> {
        this.logger.debug('Handling heading added from popup', { filePath, heading });

        try {
            await this.addHeading(filePath, heading);
        } catch (error) {
            this.logger.error('Failed to handle heading added from popup', { filePath, heading, error });
        }
    }

    /**
     * Emit an event
     */
    private emitEvent(event: CoalesceEvent): void {
        this.logger.debug('Emitting event', { event });

        try {
            const handlers = this.eventHandlers.get(event.type) || [];

            for (const handler of handlers) {
                try {
                    handler(event);
                } catch (error) {
                    this.logger.error('Event handler failed', { event, error });
                }
            }

            this.logger.debug('Event emitted successfully', { event });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Add event listener
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Adding event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            handlers.push(handler as EventHandler);
            this.eventHandlers.set(eventType, handlers);

            this.logger.debug('Event listener added successfully', { eventType });
        } catch (error) {
            this.logger.error('Failed to add event listener', { eventType, error });
        }
    }

    /**
     * Remove event listener
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Removing event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);

            if (index !== -1) {
                handlers.splice(index, 1);
                this.eventHandlers.set(eventType, handlers);

                this.logger.debug('Event listener removed successfully', { eventType });
            } else {
                this.logger.debug('Event listener not found', { eventType });
            }
        } catch (error) {
            this.logger.error('Failed to remove event listener', { eventType, error });
        }
    }

    /**
     * Cleanup resources used by this slice
     */
    async cleanup(): Promise<void> {
        this.logger.debug('Cleaning up NoteEditingSlice');

        try {
            // Cleanup components
            this.contentEditor.cleanup();
            this.headingManager.cleanup();
            this.fileModifier.cleanup();

            // Cleanup popup
            if (this.headingPopupComponent) {
                this.headingPopupComponent.cleanup();
                this.headingPopupComponent = undefined;
            }

            // Clear event handlers
            this.eventHandlers.clear();

            // Reset statistics
            this.statistics = {
                totalModifications: 0,
                successfulModifications: 0,
                failedModifications: 0,
                headingsAdded: 0,
                filesModified: 0,
                backupsCreated: 0
            };

            this.logger.debug('NoteEditingSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup NoteEditingSlice', { error });
        }
    }

    /**
     * Add heading to file (alias for addHeading)
     */
    async addHeadingToFile(filePath: string, heading: string): Promise<boolean> {
        const result = await this.addHeading(filePath, heading);
        return result.success;
    }

    /**
     * Validate heading (alias for headingManager.validateHeading)
     */
    validateHeading(heading: string): boolean {
        return this.headingManager.validateHeading(heading);
    }

    /**
     * Get file modification options
     */
    getFileModificationOptions(): {
        createBackup: boolean;
        validateContent: boolean;
    } {
        return {
            createBackup: this.options.createBackup,
            validateContent: this.options.validateContent
        };
    }
}

// Export the interface for external use
export type { INoteEditingSlice } from '../shared-contracts/slice-interfaces';
