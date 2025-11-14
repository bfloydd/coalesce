import { App } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IconProvider } from '../shared-utilities/IconProvider';
import { IHeaderUI, HeaderCreateOptions, HeaderState, HeaderStatistics } from './types';
import { HeaderComponent } from './HeaderComponent';
import { SettingsControls } from './SettingsControls';

/**
 * Header UI for Backlinks Header Slice
 * 
 * Handles creation and management of the header UI
 * for the vertical slice architecture.
 */
export class HeaderUI implements IHeaderUI {
    private app: App;
    private logger: Logger;
    private headerComponent: HeaderComponent;
    private statistics: HeaderStatistics;
    private resizeObserver: ResizeObserver | null = null;
    private observedContainer: HTMLElement | null = null;

    constructor(app: App, logger: Logger, settingsControls: SettingsControls) {
        this.app = app;
        this.logger = logger.child('HeaderUI');
        this.headerComponent = new HeaderComponent(this.logger as any, settingsControls);
        
        this.statistics = {
            totalHeadersCreated: 0,
            totalFilterChanges: 0,
            totalSortToggles: 0,
            totalCollapseToggles: 0,
            totalStrategyChanges: 0,
            totalThemeChanges: 0,
            totalAliasSelections: 0,
            totalSettingsClicks: 0
        };
        
        this.logger.debug('HeaderUI initialized');
    }

    /**
     * Create header element
     */
    createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement {
        this.logger.debug('Creating header', { options });
        
        try {
            // Use the existing HeaderComponent to create the header
            const header = this.headerComponent.createHeader(
                container,
                options.fileCount,
                options.sortDescending,
                options.onSortToggle,
                options.onCollapseToggle,
                options.isCollapsed,
                options.currentStrategy,
                options.onStrategyChange,
                options.currentTheme,
                options.onThemeChange,
                options.showFullPathTitle,
                options.onFullPathTitleChange,
                options.aliases,
                options.onAliasSelect,
                options.currentAlias,
                options.unsavedAliases,
                options.currentHeaderStyle,
                options.onHeaderStyleChange,
                options.onFilterChange,
                options.currentFilter
            );
            
            // Update statistics
            this.statistics.totalHeadersCreated++;
            
            // Apply responsive layout
            this.applyResponsiveLayout(header, container);
            
            this.logger.debug('Header created successfully', { 
                headerElement: header,
                statistics: this.statistics 
            });
            
            return header;
        } catch (error) {
            this.logger.error('Failed to create header', { options, error });
            throw error;
        }
    }

    /**
     * Update header state
     */
    updateHeader(header: HTMLElement, state: HeaderState): void {
        this.logger.debug('Updating header state', { state });
        
        try {
            // Update sort button state
            this.updateSortButtonState(header, state.sortDescending);
            
            // Update collapse button state
            this.updateCollapseButtonState(header, state.isCollapsed);
            
            // Update compact state
            this.updateCompactState(header, state.isCompact);
            
            this.logger.debug('Header state updated successfully', { state });
        } catch (error) {
            this.logger.error('Failed to update header state', { header, state, error });
        }
    }

    /**
     * Focus filter input
     */
    focusFilterInput(header: HTMLElement): boolean {
        this.logger.debug('Focusing filter input');
        
        try {
            const result = this.headerComponent.focusFilterInput(header);
            
            this.logger.debug('Filter input focus result', { result });
            return result;
        } catch (error) {
            this.logger.error('Failed to focus filter input', { header, error });
            return false;
        }
    }

    /**
     * Get header element
     */
    getHeaderElement(container: HTMLElement): HTMLElement | null {
        this.logger.debug('Getting header element');
        
        try {
            const header = container.querySelector('.coalesce-backlinks-header') as HTMLElement;
            
            this.logger.debug('Header element retrieved', { header: !!header });
            return header;
        } catch (error) {
            this.logger.error('Failed to get header element', { container, error });
            return null;
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): HeaderStatistics {
        return { ...this.statistics };
    }

    /**
     * Apply responsive layout
     */
    private applyResponsiveLayout(header: HTMLElement, container: HTMLElement): void {
        this.logger.debug('Applying responsive layout');
        
        try {
            // Cleanup existing observer
            this.cleanupResizeObserver();
            
            // Set up new observer
            this.observedContainer = container;
            
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const width = entry.contentRect.width;
                    const isCompact = width < 450;
                    
                    if (isCompact) {
                        header.classList.add('compact');
                    } else {
                        header.classList.remove('compact');
                    }
                    
                    this.logger.debug('Responsive layout updated', { width, isCompact });
                }
            });
            
            // Check initial width
            const initialWidth = container.getBoundingClientRect().width;
            if (initialWidth < 450) {
                header.classList.add('compact');
            }
            
            // Start observing
            this.resizeObserver.observe(container);
            
            this.logger.debug('Responsive layout applied successfully');
        } catch (error) {
            this.logger.error('Failed to apply responsive layout', { header, container, error });
        }
    }

    /**
     * Update sort button state
     */
    private updateSortButtonState(header: HTMLElement, sortDescending: boolean): void {
        try {
            const sortButton = header.querySelector('.coalesce-sort-button') as HTMLElement;
            if (sortButton) {
                // Update button text
                const textNode = Array.from(sortButton.childNodes).find(node =>
                    node.nodeType === Node.TEXT_NODE
                );
                if (textNode) {
                    textNode.textContent = sortDescending ? 'Descending' : 'Ascending';
                }

                // Update aria-label
                sortButton.setAttribute('aria-label', sortDescending ? 'Descending' : 'Ascending');

                // Update SVG icon classes using IconProvider
                const classesToAdd = sortDescending ? ['sort-descending'] : ['sort-ascending'];
                const classesToRemove = sortDescending ? ['sort-ascending'] : ['sort-descending'];
                IconProvider.updateIconClasses(sortButton, classesToAdd, classesToRemove);
            }
        } catch (error) {
            this.logger.error('Failed to update sort button state', { header, sortDescending, error });
        }
    }

    /**
     * Update collapse button state
     */
    private updateCollapseButtonState(header: HTMLElement, isCollapsed: boolean): void {
        try {
            const collapseButton = header.querySelector('.coalesce-collapse-button') as HTMLElement;
            if (collapseButton) {
                const classesToAdd = isCollapsed ? ['is-collapsed'] : [];
                const classesToRemove = isCollapsed ? [] : ['is-collapsed'];
                IconProvider.updateIconClasses(collapseButton, classesToAdd, classesToRemove);
            }
        } catch (error) {
            this.logger.error('Failed to update collapse button state', { header, isCollapsed, error });
        }
    }

    /**
     * Update compact state
     */
    private updateCompactState(header: HTMLElement, isCompact: boolean): void {
        try {
            if (isCompact) {
                header.classList.add('compact');
            } else {
                header.classList.remove('compact');
            }
        } catch (error) {
            this.logger.error('Failed to update compact state', { header, isCompact, error });
        }
    }

    /**
     * Cleanup resize observer
     */
    private cleanupResizeObserver(): void {
        if (this.resizeObserver && this.observedContainer) {
            this.resizeObserver.unobserve(this.observedContainer);
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
            this.observedContainer = null;
        }
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalHeadersCreated: 0,
            totalFilterChanges: 0,
            totalSortToggles: 0,
            totalCollapseToggles: 0,
            totalStrategyChanges: 0,
            totalThemeChanges: 0,
            totalAliasSelections: 0,
            totalSettingsClicks: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this header UI
     */
    cleanup(): void {
        this.logger.debug('Cleaning up HeaderUI');
        
        try {
            // Cleanup header component
            this.headerComponent.cleanup();
            
            // Cleanup resize observer
            this.cleanupResizeObserver();
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('HeaderUI cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup HeaderUI', { error });
        }
    }
}