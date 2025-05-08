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

    protected sanitizePath(path: string): string {
        const sanitized = path.replace(/\.md$/, '');
        this.logger.debug('Sanitizing path', {
            original: path,
            sanitized
        });
        return sanitized;
    }

    protected abstract formatTitle(path: string): string;
} 