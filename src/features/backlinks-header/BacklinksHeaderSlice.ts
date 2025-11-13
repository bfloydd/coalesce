import { App } from 'obsidian';
import { IBacklinksHeaderSlice } from '../shared-contracts/slice-interfaces';
import { HeaderUI } from './HeaderUI';
import { FilterControls } from './FilterControls';
import { SettingsControls } from './SettingsControls';
import { Logger } from '../shared-utilities/Logger';
import { HeaderCreateOptions, HeaderState, HeaderStatistics, HeaderEventData } from './types';
import { CoalesceEvent, EventHandler } from '../shared-contracts/events';

/**
 * Backlinks Header Slice Implementation
 * 
 * This slice handles header UI, filter controls, and settings controls
 * for the vertical slice architecture.
 */
export class BacklinksHeaderSlice implements IBacklinksHeaderSlice {
    private app: App;
    private logger: Logger;
    private headerUI: HeaderUI;
    private filterControls: FilterControls;
    private settingsControls: SettingsControls;
    private currentHeaders: Map<string, HTMLElement> = new Map();
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private statistics: HeaderStatistics;
    private currentState: HeaderState;
    private sortMode: 'none' | 'ascending' | 'descending' = 'none';

    constructor(app: App, initialCollapseState: boolean = false) {
        this.app = app;
        this.logger = new Logger('BacklinksHeaderSlice');

        // Initialize components
        this.headerUI = new HeaderUI(app, this.logger);
        this.filterControls = new FilterControls(this.logger);
        this.settingsControls = new SettingsControls(this.logger);

        // Initialize state with initial collapse state from settings
        this.currentState = {
            fileCount: 0,
            sortByPath: false,
            sortDescending: true,
            isCollapsed: initialCollapseState,
            currentStrategy: 'default',
            currentTheme: 'default',
            showFullPathTitle: false,
            currentAlias: null,
            currentHeaderStyle: 'full',
            currentFilter: '',
            isCompact: false
        };
        
        // Initialize statistics
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
        
        this.logger.debug('BacklinksHeaderSlice initialized');
    }

    /**
     * Create header for a container
     */
    createHeader(container: HTMLElement, options: HeaderCreateOptions): HTMLElement {
        this.logger.debug('Creating header', { options });
        
        try {
            // Create header using HeaderUI
            const header = this.headerUI.createHeader(container, options);
            
            // Store header reference
            const headerId = this.generateHeaderId(container);
            this.currentHeaders.set(headerId, header);
            
            // Update current state
            this.updateCurrentState(options);
            
            // Update statistics
            this.statistics.totalHeadersCreated++;
            
            // Emit event
            this.emitEvent({
                type: 'header:filterChanged',
                payload: {
                    text: 'header created'
                }
            });
            
            this.logger.debug('Header created successfully', { 
                headerId, 
                header: !!header 
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
    updateHeader(headerId: string, state: Partial<HeaderState>): void {
        this.logger.debug('Updating header state', { headerId, state });
        
        try {
            // Get header element
            const header = this.currentHeaders.get(headerId);
            if (!header) {
                this.logger.warn('Header not found', { headerId });
                return;
            }
            
            // Update current state
            this.currentState = { ...this.currentState, ...state };
            
            // Update header UI
            this.headerUI.updateHeader(header, this.currentState);
            
            // Emit event
            this.emitEvent({
                type: 'header:filterChanged',
                payload: {
                    text: 'header updated'
                }
            });
            
            this.logger.debug('Header state updated successfully', { headerId, state });
        } catch (error) {
            this.logger.error('Failed to update header state', { headerId, state, error });
        }
    }

    /**
     * Focus filter input
     */
    focusFilterInput(): boolean {
        this.logger.debug('Focusing filter input');
        
        try {
            // Get the first header element
            const header = this.currentHeaders.values().next().value;
            if (!header) {
                this.logger.warn('No header found');
                return false;
            }
            
            // Focus filter input
            const result = this.headerUI.focusFilterInput(header);
            
            this.logger.debug('Filter input focus result', { result });
            return result;
        } catch (error) {
            this.logger.error('Failed to focus filter input', { error });
            return false;
        }
    }

    /**
     * Handle filter change
     */
    handleFilterChange(filterText: string): void {
        this.logger.debug('Handling filter change', { filterText });
        
        try {
            // Update statistics
            this.statistics.totalFilterChanges++;
            this.statistics.lastFilterChange = new Date();
            
            // Update current state
            this.currentState.currentFilter = filterText;
            
            // Emit event
            this.emitEvent({
                type: 'header:filterChanged',
                payload: {
                    text: filterText
                }
            });
            
            this.logger.debug('Filter change handled successfully', { filterText });
        } catch (error) {
            this.logger.error('Failed to handle filter change', { filterText, error });
        }
    }

    /**
     * Handle sort toggle
     */
    handleSortToggle(): void {
        this.logger.debug('Handling sort toggle');

        try {
            // Update statistics
            this.statistics.totalSortToggles++;
            this.statistics.lastSortToggle = new Date();

            // Cycle through sort modes: none -> ascending -> descending -> none
            switch (this.sortMode) {
                case 'none':
                    this.sortMode = 'ascending';
                    this.currentState.sortByPath = true;
                    this.currentState.sortDescending = false;
                    break;
                case 'ascending':
                    this.sortMode = 'descending';
                    this.currentState.sortByPath = true;
                    this.currentState.sortDescending = true;
                    break;
                case 'descending':
                    this.sortMode = 'none';
                    this.currentState.sortByPath = false;
                    this.currentState.sortDescending = false;
                    break;
            }

            // Update header UI to reflect the new state
            for (const header of this.currentHeaders.values()) {
                this.headerUI.updateHeader(header, this.currentState);
            }

            // Emit event
            this.emitEvent({
                type: 'header:sortToggled',
                payload: {
                    sortByPath: this.currentState.sortByPath,
                    descending: this.currentState.sortDescending
                }
            });

            this.logger.debug('Sort toggle handled successfully', {
                sortMode: this.sortMode,
                sortByPath: this.currentState.sortByPath,
                descending: this.currentState.sortDescending
            });
        } catch (error) {
            this.logger.error('Failed to handle sort toggle', { error });
        }
    }

    /**
     * Set initial collapse state from settings
     */
    setInitialCollapseState(collapsed: boolean): void {
        this.logger.debug('Setting initial collapse state', { collapsed });
        this.currentState.isCollapsed = collapsed;
    }

    /**
     * Handle collapse toggle
     */
    handleCollapseToggle(): void {
        this.logger.debug('Handling collapse toggle');

        try {
            // Update statistics
            this.statistics.totalCollapseToggles++;
            this.statistics.lastCollapseToggle = new Date();

            // Update current state
            this.currentState.isCollapsed = !this.currentState.isCollapsed;

            // Update header UI to reflect the new state
            for (const header of this.currentHeaders.values()) {
                this.headerUI.updateHeader(header, this.currentState);
            }

            // Emit event to notify backlink blocks slice
            this.emitEvent({
                type: 'header:collapseToggled',
                payload: {
                    collapsed: this.currentState.isCollapsed
                }
            });

            this.logger.debug('Collapse toggle handled successfully', {
                collapsed: this.currentState.isCollapsed
            });
        } catch (error) {
            this.logger.error('Failed to handle collapse toggle', { error });
        }
    }

    /**
     * Handle strategy change
     */
    handleStrategyChange(strategy: string): void {
        this.logger.debug('Handling strategy change', { strategy });
        
        try {
            // Update statistics
            this.statistics.totalStrategyChanges++;
            this.statistics.lastStrategyChange = new Date();
            
            // Update current state
            this.currentState.currentStrategy = strategy;
            
            // Emit event
            this.emitEvent({
                type: 'header:strategyChanged',
                payload: {
                    strategyId: strategy
                }
            });
            
            this.logger.debug('Strategy change handled successfully', { strategy });
        } catch (error) {
            this.logger.error('Failed to handle strategy change', { strategy, error });
        }
    }

    /**
     * Handle theme change
     */
    handleThemeChange(theme: string): void {
        this.logger.debug('Handling theme change', { theme });
        
        try {
            // Update statistics
            this.statistics.totalThemeChanges++;
            this.statistics.lastThemeChange = new Date();
            
            // Update current state
            this.currentState.currentTheme = theme;
            
            // Emit event
            this.emitEvent({
                type: 'header:themeChanged',
                payload: {
                    themeId: theme
                }
            });
            
            this.logger.debug('Theme change handled successfully', { theme });
        } catch (error) {
            this.logger.error('Failed to handle theme change', { theme, error });
        }
    }

    /**
     * Handle alias selection
     */
    handleAliasSelection(alias: string | null): void {
        this.logger.debug('Handling alias selection', { alias });
        
        try {
            // Update statistics
            this.statistics.totalAliasSelections++;
            this.statistics.lastAliasSelection = new Date();
            
            // Update current state
            this.currentState.currentAlias = alias;
            
            // Emit event
            this.emitEvent({
                type: 'header:aliasSelected',
                payload: {
                    alias
                }
            });
            
            this.logger.debug('Alias selection handled successfully', { alias });
        } catch (error) {
            this.logger.error('Failed to handle alias selection', { alias, error });
        }
    }

    /**
     * Handle settings click
     */
    handleSettingsClick(): void {
        this.logger.debug('Handling settings click');
        
        try {
            // Update statistics
            this.statistics.totalSettingsClicks++;
            this.statistics.lastSettingsClick = new Date();
            
            // Emit event
            this.emitEvent({
                type: 'header:filterChanged',
                payload: {
                    text: 'settings clicked'
                }
            });
            
            this.logger.debug('Settings click handled successfully');
        } catch (error) {
            this.logger.error('Failed to handle settings click', { error });
        }
    }

    /**
     * Update header state
     */
    updateHeaderState(state: Partial<HeaderState>): void {
        this.logger.debug('Updating header state', { state });
        
        try {
            // Update current state
            this.currentState = { ...this.currentState, ...state };
            
            this.logger.debug('Header state updated successfully', { state });
        } catch (error) {
            this.logger.error('Failed to update header state', { state, error });
        }
    }

    /**
     * Get header state
     */
    getHeaderState(): any {
        return {
            ...this.currentState,
            filterText: this.currentState.currentFilter,
            selectedAlias: this.currentState.currentAlias
        };
    }

    /**
     * Get statistics
     */
    getStatistics(): HeaderStatistics {
        return { ...this.statistics };
    }

    /**
     * Get header UI
     */
    getHeaderUI(): HeaderUI {
        return this.headerUI;
    }

    /**
     * Get filter controls
     */
    getFilterControls(): FilterControls {
        return this.filterControls;
    }

    /**
     * Get settings controls
     */
    getSettingsControls(): SettingsControls {
        return this.settingsControls;
    }

    /**
     * Generate header ID
     */
    private generateHeaderId(container: HTMLElement): string {
        // Generate a unique ID based on container and timestamp
        return `header-${container.id || 'unknown'}-${Date.now()}`;
    }

    /**
     * Update current state
     */
    private updateCurrentState(options: HeaderCreateOptions): void {
        this.currentState = {
            fileCount: options.fileCount,
            sortByPath: this.currentState.sortByPath,
            sortDescending: this.currentState.sortDescending,
            isCollapsed: options.isCollapsed,
            currentStrategy: options.currentStrategy,
            currentTheme: options.currentTheme,
            showFullPathTitle: options.showFullPathTitle,
            currentAlias: options.currentAlias,
            currentHeaderStyle: options.currentHeaderStyle,
            currentFilter: options.currentFilter,
            isCompact: this.currentState.isCompact
        };
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
    cleanup(): void {
        this.logger.debug('Cleaning up BacklinksHeaderSlice');
        
        try {
            // Cleanup components
            this.headerUI.cleanup();
            this.filterControls.cleanup();
            this.settingsControls.cleanup();
            
            // Clear data
            this.currentHeaders.clear();
            this.eventHandlers.clear();
            
            // Reset state
            this.currentState = {
                fileCount: 0,
                sortByPath: false,
                sortDescending: false,
                isCollapsed: false,
                currentStrategy: 'default',
                currentTheme: 'default',
                showFullPathTitle: false,
                currentAlias: null,
                currentHeaderStyle: 'full',
                currentFilter: '',
                isCompact: false
            };

            // Reset sort mode
            this.sortMode = 'none';
            
            // Reset statistics
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
            
            this.logger.debug('BacklinksHeaderSlice cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup BacklinksHeaderSlice', { error });
        }
    }
}

// Export the interface for external use
export type { IBacklinksHeaderSlice } from '../shared-contracts/slice-interfaces';