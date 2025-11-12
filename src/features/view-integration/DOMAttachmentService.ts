import { MarkdownView } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IDOMAttachmentService, DOMPosition, DOMAttachmentEvent } from './types';

/**
 * DOM Attachment Service for View Integration Slice
 * 
 * Handles DOM attachment and detachment operations for the vertical slice architecture.
 */
export class DOMAttachmentService implements IDOMAttachmentService {
    private logger: Logger;
    private styleObserver: MutationObserver | null = null;
    private statistics: {
        totalAttachments: number;
        totalDetachments: number;
        totalOrphanedCleanups: number;
        lastAttachment?: Date;
        lastDetachment?: Date;
        lastOrphanedCleanup?: Date;
    };
    private eventListeners: Map<string, Function[]> = new Map();

    constructor(logger: Logger) {
        this.logger = logger.child('DOMAttachmentService');
        
        this.statistics = {
            totalAttachments: 0,
            totalDetachments: 0,
            totalOrphanedCleanups: 0
        };
        
        this.logger.debug('DOMAttachmentService initialized');
    }

    /**
     * Attach container to view
     */
    attachToView(view: MarkdownView, container: HTMLElement): boolean {
        this.logger.debug('Attaching container to view', { 
            viewFile: view.file?.path,
            containerId: container.id 
        });
        
        try {
            // Check if container is already properly attached
            if (this.isAttached(view, container)) {
                this.logger.debug('Container already attached, skipping');
                return true;
            }
            
            // Check for existing Coalesce containers in this view and remove them to prevent duplicates
            this.cleanupOrphanedContainers(view);
            
            // If container has a parent but it's not properly attached, remove it first
            if (container.parentElement) {
                container.parentElement.removeChild(container);
            }
            
            // Find the attachment position
            const position = this.getAttachmentPosition(view);
            if (!position) {
                this.logger.error('Failed to find attachment position');
                return false;
            }
            
            // Attach container based on position
            let success = false;
            switch (position.position) {
                case 'after':
                    position.element.insertAdjacentElement('afterend', container);
                    success = true;
                    break;
                case 'before':
                    position.element.insertAdjacentElement('beforebegin', container);
                    success = true;
                    break;
                case 'append':
                    position.element.appendChild(container);
                    success = true;
                    break;
            }
            
            if (success) {
                // Update statistics
                this.statistics.totalAttachments++;
                this.statistics.lastAttachment = new Date();
                
                // Ensure the container is always visible with minimum styles
                container.style.minHeight = '50px';
                container.style.display = 'block';
                container.style.visibility = 'visible';
                
                // Start style monitoring
                this.startStyleMonitoring(view, container);
                
                // Emit event
                this.emitEvent({
                    type: 'attach',
                    viewId: this.getViewId(view),
                    container,
                    position,
                    timestamp: new Date(),
                    success: true
                });
                
                this.logger.debug('Container attached successfully', { 
                    viewFile: view.file?.path,
                    position: position.position 
                });
                
                return true;
            } else {
                this.logger.error('Failed to attach container');
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to attach container to view', { 
                viewFile: view.file?.path,
                error 
            });
            
            // Emit error event
            this.emitEvent({
                type: 'attach',
                viewId: this.getViewId(view),
                container,
                position: { element: document.createElement('div'), position: 'after', target: '' },
                timestamp: new Date(),
                success: false,
                error: error.message
            });
            
            return false;
        }
    }

    /**
     * Detach container from view
     */
    detachFromView(view: MarkdownView, container: HTMLElement): boolean {
        this.logger.debug('Detaching container from view', { 
            viewFile: view.file?.path,
            containerId: container.id 
        });
        
        try {
            // Check if container is attached
            if (!this.isAttached(view, container)) {
                this.logger.debug('Container not attached, skipping');
                return true;
            }
            
            // Stop style monitoring
            this.stopStyleMonitoring();
            
            // Remove container from DOM
            if (container.parentElement) {
                container.parentElement.removeChild(container);
            }
            
            // Update statistics
            this.statistics.totalDetachments++;
            this.statistics.lastDetachment = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'detach',
                viewId: this.getViewId(view),
                container,
                position: { element: document.createElement('div'), position: 'after', target: '' },
                timestamp: new Date(),
                success: true
            });
            
            this.logger.debug('Container detached successfully', { 
                viewFile: view.file?.path 
            });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to detach container from view', { 
                viewFile: view.file?.path,
                error 
            });
            
            // Emit error event
            this.emitEvent({
                type: 'detach',
                viewId: this.getViewId(view),
                container,
                position: { element: document.createElement('div'), position: 'after', target: '' },
                timestamp: new Date(),
                success: false,
                error: error.message
            });
            
            return false;
        }
    }

    /**
     * Check if container is properly attached
     */
    isAttached(view: MarkdownView, container: HTMLElement): boolean {
        try {
            const isProperlyAttached = container.parentElement && 
                                       container.parentElement.isConnected && 
                                       view.containerEl.contains(container);
            
            this.logger.debug('Checking attachment status', { 
                viewFile: view.file?.path,
                isProperlyAttached 
            });
            
            return !!isProperlyAttached;
        } catch (error) {
            this.logger.error('Failed to check attachment status', { 
                viewFile: view.file?.path,
                error 
            });
            return false;
        }
    }

    /**
     * Cleanup orphaned containers
     */
    cleanupOrphanedContainers(view: MarkdownView): void {
        this.logger.debug('Cleaning up orphaned containers', { 
            viewFile: view.file?.path 
        });
        
        try {
            const existingContainers = view.containerEl.querySelectorAll('.coalesce-custom-backlinks-container');
            
            if (existingContainers.length > 0) {
                this.logger.debug('Found orphaned containers, cleaning up', { 
                    count: existingContainers.length,
                    viewFile: view.file?.path
                });
                
                existingContainers.forEach(container => {
                    container.remove();
                });
                
                // Update statistics
                this.statistics.totalOrphanedCleanups++;
                this.statistics.lastOrphanedCleanup = new Date();
                
                // Emit event
                this.emitEvent({
                    type: 'cleanup',
                    viewId: this.getViewId(view),
                    container: existingContainers[0] as HTMLElement,
                    position: { element: document.createElement('div'), position: 'after', target: '' },
                    timestamp: new Date(),
                    success: true
                });
            }
        } catch (error) {
            this.logger.error('Failed to cleanup orphaned containers', { 
                viewFile: view.file?.path,
                error 
            });
        }
    }

    /**
     * Get attachment position
     */
    getAttachmentPosition(view: MarkdownView): DOMPosition | null {
        try {
            // Always place below content
            const markdownSection = view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
            
            if (markdownSection) {
                return {
                    element: markdownSection,
                    position: 'after',
                    target: '.markdown-preview-section'
                };
            }
            
            this.logger.error('Failed to find attachment position');
            return null;
        } catch (error) {
            this.logger.error('Failed to get attachment position', { 
                viewFile: view.file?.path,
                error 
            });
            return null;
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): any {
        return { ...this.statistics };
    }

    /**
     * Add event listener
     */
    addEventListener(eventType: string, listener: Function): void {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.push(listener);
        this.eventListeners.set(eventType, listeners);
    }

    /**
     * Remove event listener
     */
    removeEventListener(eventType: string, listener: Function): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
                this.eventListeners.set(eventType, listeners);
            }
        }
    }

    /**
     * Start monitoring for unwanted style changes
     */
    private startStyleMonitoring(view: MarkdownView, container: HTMLElement): void {
        // Stop any existing observer
        this.stopStyleMonitoring();
        
        // Find elements that Obsidian might add styles to
        const markdownSection = view.containerEl.querySelector('.markdown-preview-section') as HTMLElement;
        const markdownSizer = view.containerEl.querySelector('.markdown-preview-sizer') as HTMLElement;
        
        if (!markdownSection && !markdownSizer) return;
        
        // Create observer to watch for style attribute changes
        this.styleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target as HTMLElement;
                    this.removeUnwantedStyles(target);
                }
            });
        });
        
        // Observe both elements if they exist
        const observeOptions = {
            attributes: true,
            attributeFilter: ['style']
        };
        
        if (markdownSection) {
            this.styleObserver.observe(markdownSection, observeOptions);
        }
        if (markdownSizer) {
            this.styleObserver.observe(markdownSizer, observeOptions);
        }
        
        // Also clean up any existing unwanted styles
        if (markdownSection) this.removeUnwantedStyles(markdownSection);
        if (markdownSizer) this.removeUnwantedStyles(markdownSizer);
    }

    /**
     * Stop monitoring for style changes
     */
    private stopStyleMonitoring(): void {
        if (this.styleObserver) {
            this.styleObserver.disconnect();
            this.styleObserver = null;
        }
    }

    /**
     * Remove unwanted inline styles that affect positioning
     */
    private removeUnwantedStyles(element: HTMLElement): void {
        if (!element || !element.style) return;
        
        // Remove problematic inline styles
        if (element.style.paddingBottom) {
            element.style.removeProperty('padding-bottom');
        }
        if (element.style.minHeight) {
            element.style.removeProperty('min-height');
        }
        
        this.logger.debug('Removed unwanted styles from element', {
            tagName: element.tagName,
            className: element.className
        });
    }

    /**
     * Get view ID
     */
    private getViewId(view: MarkdownView): string {
        return (view.leaf as any).id || 'unknown';
    }

    /**
     * Emit event
     */
    private emitEvent(event: DOMAttachmentEvent): void {
        this.logger.debug('Emitting event', { event });
        
        try {
            const listeners = this.eventListeners.get(event.type) || [];
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    this.logger.error('Event listener failed', { event, error });
                }
            }
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalAttachments: 0,
            totalDetachments: 0,
            totalOrphanedCleanups: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this DOM attachment service
     */
    cleanup(): void {
        this.logger.debug('Cleaning up DOMAttachmentService');
        
        try {
            // Stop style monitoring
            this.stopStyleMonitoring();
            
            // Clear event listeners
            this.eventListeners.clear();
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('DOMAttachmentService cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup DOMAttachmentService', { error });
        }
    }
}