import { Logger } from '../../utils/Logger';

export abstract class AbstractHeaderStyle {
    protected logger: Logger;

    constructor(protected blockContent: string = '') {
        this.logger = new Logger(this.constructor.name);
    }

    getDisplayTitle(filePath: string): string {
        this.logger.debug('Getting display title', { filePath });
        
        const sanitizedPath = this.sanitizePath(filePath);
        this.logger.debug('Path sanitized', { 
            original: filePath,
            sanitized: sanitizedPath
        });
        
        const formattedTitle = this.formatTitle(sanitizedPath);
        this.logger.debug('Title formatted', {
            sanitizedPath,
            formattedTitle
        });
        
        return formattedTitle;
    }

    /**
     * Returns true if this header style shows an "Add a heading" prompt
     */
    showsAddHeadingPrompt(): boolean {
        return false;
    }

    protected sanitizePath(path: string): string {
        const sanitized = path.replace(/\.md$/, '');
        this.logger.debug('Sanitizing path', {
            original: path,
            sanitized
        });
        return sanitized;
    }
    
    protected extractFileName(path: string): string {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        
        this.logger.debug('File name extracted', {
            parts,
            fileName
        });
        
        return fileName;
    }

    protected abstract formatTitle(path: string): string;
} 